import '../../core/session/session_info.dart';
import '../../core/supabase/client.dart';
import '../../shared/models/class_detail.dart';
import '../../shared/models/class_row.dart';

/// Direct RLS-scoped reads, institute-wide (classes/enrollments/users all
/// carry the same institute-wide select policy the rest of the app
/// already relies on — see today_repository.dart's note on this).
/// Ported from src/lib/classes/queries.ts's listClasses/getClass/
/// listEnrolledStudents.
class ClassesRepository {
  Future<List<ClassRow>> fetchClasses(SessionInfo session) async {
    final classes = await supabase
        .from('classes')
        .select(
          'id, subject_id, tutor_id, grade, medium, schedule_days, schedule_start_time, schedule_end_time, fee_amount, group_name',
        )
        .eq('institute_id', session.instituteId)
        .order('created_at', ascending: true);

    final rows = (classes as List).cast<Map<String, dynamic>>();
    if (rows.isEmpty) return [];

    final subjectIds = rows
        .map((c) => c['subject_id'] as String)
        .toSet()
        .toList();
    final tutorIds = rows.map((c) => c['tutor_id'] as String).toSet().toList();
    final classIds = rows.map((c) => c['id'] as String).toList();

    final results = await Future.wait([
      supabase.from('subjects').select('id, name').inFilter('id', subjectIds),
      supabase.from('users').select('id, name').inFilter('id', tutorIds),
      supabase
          .from('enrollments')
          .select('class_id')
          .eq('status', 'active')
          .inFilter('class_id', classIds),
    ]);

    final subjectNameById = {
      for (final s in (results[0] as List).cast<Map<String, dynamic>>())
        s['id'] as String: s['name'] as String,
    };
    final tutorNameById = {
      for (final t in (results[1] as List).cast<Map<String, dynamic>>())
        t['id'] as String: t['name'] as String,
    };
    final studentCountByClass = <String, int>{};
    for (final e in (results[2] as List).cast<Map<String, dynamic>>()) {
      final classId = e['class_id'] as String;
      studentCountByClass[classId] = (studentCountByClass[classId] ?? 0) + 1;
    }

    return rows
        .map(
          (c) => ClassRow(
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
            studentCount: studentCountByClass[c['id']] ?? 0,
          ),
        )
        .toList();
  }

  Future<ClassDetail?> fetchClassDetail(
    SessionInfo session,
    String classId,
  ) async {
    final cls = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .eq('institute_id', session.instituteId)
        .maybeSingle();
    if (cls == null) return null;

    final results = await Future.wait([
      supabase
          .from('subjects')
          .select('id, name')
          .eq('id', cls['subject_id'] as String)
          .maybeSingle(),
      supabase
          .from('users')
          .select('id, name')
          .eq('id', cls['tutor_id'] as String)
          .maybeSingle(),
    ]);
    final subject = results[0];
    final tutor = results[1];

    return ClassDetail(
      id: cls['id'] as String,
      subject: subject?['name'] as String? ?? 'Unknown',
      groupName: cls['group_name'] as String?,
      grade: cls['grade'] as String?,
      medium: cls['medium'] as String?,
      tutorId: cls['tutor_id'] as String,
      tutorName: tutor?['name'] as String? ?? 'Unknown',
      scheduleDays: (cls['schedule_days'] as List).cast<String>(),
      scheduleStartTime: cls['schedule_start_time'] as String?,
      scheduleEndTime: cls['schedule_end_time'] as String?,
      feeAmount: cls['fee_amount'] as num,
      room: cls['room'] as String?,
      tutorPaymentModel: cls['tutor_payment_model'] as String,
      tutorPaymentValue: cls['tutor_payment_value'] as num,
    );
  }

  Future<List<EnrolledStudent>> fetchEnrolledStudents(String classId) async {
    final enrollments = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_id', classId)
        .eq('status', 'active');
    final studentIds = (enrollments as List)
        .cast<Map<String, dynamic>>()
        .map((e) => e['student_id'] as String)
        .toList();
    if (studentIds.isEmpty) return [];

    final students = await supabase
        .from('users')
        .select('id, name, phone')
        .inFilter('id', studentIds);
    return (students as List)
        .cast<Map<String, dynamic>>()
        .map(
          (s) => EnrolledStudent(
            id: s['id'] as String,
            name: s['name'] as String,
            phone: s['phone'] as String,
            status: 'active',
          ),
        )
        .toList();
  }

  /// Ported from src/lib/institute/queries.ts's getRevenueShareCommissionPercent.
  Future<num> fetchCommissionPercent(SessionInfo session) async {
    final row = await supabase
        .from('institutes')
        .select('revenue_share_commission_percent')
        .eq('id', session.instituteId)
        .single();
    return row['revenue_share_commission_percent'] as num? ?? 25;
  }
}
