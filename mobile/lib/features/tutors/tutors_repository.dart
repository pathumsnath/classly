import '../../core/session/session_info.dart';
import '../../core/supabase/client.dart';
import '../../shared/models/class_row.dart';
import '../../shared/models/tutor_row.dart';

/// Direct RLS-scoped reads/writes — same pattern as
/// students_repository.dart. Ported from src/lib/people/queries.ts's
/// listTutors/getPerson/getTutorForEdit and
/// src/lib/classes/queries.ts's listClassesForTutor (trimmed to the
/// fields ClassRow already carries — this month's collected/new-
/// enrollment counts aren't shown here, see Deferred in the commit).
class TutorsRepository {
  Future<List<TutorRow>> fetchTutors(SessionInfo session) async {
    final links = await supabase
        .from('institute_tutors')
        .select('tutor_id, status, commission_override_percent')
        .eq('institute_id', session.instituteId)
        .order('created_at', ascending: true);

    final linkRows = (links as List).cast<Map<String, dynamic>>();
    if (linkRows.isEmpty) return [];

    final tutorIds = linkRows.map((l) => l['tutor_id'] as String).toList();
    final people = await supabase
        .from('users')
        .select('id, name, phone, email')
        .inFilter('id', tutorIds);
    final byId = {
      for (final p in (people as List).cast<Map<String, dynamic>>())
        p['id'] as String: p,
    };

    return linkRows
        .map((l) {
          final p = byId[l['tutor_id']];
          if (p == null) return null;
          return TutorRow(
            id: p['id'] as String,
            name: p['name'] as String,
            phone: p['phone'] as String,
            email: p['email'] as String?,
            status: l['status'] as String,
            commissionOverridePercent: l['commission_override_percent'] as num?,
          );
        })
        .whereType<TutorRow>()
        .toList();
  }

  /// Direct RLS write — institute_tutors_update already restricts this to
  /// owner/admin_staff on their own institute (migration 0001).
  Future<void> setTutorStatus(
    SessionInfo session,
    String tutorId,
    String status,
  ) async {
    await supabase
        .from('institute_tutors')
        .update({'status': status})
        .eq('institute_id', session.instituteId)
        .eq('tutor_id', tutorId);
  }

  Future<TutorRow?> fetchTutor(SessionInfo session, String tutorId) async {
    final link = await supabase
        .from('institute_tutors')
        .select('status, commission_override_percent')
        .eq('institute_id', session.instituteId)
        .eq('tutor_id', tutorId)
        .maybeSingle();
    if (link == null) return null;

    final person = await supabase
        .from('users')
        .select('id, name, phone, email, auth_user_id')
        .eq('id', tutorId)
        .maybeSingle();
    if (person == null) return null;

    return TutorRow(
      id: person['id'] as String,
      name: person['name'] as String,
      phone: person['phone'] as String,
      email: person['email'] as String?,
      status: link['status'] as String,
      commissionOverridePercent: link['commission_override_percent'] as num?,
      hasLogin: person['auth_user_id'] != null,
    );
  }

  /// Two-step write mirroring src/lib/people/actions.ts's updateTutor —
  /// users_update and institute_tutors_update both already permit owner/
  /// admin_staff directly, no service-role client needed.
  Future<void> updateTutor(
    SessionInfo session, {
    required String tutorId,
    required String name,
    required String phone,
    required String? email,
    required num? commissionOverridePercent,
  }) async {
    await supabase
        .from('users')
        .update({'name': name, 'phone': phone, 'email': email})
        .eq('id', tutorId);
    await supabase
        .from('institute_tutors')
        .update({'commission_override_percent': commissionOverridePercent})
        .eq('institute_id', session.instituteId)
        .eq('tutor_id', tutorId);
  }

  Future<List<ClassRow>> fetchClassesForTutor(
    SessionInfo session,
    String tutorId,
  ) async {
    final classes = await supabase
        .from('classes')
        .select(
          'id, subject_id, tutor_id, grade, medium, schedule_days, schedule_start_time, schedule_end_time, fee_amount, group_name',
        )
        .eq('institute_id', session.instituteId)
        .eq('tutor_id', tutorId);

    final classRows = (classes as List).cast<Map<String, dynamic>>();
    if (classRows.isEmpty) return [];

    final subjectIds = classRows
        .map((c) => c['subject_id'] as String)
        .toSet()
        .toList();
    final classIds = classRows.map((c) => c['id'] as String).toList();

    final results = await Future.wait([
      supabase.from('subjects').select('id, name').inFilter('id', subjectIds),
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
    final studentCountByClass = <String, int>{};
    for (final e in (results[1] as List).cast<Map<String, dynamic>>()) {
      final classId = e['class_id'] as String;
      studentCountByClass[classId] = (studentCountByClass[classId] ?? 0) + 1;
    }

    final person = await supabase
        .from('users')
        .select('name')
        .eq('id', tutorId)
        .maybeSingle();
    final tutorName = person?['name'] as String? ?? 'Unknown';

    return classRows
        .map(
          (c) => ClassRow(
            id: c['id'] as String,
            subject: subjectNameById[c['subject_id']] ?? 'Unknown',
            groupName: c['group_name'] as String?,
            grade: c['grade'] as String?,
            medium: c['medium'] as String?,
            tutorName: tutorName,
            scheduleDays: (c['schedule_days'] as List).cast<String>(),
            scheduleStartTime: c['schedule_start_time'] as String?,
            scheduleEndTime: c['schedule_end_time'] as String?,
            feeAmount: c['fee_amount'] as num,
            studentCount: studentCountByClass[c['id']] ?? 0,
          ),
        )
        .toList();
  }
}
