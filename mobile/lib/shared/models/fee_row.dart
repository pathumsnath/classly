/// Mirrors src/lib/fees/queries.ts's FeeRow.
class FeeRow {
  final String id;
  final String studentId;
  final String studentName;
  final String studentPhone;
  final String classId;
  final String subject;
  final String? groupName;
  final String tutorName;
  final String month;
  final num amountDue;
  final num amountPaid;
  final num balance;
  final String status;
  final String? paidDate;
  final bool isOverdue;

  const FeeRow({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.studentPhone,
    required this.classId,
    required this.subject,
    required this.groupName,
    required this.tutorName,
    required this.month,
    required this.amountDue,
    required this.amountPaid,
    required this.balance,
    required this.status,
    required this.paidDate,
    required this.isOverdue,
  });
}
