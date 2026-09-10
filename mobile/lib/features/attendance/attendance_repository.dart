import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/supabase/client.dart';
import '../../shared/models/attendance_student.dart';

/// Roster + existing-status reads are direct RLS-scoped queries — the same
/// SELECT-only case today_repository already established as safe to port
/// straight to Dart. Submission itself stays behind the submit-attendance
/// Edge Function, which owns the billing side effects and the per-class
/// ownership check (see supabase/functions/submit-attendance).
class AttendanceRepository {
  Future<List<AttendanceStudent>> fetchRoster(
    String classId,
    String date,
  ) async {
    final enrollments = await supabase
        .from('enrollments')
        .select('id, student_id')
        .eq('class_id', classId)
        .eq('status', 'active');

    final rows = (enrollments as List).cast<Map<String, dynamic>>();
    if (rows.isEmpty) return [];

    final studentIds = rows
        .map((e) => e['student_id'] as String)
        .toSet()
        .toList();
    final enrollmentIds = rows.map((e) => e['id'] as String).toList();

    final results = await Future.wait([
      supabase.from('users').select('id, name').inFilter('id', studentIds),
      supabase
          .from('attendance')
          .select('enrollment_id, status')
          .eq('date', date)
          .inFilter('enrollment_id', enrollmentIds),
    ]);

    final students = (results[0] as List).cast<Map<String, dynamic>>();
    final attendanceRows = (results[1] as List).cast<Map<String, dynamic>>();

    final nameById = {
      for (final s in students) s['id'] as String: s['name'] as String,
    };
    final statusByEnrollment = {
      for (final a in attendanceRows)
        a['enrollment_id'] as String: attendanceStatusFromString(
          a['status'] as String?,
        ),
    };

    final list = rows.map((e) {
      final enrollmentId = e['id'] as String;
      return AttendanceStudent(
        enrollmentId: enrollmentId,
        studentId: e['student_id'] as String,
        name: nameById[e['student_id']] ?? 'Unknown',
        status: statusByEnrollment[enrollmentId] ?? AttendanceStatus.absent,
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
