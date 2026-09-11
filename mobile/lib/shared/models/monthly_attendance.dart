import 'attendance_student.dart';

/// Mirrors src/lib/attendance/queries.ts's MonthlyAttendanceStudentRow.
class MonthlyAttendanceStudentRow {
  final String studentId;
  final String name;
  final String phone;
  final bool hasFeeRecords;
  final num feeBalance;
  final bool feeIsOverdue;
  // Keyed by date (YYYY-MM-DD); missing/null means no record for that
  // session yet (not marked, or in the future).
  final Map<String, AttendanceStatus?> statusByDate;

  const MonthlyAttendanceStudentRow({
    required this.studentId,
    required this.name,
    required this.phone,
    required this.hasFeeRecords,
    required this.feeBalance,
    required this.feeIsOverdue,
    required this.statusByDate,
  });
}

/// Mirrors src/lib/attendance/queries.ts's ClassMonthlyAttendance —
/// cycle-billed classes aren't supported by this view yet (see
/// AttendanceRepository.fetchMonthlyAttendance), flagged via
/// [isCycleBilled] so the screen can show a plain message instead of a
/// wrong or empty grid.
class ClassMonthlyAttendance {
  final String classId;
  final String subject;
  final String? groupName;
  final String month;
  final List<String> sessionDates;
  final List<MonthlyAttendanceStudentRow> students;
  final num collectedThisMonth;
  final bool isCycleBilled;

  const ClassMonthlyAttendance({
    required this.classId,
    required this.subject,
    required this.groupName,
    required this.month,
    required this.sessionDates,
    required this.students,
    required this.collectedThisMonth,
    required this.isCycleBilled,
  });
}
