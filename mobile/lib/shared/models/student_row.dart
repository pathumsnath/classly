/// Mirrors src/lib/people/queries.ts's StudentRow.
class StudentRow {
  final String id;
  final String name;
  final String phone;
  final String? parentPhone;
  final String status;

  const StudentRow({
    required this.id,
    required this.name,
    required this.phone,
    required this.parentPhone,
    required this.status,
  });

  StudentRow copyWith({String? status}) => StudentRow(
    id: id,
    name: name,
    phone: phone,
    parentPhone: parentPhone,
    status: status ?? this.status,
  );
}

/// Mirrors src/lib/classes/queries.ts's EnrolledClassRow — a student's
/// view of a class, with their own enrollment status attached.
class EnrolledClassForStudent {
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
  final String enrollmentStatus;

  const EnrolledClassForStudent({
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
    required this.enrollmentStatus,
  });
}
