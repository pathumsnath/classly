import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/fees/is_overdue.dart';
import '../../core/session/session_info.dart';
import '../../core/supabase/client.dart';
import '../../core/time/colombo_time.dart';
import '../../shared/models/attendance_student.dart';

const _monthAbbrev = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// Ported from src/lib/attendance/queries.ts's getClassAttendanceState's
/// outstanding-payment label.
String _formatCycleDate(String date) {
  final parts = date.split('-');
  final month = int.parse(parts[1]);
  final day = int.parse(parts[2]);
  return '${_monthAbbrev[month - 1]} $day';
}

/// Roster + existing-status reads are direct RLS-scoped queries — the same
/// SELECT-only case today_repository already established as safe to port
/// straight to Dart. Submission itself stays behind the submit-attendance
/// Edge Function, which owns the billing side effects and the per-class
/// ownership check (see supabase/functions/submit-attendance).
class AttendanceRepository {
  Future<List<AttendanceStudent>> fetchRoster(
    SessionInfo session,
    String classId,
    String date,
  ) async {
    final results = await Future.wait<dynamic>([
      supabase
          .from('classes')
          .select('billing_cycle_sessions, cycle_started_at')
          .eq('id', classId)
          .maybeSingle(),
      supabase
          .from('enrollments')
          .select('id, student_id')
          .eq('class_id', classId)
          .eq('status', 'active'),
    ]);
    final cls = results[0] as Map<String, dynamic>?;
    final rows = (results[1] as List).cast<Map<String, dynamic>>();
    if (rows.isEmpty) return [];

    final billingCycleSessions = cls?['billing_cycle_sessions'] as int?;
    final classCycleStartedAt = cls?['cycle_started_at'] as String?;

    final studentIds = rows
        .map((e) => e['student_id'] as String)
        .toSet()
        .toList();
    final enrollmentIds = rows.map((e) => e['id'] as String).toList();

    final results2 = await Future.wait([
      supabase
          .from('users')
          .select('id, name, phone')
          .inFilter('id', studentIds),
      supabase
          .from('attendance')
          .select('enrollment_id, status')
          .eq('date', date)
          .inFilter('enrollment_id', enrollmentIds),
      supabase
          .from('payments')
          .select('id, student_id, status, balance, month, cycle_started_at')
          .eq('class_id', classId)
          .inFilter('student_id', studentIds),
      supabase
          .from('wallet_transactions')
          .select('student_id, amount, type')
          .eq('institute_id', session.instituteId)
          .inFilter('student_id', studentIds),
    ]);

    final students = (results2[0] as List).cast<Map<String, dynamic>>();
    final attendanceRows = (results2[1] as List).cast<Map<String, dynamic>>();
    final payments = (results2[2] as List).cast<Map<String, dynamic>>();
    final walletRows = (results2[3] as List).cast<Map<String, dynamic>>();

    final nameById = {
      for (final s in students) s['id'] as String: s['name'] as String,
    };
    final phoneById = {
      for (final s in students) s['id'] as String: s['phone'] as String,
    };
    final statusByEnrollment = {
      for (final a in attendanceRows)
        a['enrollment_id'] as String: attendanceStatusFromString(
          a['status'] as String?,
        ),
    };

    final paymentsByStudent = <String, List<Map<String, dynamic>>>{};
    for (final p in payments) {
      final studentId = p['student_id'] as String;
      (paymentsByStudent[studentId] ??= []).add(p);
    }

    final walletBalanceByStudent = <String, num>{};
    for (final w in walletRows) {
      final studentId = w['student_id'] as String;
      final amount = w['amount'] as num;
      final delta = w['type'] == 'credit' ? amount : -amount;
      walletBalanceByStudent[studentId] =
          (walletBalanceByStudent[studentId] ?? 0) + delta;
    }

    final currentMonth = currentMonthInColombo();

    final list = rows.map((e) {
      final enrollmentId = e['id'] as String;
      final studentId = e['student_id'] as String;
      final studentPayments = paymentsByStudent[studentId] ?? [];
      final outstanding = studentPayments
          .where((p) => p['status'] == 'pending' || p['status'] == 'partial')
          .toList();

      final feeIsOverdue = outstanding.any(
        (p) => isOverdue(
          status: p['status'] as String,
          paymentMonth: p['month'] as String,
          paymentCycleStartedAt: p['cycle_started_at'] as String?,
          billingCycleSessions: billingCycleSessions,
          classCycleStartedAt: classCycleStartedAt,
          currentMonth: currentMonth,
        ),
      );

      final outstandingPayments = outstanding.map((p) {
        final month = p['month'] as String;
        final cycleStartedAt = p['cycle_started_at'] as String;
        final label = billingCycleSessions != null
            ? 'Month from ${_formatCycleDate(cycleStartedAt)}'
            : month.substring(0, 7);
        return OutstandingPayment(
          id: p['id'] as String,
          month: month,
          balance: p['balance'] as num,
          label: label,
        );
      }).toList();

      return AttendanceStudent(
        enrollmentId: enrollmentId,
        studentId: studentId,
        name: nameById[studentId] ?? 'Unknown',
        phone: phoneById[studentId] ?? '',
        status: statusByEnrollment[enrollmentId] ?? AttendanceStatus.absent,
        hasFeeRecords: studentPayments.isNotEmpty,
        feeBalance: outstanding.fold<num>(
          0,
          (sum, p) => sum + (p['balance'] as num),
        ),
        feeIsOverdue: feeIsOverdue,
        outstandingPayments: outstandingPayments,
        walletBalance: walletBalanceByStudent[studentId] ?? 0,
      );
    }).toList();

    list.sort((a, b) => a.name.compareTo(b.name));
    return list;
  }

  /// Returns true if this submission closed a billing cycle (the next
  /// cycle's fee has already been billed) — the screen surfaces that as a
  /// heads-up, mirroring the web app's post-submit banner.
  Future<bool> submit({
    required String classId,
    required String date,
    required List<AttendanceStudent> roster,
  }) async {
    try {
      final response = await supabase.functions.invoke(
        'submit-attendance',
        body: {
          'classId': classId,
          'date': date,
          'entries': roster
              .map(
                (s) => {
                  'enrollmentId': s.enrollmentId,
                  'status': s.status.value,
                },
              )
              .toList(),
        },
      );
      final data = response.data;
      return data is Map && data['cycleCompleted'] == true;
    } on FunctionException catch (e) {
      final details = e.details;
      final message = details is Map ? details['error'] as String? : null;
      throw Exception(message ?? 'Could not submit attendance.');
    }
  }
}
