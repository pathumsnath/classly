enum ClassBucket { now, upcoming, done }

/// Mirrors src/lib/attendance/queries.ts's TodayClassRow.
class TodayClass {
  final String id;
  final String subject;
  final String? groupName;
  final String? grade;
  final String tutorName;
  final String? scheduleStartTime;
  final String? scheduleEndTime;
  final ClassBucket bucket;

  const TodayClass({
    required this.id,
    required this.subject,
    required this.groupName,
    required this.grade,
    required this.tutorName,
    required this.scheduleStartTime,
    required this.scheduleEndTime,
    required this.bucket,
  });
}
