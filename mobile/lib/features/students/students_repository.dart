import '../../core/session/session_info.dart';
import '../../core/supabase/client.dart';
import '../../shared/models/student_row.dart';

/// Direct RLS-scoped reads/writes, institute-wide for select — same
/// pattern as classes_repository.dart. Ported from
/// src/lib/people/queries.ts's listStudents/getPerson and
/// src/lib/classes/queries.ts's listClassesForStudent.
class StudentsRepository {
  Future<List<StudentRow>> fetchStudents(SessionInfo session) async {
    final links = await supabase
        .from('institute_students')
        .select('student_id, status')
        .eq('institute_id', session.instituteId)
        .order('created_at', ascending: true);

    final linkRows = (links as List).cast<Map<String, dynamic>>();
    if (linkRows.isEmpty) return [];

    final studentIds = linkRows.map((l) => l['student_id'] as String).toList();
    final people = await supabase
        .from('users')
        .select('id, name, phone, parent_phone')
        .inFilter('id', studentIds);
    final byId = {
      for (final p in (people as List).cast<Map<String, dynamic>>())
        p['id'] as String: p,
    };

    return linkRows
        .map((l) {
          final p = byId[l['student_id']];
          if (p == null) return null;
          return StudentRow(
            id: p['id'] as String,
            name: p['name'] as String,
            phone: p['phone'] as String,
            parentPhone: p['parent_phone'] as String?,
            status: l['status'] as String,
          );
        })
        .whereType<StudentRow>()
        .toList();
  }

  /// Direct RLS write — institute_students_update already restricts this
  /// to owner/admin_staff on their own institute (migration 0002), no
  /// privileged side effects the way enrollment mutations have.
  Future<void> setStudentStatus(
    SessionInfo session,
    String studentId,
    String status,
  ) async {
    await supabase
        .from('institute_students')
        .update({'status': status})
        .eq('institute_id', session.instituteId)
        .eq('student_id', studentId);
  }

  Future<StudentRow?> fetchStudent(
    SessionInfo session,
    String studentId,
  ) async {
    final link = await supabase
        .from('institute_students')
        .select('status')
        .eq('institute_id', session.instituteId)
        .eq('student_id', studentId)
        .maybeSingle();
    if (link == null) return null;

    final person = await supabase
        .from('users')
        .select('id, name, phone, parent_phone')
        .eq('id', studentId)
        .maybeSingle();
    if (person == null) return null;

    return StudentRow(
      id: person['id'] as String,
      name: person['name'] as String,
      phone: person['phone'] as String,
      parentPhone: person['parent_phone'] as String?,
      status: link['status'] as String,
    );
  }

  Future<num> fetchWalletBalance(SessionInfo session, String studentId) async {
    final rows = await supabase
        .from('wallet_transactions')
        .select('amount, type')
        .eq('institute_id', session.instituteId)
        .eq('student_id', studentId);

    num balance = 0;
    for (final r in (rows as List).cast<Map<String, dynamic>>()) {
      final amount = r['amount'] as num;
      balance += r['type'] == 'credit' ? amount : -amount;
    }
    return balance;
  }

  Future<List<EnrolledClassForStudent>> fetchClassesForStudent(
    SessionInfo session,
    String studentId,
  ) async {
    final enrollments = await supabase
        .from('enrollments')
        .select('class_id, status')
        .eq('student_id', studentId)
        .eq('institute_id', session.instituteId);

    final enrollmentRows = (enrollments as List).cast<Map<String, dynamic>>();
    if (enrollmentRows.isEmpty) return [];

    final classIds = enrollmentRows
        .map((e) => e['class_id'] as String)
        .toList();
    final classes = await supabase
        .from('classes')
        .select(
          'id, subject_id, tutor_id, grade, medium, schedule_days, schedule_start_time, schedule_end_time, fee_amount, group_name',
        )
        .inFilter('id', classIds);

    final classRows = (classes as List).cast<Map<String, dynamic>>();
    if (classRows.isEmpty) return [];

    final subjectIds = classRows
        .map((c) => c['subject_id'] as String)
        .toSet()
        .toList();
    final tutorIds = classRows
        .map((c) => c['tutor_id'] as String)
        .toSet()
        .toList();

    final results = await Future.wait([
      supabase.from('subjects').select('id, name').inFilter('id', subjectIds),
      supabase.from('users').select('id, name').inFilter('id', tutorIds),
    ]);
    final subjectNameById = {
      for (final s in (results[0] as List).cast<Map<String, dynamic>>())
        s['id'] as String: s['name'] as String,
    };
    final tutorNameById = {
      for (final t in (results[1] as List).cast<Map<String, dynamic>>())
        t['id'] as String: t['name'] as String,
    };
    final statusByClassId = {
      for (final e in enrollmentRows)
        e['class_id'] as String: e['status'] as String,
    };

    return classRows
        .map(
          (c) => EnrolledClassForStudent(
            id: c['id'] as String,
            subject: subjectNameById[c['subject_id']] ?? 'Unknown',
            groupName: c['group_name'] as String?,
            grade: c['grade'] as String?,
            medium: c['medium'] as String?,
            tutorName: tutorNameById[c['tutor_id']] ?? 'Unknown',
            scheduleDays: (c['schedule_days'] as List).cast<String>(),
            scheduleStartTime: c['schedule_start_time'] as String?,
            scheduleEndTime: c['schedule_end_time'] as String?,
            feeAmount: c['fee_amount'] as num,
            enrollmentStatus: statusByClassId[c['id']] ?? 'inactive',
          ),
        )
        .toList();
  }
}
