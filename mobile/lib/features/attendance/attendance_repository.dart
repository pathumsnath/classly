import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/fees/is_overdue.dart';
import '../../core/labels/class_labels.dart';
import '../../core/session/session_info.dart';
import '../../core/supabase/client.dart';
import '../../core/time/colombo_time.dart';
import '../../shared/models/attendance_student.dart';
import '../../shared/models/monthly_attendance.dart';

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
            ? 'Month from ${formatDayLabel(cycleStartedAt)}'
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

  /// Ported from src/lib/attendance/queries.ts's getClassAttendanceForMonth.
  Future<ClassMonthlyAttendance?> fetchMonthlyAttendance(
    SessionInfo session,
    String classId,
    String month, {
    int cycleOffset = 0,
  }) async {
    final cls = await supabase
        .from('classes')
        .select(
          'subject_id, group_name, schedule_days, billing_cycle_sessions, cycle_started_at',
        )
        .eq('id', classId)
        .eq('institute_id', session.instituteId)
        .maybeSingle();
    if (cls == null) return null;

    final subjectRow = await supabase
        .from('subjects')
        .select('name')
        .eq('id', cls['subject_id'] as String)
        .maybeSingle();
    final subject = subjectRow?['name'] as String? ?? 'Unknown';
    final groupName = cls['group_name'] as String?;
    final scheduleDays = (cls['schedule_days'] as List).cast<String>();
    final billingCycleSessions = cls['billing_cycle_sessions'] as int?;
    final classCycleStartedAt = cls['cycle_started_at'] as String?;

    List<String> sessionDates;
    BillingCycleProgress? cycleProgress;

    if (billingCycleSessions != null && classCycleStartedAt != null) {
      var cycleStart = classCycleStartedAt;
      for (var i = 0; i < cycleOffset; i++) {
        cycleStart = await _stepCycleStartBackward(
          classId,
          scheduleDays,
          cycleStart,
          billingCycleSessions,
        );
      }
      sessionDates = await _walkCycleSessionDates(
        classId,
        scheduleDays,
        cycleStart,
        billingCycleSessions,
      );

      // Bounded to this specific cycle's own dates (not "everything since
      // cycleStart") so a past, fully-closed cycle doesn't pick up a
      // later cycle's sessions too.
      final sessionsSoFarRows = sessionDates.isEmpty
          ? const <Map<String, dynamic>>[]
          : (await supabase
                    .from('attendance')
                    .select('date')
                    .eq('class_id', classId)
                    .inFilter('date', sessionDates))
                .cast<Map<String, dynamic>>();
      final distinctDates = sessionsSoFarRows
          .map((s) => s['date'] as String)
          .toSet();
      cycleProgress = BillingCycleProgress(
        sessionsRequired: billingCycleSessions,
        sessionsSoFar: distinctDates.length,
      );
    } else {
      final parts = month.split('-');
      final year = int.parse(parts[0]);
      final monthNum = int.parse(parts[1]);
      final daysInMonth = DateTime.utc(year, monthNum + 1, 0).day;
      final allDatesInMonth = <String>[];
      for (var day = 1; day <= daysInMonth; day++) {
        final d = DateTime.utc(year, monthNum, day);
        if (scheduleDays.contains(weekdayName(d))) {
          allDatesInMonth.add(
            '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}',
          );
        }
      }

      final cancellations = allDatesInMonth.isEmpty
          ? <Map<String, dynamic>>[]
          : (await supabase
                    .from('class_cancellations')
                    .select('date')
                    .eq('class_id', classId)
                    .inFilter('date', allDatesInMonth))
                .cast<Map<String, dynamic>>();
      final cancelledDates = cancellations
          .map((c) => c['date'] as String)
          .toSet();
      sessionDates = allDatesInMonth
          .where((d) => !cancelledDates.contains(d))
          .toList();
    }

    final enrollments = await supabase
        .from('enrollments')
        .select('id, student_id')
        .eq('class_id', classId)
        .eq('status', 'active');
    final enrollmentRows = (enrollments as List).cast<Map<String, dynamic>>();
    if (enrollmentRows.isEmpty) {
      return ClassMonthlyAttendance(
        classId: classId,
        subject: subject,
        groupName: groupName,
        month: month,
        sessionDates: sessionDates,
        students: const [],
        collectedThisMonth: 0,
        cycleProgress: cycleProgress,
        cycleOffset: cycleOffset,
      );
    }

    final studentIds = enrollmentRows
        .map((e) => e['student_id'] as String)
        .toList();

    final results = await Future.wait<dynamic>([
      supabase
          .from('users')
          .select('id, name, phone')
          .inFilter('id', studentIds),
      sessionDates.isEmpty
          ? Future<List<Map<String, dynamic>>>.value(<Map<String, dynamic>>[])
          : supabase
                .from('attendance')
                .select('enrollment_id, date, status')
                .eq('class_id', classId)
                .inFilter('date', sessionDates),
      supabase
          .from('payments')
          .select(
            'student_id, status, balance, month, amount_paid, cycle_started_at',
          )
          .eq('class_id', classId)
          .inFilter('student_id', studentIds),
    ]);

    final students = (results[0] as List).cast<Map<String, dynamic>>();
    final attendanceRows = (results[1] as List).cast<Map<String, dynamic>>();
    final payments = (results[2] as List).cast<Map<String, dynamic>>();

    final nameById = {
      for (final s in students) s['id'] as String: s['name'] as String,
    };
    final phoneById = {
      for (final s in students) s['id'] as String: s['phone'] as String,
    };
    final studentByEnrollment = {
      for (final e in enrollmentRows)
        e['id'] as String: e['student_id'] as String,
    };

    final statusByStudentDate = <String, Map<String, AttendanceStatus>>{};
    for (final a in attendanceRows) {
      final studentId = studentByEnrollment[a['enrollment_id']];
      if (studentId == null) continue;
      final rec = statusByStudentDate[studentId] ??= {};
      rec[a['date'] as String] = attendanceStatusFromString(
        a['status'] as String?,
      );
    }

    final paymentsByStudent = <String, List<Map<String, dynamic>>>{};
    for (final p in payments) {
      (paymentsByStudent[p['student_id'] as String] ??= []).add(p);
    }

    // Not meaningful for a session-cycle class's in-progress cycle — its
    // fee doesn't exist until the cycle closes.
    num collectedThisMonth = 0;
    if (cycleProgress == null) {
      for (final p in payments) {
        if (p['month'] == month) collectedThisMonth += p['amount_paid'] as num;
      }
    }

    final currentMonth = currentMonthInColombo();

    final rows = enrollmentRows.map((e) {
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

      final byDate = statusByStudentDate[studentId] ?? {};
      final statusByDate = <String, AttendanceStatus?>{
        for (final date in sessionDates) date: byDate[date],
      };

      return MonthlyAttendanceStudentRow(
        studentId: studentId,
        name: nameById[studentId] ?? 'Unknown',
        phone: phoneById[studentId] ?? '',
        hasFeeRecords: studentPayments.isNotEmpty,
        feeBalance: outstanding.fold<num>(
          0,
          (sum, p) => sum + (p['balance'] as num),
        ),
        feeIsOverdue: feeIsOverdue,
        statusByDate: statusByDate,
      );
    }).toList();

    return ClassMonthlyAttendance(
      classId: classId,
      subject: subject,
      groupName: groupName,
      month: month,
      sessionDates: sessionDates,
      students: rows,
      collectedThisMonth: collectedThisMonth,
      cycleProgress: cycleProgress,
      cycleOffset: cycleOffset,
    );
  }

  /// Ported from src/lib/attendance/queries.ts's walkCycleSessionDates —
  /// walks forward day-by-day from `from`, collecting scheduled (and not
  /// cancelled) session dates until there are `count` of them. Capped at
  /// 1000 iterations as a runaway guard.
  Future<List<String>> _walkCycleSessionDates(
    String classId,
    List<String> scheduleDays,
    String from,
    int count,
  ) async {
    final dates = <String>[];
    var d = DateTime.parse('${from}T00:00:00Z');
    for (var i = 0; dates.length < count && i < 1000; i++) {
      final dateStr = _isoDate(d);
      if (scheduleDays.contains(weekdayName(d))) {
        final cancellation = await supabase
            .from('class_cancellations')
            .select('id')
            .eq('class_id', classId)
            .eq('date', dateStr)
            .maybeSingle();
        if (cancellation == null) dates.add(dateStr);
      }
      d = d.add(const Duration(days: 1));
    }
    return dates;
  }

  /// Ported from src/lib/attendance/queries.ts's stepCycleStartBackward —
  /// the reverse of _walkCycleSessionDates, used to page backward through
  /// a session-cycle class's closed cycles since their boundaries aren't
  /// stored anywhere.
  Future<String> _stepCycleStartBackward(
    String classId,
    List<String> scheduleDays,
    String from,
    int count,
  ) async {
    final dates = <String>[];
    var d = DateTime.parse(
      '${from}T00:00:00Z',
    ).subtract(const Duration(days: 1));
    for (var i = 0; dates.length < count && i < 1000; i++) {
      final dateStr = _isoDate(d);
      if (scheduleDays.contains(weekdayName(d))) {
        final cancellation = await supabase
            .from('class_cancellations')
            .select('id')
            .eq('class_id', classId)
            .eq('date', dateStr)
            .maybeSingle();
        if (cancellation == null) dates.add(dateStr);
      }
      d = d.subtract(const Duration(days: 1));
    }
    return dates.isEmpty ? from : dates.last;
  }

  String _isoDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}
