import '../../core/session/session_info.dart';
import '../../core/supabase/client.dart';
import '../../core/time/colombo_time.dart';
import '../../shared/models/today_class.dart';

/// Direct RLS-scoped read — no Edge Function needed, this is exactly the
/// SELECT-only case the plan calls out as safe to port straight to Dart.
/// Ported from src/lib/attendance/queries.ts's getTodaysClasses.
///
/// RLS on `classes` is institute-wide with no role filter (see the plan's
/// "Tutor scoping must be re-implemented app-side" note) — a tutor is
/// restricted to their own classes here explicitly, the same way the web
/// app's query layer does it, not by RLS.
class TodayRepository {
  Future<List<TodayClass>> fetchTodaysClasses(
    SessionInfo session, {
    DateTime? forDate,
  }) async {
    final now = forDate ?? colomboNow();
    final weekday = weekdayName(now);
    final date = todayInColombo();

    var classesQuery = supabase
        .from('classes')
        .select(
          'id, subject_id, tutor_id, grade, schedule_start_time, schedule_end_time, schedule_days, group_name',
        )
        .eq('institute_id', session.instituteId);
    if (session.isTutor) {
      classesQuery = classesQuery.eq('tutor_id', session.userId);
    }
    final classes = await classesQuery;

    final todays = (classes as List)
        .cast<Map<String, dynamic>>()
        .where(
          (c) => (c['schedule_days'] as List).cast<String>().contains(weekday),
        )
        .toList();
    if (todays.isEmpty) return [];

    final classIds = todays.map((c) => c['id'] as String).toList();
    final subjectIds = todays
        .map((c) => c['subject_id'] as String)
        .toSet()
        .toList();
    final tutorIds = todays
        .map((c) => c['tutor_id'] as String)
        .toSet()
        .toList();

    final results = await Future.wait([
      supabase
          .from('class_cancellations')
          .select('class_id')
          .eq('date', date)
          .inFilter('class_id', classIds),
      supabase
          .from('attendance')
          .select('class_id')
          .eq('date', date)
          .inFilter('class_id', classIds),
      supabase.from('subjects').select('id, name').inFilter('id', subjectIds),
      supabase.from('users').select('id, name').inFilter('id', tutorIds),
    ]);

    final cancellations = (results[0] as List).cast<Map<String, dynamic>>();
    final attendanceRows = (results[1] as List).cast<Map<String, dynamic>>();
    final subjects = (results[2] as List).cast<Map<String, dynamic>>();
    final tutors = (results[3] as List).cast<Map<String, dynamic>>();

    final subjectNameById = {
      for (final s in subjects) s['id'] as String: s['name'] as String,
    };
    final tutorNameById = {
      for (final t in tutors) t['id'] as String: t['name'] as String,
    };
    final doneSet = <String>{
      ...cancellations.map((c) => c['class_id'] as String),
      ...attendanceRows.map((a) => a['class_id'] as String),
    };

    final nowMinutes = now.hour * 60 + now.minute;

    final rows = todays.map((c) {
      final id = c['id'] as String;
      final startTime = c['schedule_start_time'] as String?;

      ClassBucket bucket = ClassBucket.upcoming;
      if (doneSet.contains(id)) {
        bucket = ClassBucket.done;
      } else if (startTime != null) {
        final parts = startTime.split(':');
        final h = int.parse(parts[0]);
        final m = int.parse(parts[1]);
        bucket = nowMinutes >= h * 60 + m
            ? ClassBucket.now
            : ClassBucket.upcoming;
      }

      return TodayClass(
        id: id,
        subject: subjectNameById[c['subject_id']] ?? 'Unknown',
        groupName: c['group_name'] as String?,
        grade: c['grade'] as String?,
        tutorName: tutorNameById[c['tutor_id']] ?? 'Unknown',
        scheduleStartTime: startTime,
        scheduleEndTime: c['schedule_end_time'] as String?,
        bucket: bucket,
      );
    }).toList();

    rows.sort(
      (a, b) =>
          (a.scheduleStartTime ?? '').compareTo(b.scheduleStartTime ?? ''),
    );
    return rows;
  }
}
