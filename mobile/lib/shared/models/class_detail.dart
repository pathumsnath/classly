/// Mirrors src/lib/classes/queries.ts's ClassDetail.
class ClassDetail {
  final String id;
  final String subject;
  final String subjectId;
  final String? groupName;
  final String? grade;
  final String? medium;
  final String tutorId;
  final String tutorName;
  final List<String> scheduleDays;
  final String? scheduleStartTime;
  final String? scheduleEndTime;
  final num feeAmount;
  final String? room;
  final int? maxStudents;
  final String tutorPaymentModel;
  final num tutorPaymentValue;
  final int? billingCycleSessions;
  final String? cycleStartedAt;

  const ClassDetail({
    required this.id,
    required this.subject,
    required this.subjectId,
    required this.groupName,
    required this.grade,
    required this.medium,
    required this.tutorId,
    required this.tutorName,
    required this.scheduleDays,
    required this.scheduleStartTime,
    required this.scheduleEndTime,
    required this.feeAmount,
    required this.room,
    required this.maxStudents,
    required this.tutorPaymentModel,
    required this.tutorPaymentValue,
    required this.billingCycleSessions,
    required this.cycleStartedAt,
  });
}

/// Mirrors src/lib/classes/queries.ts's EnrolledStudentRow.
class EnrolledStudent {
  final String id;
  final String name;
  final String phone;
  final String status;

  const EnrolledStudent({
    required this.id,
    required this.name,
    required this.phone,
    required this.status,
  });
}
