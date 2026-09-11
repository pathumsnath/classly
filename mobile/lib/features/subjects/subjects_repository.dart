import '../../core/session/session_info.dart';
import '../../core/supabase/client.dart';
import '../../shared/models/subject_row.dart';

/// Direct RLS-scoped reads/writes — subjects_insert/subjects_update both
/// already permit owner/admin_staff directly on their own institute
/// (migration 0004), so unlike enrollment/attendance mutations this
/// whole feature ports straight to Dart, no Edge Function needed.
/// Ported from src/lib/subjects/queries.ts and actions.ts.
class SubjectsRepository {
  Future<List<SubjectRow>> fetchSubjects(SessionInfo session) async {
    final rows = await supabase
        .from('subjects')
        .select('id, name, status')
        .eq('institute_id', session.instituteId)
        .order('name', ascending: true);

    return (rows as List)
        .cast<Map<String, dynamic>>()
        .map(
          (s) => SubjectRow(
            id: s['id'] as String,
            name: s['name'] as String,
            status: s['status'] as String,
          ),
        )
        .toList();
  }

  /// Mirrors addSubject's manual duplicate check — subjects has no unique
  /// constraint on (institute_id, name) at the database level.
  Future<void> addSubject(SessionInfo session, String name) async {
    final existing = await supabase
        .from('subjects')
        .select('id')
        .eq('institute_id', session.instituteId)
        .eq('name', name)
        .maybeSingle();
    if (existing != null) {
      throw Exception('This subject already exists.');
    }

    await supabase.from('subjects').insert({
      'institute_id': session.instituteId,
      'name': name,
    });
  }

  Future<void> setSubjectStatus(
    SessionInfo session,
    String subjectId,
    String status,
  ) async {
    await supabase
        .from('subjects')
        .update({'status': status})
        .eq('id', subjectId)
        .eq('institute_id', session.instituteId);
  }
}
