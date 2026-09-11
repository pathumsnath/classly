enum AttendanceStatus { present, absent, late }

extension AttendanceStatusValue on AttendanceStatus {
  String get value => name;
}

/// Missing/unrecognized defaults to absent — same default the web app's
/// attendance form applies at render (`s.status ?? "absent"`), so a tutor
/// actively marks who showed up instead of starting everyone present.
AttendanceStatus attendanceStatusFromString(String? value) {
  return AttendanceStatus.values.firstWhere(
    (s) => s.name == value,
    orElse: () => AttendanceStatus.absent,
  );
}

/// Mirrors src/lib/attendance/queries.ts's OutstandingPayment — one of a
/// student's outstanding (pending/partial) fees for this specific class.
class OutstandingPayment {
  final String id;
  final String month;
  final num balance;
  final String label;

  const OutstandingPayment({
    required this.id,
    required this.month,
    required this.balance,
    required this.label,
  });
}

/// Mirrors src/lib/attendance/queries.ts's AttendanceStudentRow.
class AttendanceStudent {
  final String enrollmentId;
  final String studentId;
  final String name;
  final String phone;
  final AttendanceStatus status;
  final bool hasFeeRecords;
  final num feeBalance;
  final bool feeIsOverdue;
  final List<OutstandingPayment> outstandingPayments;
  final num walletBalance;

  const AttendanceStudent({
    required this.enrollmentId,
    required this.studentId,
    required this.name,
    required this.phone,
    required this.status,
    required this.hasFeeRecords,
    required this.feeBalance,
    required this.feeIsOverdue,
    required this.outstandingPayments,
    required this.walletBalance,
  });

  AttendanceStudent copyWith({AttendanceStatus? status}) => AttendanceStudent(
    enrollmentId: enrollmentId,
    studentId: studentId,
    name: name,
    phone: phone,
    status: status ?? this.status,
    hasFeeRecords: hasFeeRecords,
    feeBalance: feeBalance,
    feeIsOverdue: feeIsOverdue,
    outstandingPayments: outstandingPayments,
    walletBalance: walletBalance,
  );
}
