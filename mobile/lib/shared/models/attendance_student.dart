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

/// Mirrors src/lib/attendance/queries.ts's AttendanceStudentRow, minus the
/// fee/wallet fields — this screen is attendance-only for now.
class AttendanceStudent {
  final String enrollmentId;
  final String studentId;
  final String name;
  final AttendanceStatus status;

  const AttendanceStudent({
    required this.enrollmentId,
    required this.studentId,
    required this.name,
    required this.status,
  });

  AttendanceStudent copyWith({AttendanceStatus? status}) => AttendanceStudent(
    enrollmentId: enrollmentId,
    studentId: studentId,
    name: name,
    status: status ?? this.status,
  );
}
