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

/// Mirrors src/lib/attendance/queries.ts's BillingCycleProgress.
class BillingCycleProgress {
  final int sessionsRequired;
  final int sessionsSoFar;
  const BillingCycleProgress({
    required this.sessionsRequired,
    required this.sessionsSoFar,
  });
}

/// Mirrors src/lib/attendance/queries.ts's ClassMonthlyAttendance.
class ClassMonthlyAttendance {
  final String classId;
  final String subject;
  final String? groupName;
  final String month;
  final List<String> sessionDates;
  final List<MonthlyAttendanceStudentRow> students;
  // Not meaningful (always 0) for a session-cycle class's in-progress
  // cycle — its fee doesn't exist until the cycle closes.
  final num collectedThisMonth;
  // Non-null only for a class on session-cycle billing — the calendar
  // grid doesn't apply to it (a cycle can straddle a month boundary), so
  // the screen shows cycle paging instead of month navigation.
  final BillingCycleProgress? cycleProgress;
  // How many cycles back from the current (open) one is being viewed —
  // 0 is current, 1 is the one before it, etc. Only meaningful alongside
  // cycleProgress.
  final int cycleOffset;

  const ClassMonthlyAttendance({
    required this.classId,
    required this.subject,
    required this.groupName,
    required this.month,
    required this.sessionDates,
    required this.students,
    required this.collectedThisMonth,
    required this.cycleProgress,
    required this.cycleOffset,
  });
}
