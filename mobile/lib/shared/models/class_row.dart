/// Mirrors src/lib/classes/queries.ts's ClassListRow.
class ClassRow {
  final String id;
  final String subject;
  final String? groupName;
  final String? grade;
  final String? medium;
  final String tutorName;
  final List<String> scheduleDays;
  final String? scheduleStartTime;
  final String? scheduleEndTime;
  final num feeAmount;
  final int studentCount;

  const ClassRow({
    required this.id,
    required this.subject,
    required this.groupName,
    required this.grade,
    required this.medium,
    required this.tutorName,
    required this.scheduleDays,
    required this.scheduleStartTime,
    required this.scheduleEndTime,
    required this.feeAmount,
    required this.studentCount,
  });
}
