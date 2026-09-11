import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/labels/class_labels.dart';
import '../../core/time/colombo_time.dart';
import '../../shared/models/attendance_student.dart';
import '../../shared/models/monthly_attendance.dart';
import 'attendance_providers.dart';

const _statusColors = {
  AttendanceStatus.present: Color(0xFF16A34A),
  AttendanceStatus.absent: Color(0xFFDC2626),
  AttendanceStatus.late: Color(0xFFD97706),
};

const _statusBg = {
  AttendanceStatus.present: Color(0xFFDCFCE7),
  AttendanceStatus.absent: Color(0xFFFEE2E2),
  AttendanceStatus.late: Color(0xFFFEF9C3),
};

const _statusLetter = {
  AttendanceStatus.present: 'P',
  AttendanceStatus.absent: 'A',
  AttendanceStatus.late: 'L',
};

/// Tutor/owner read-only view — every enrolled student's attendance
/// across every session date this class had in the month, at a glance
/// instead of paging through one day at a time. Ported from
/// src/app/attendance/[classId]/monthly-attendance-grid.tsx.
class MonthlyAttendanceScreen extends ConsumerStatefulWidget {
  final String classId;
  const MonthlyAttendanceScreen({super.key, required this.classId});

  @override
  ConsumerState<MonthlyAttendanceScreen> createState() =>
      _MonthlyAttendanceScreenState();
}

class _MonthlyAttendanceScreenState
    extends ConsumerState<MonthlyAttendanceScreen> {
  late String _month = currentMonthInColombo();

  void _shiftMonth(int delta) {
    final parts = _month.split('-');
    var year = int.parse(parts[0]);
    var month = int.parse(parts[1]) + delta;
    while (month < 1) {
      month += 12;
      year -= 1;
    }
    while (month > 12) {
      month -= 12;
      year += 1;
    }
    setState(
      () => _month =
          '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}-01',
    );
  }

  @override
  Widget build(BuildContext context) {
    final dataAsync = ref.watch(
      classMonthlyAttendanceProvider((classId: widget.classId, month: _month)),
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: dataAsync.when(
          data: (d) => Text(
            d == null
                ? 'Attendance history'
                : (d.groupName != null
                      ? '${d.subject} (${d.groupName})'
                      : d.subject),
            style: const TextStyle(
              color: Colors.black,
              fontWeight: FontWeight.bold,
            ),
          ),
          loading: () => const Text(
            'Attendance history',
            style: TextStyle(color: Colors.black),
          ),
          error: (_, _) => const Text(
            'Attendance history',
            style: TextStyle(color: Colors.black),
          ),
        ),
      ),
      body: SafeArea(
        child: dataAsync.when(
          data: (data) {
            if (data == null) {
              return const Center(
                child: Text(
                  'Class not found.',
                  style: TextStyle(color: Colors.grey),
                ),
              );
            }
            if (data.isCycleBilled) {
              return const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    "Monthly view isn't available yet for this class's billing cycle.",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey),
                  ),
                ),
              );
            }

            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFFF3F4F6)),
                        ),
                        child: Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.chevron_left),
                              onPressed: () => _shiftMonth(-1),
                            ),
                            Text(
                              formatMonthLabel(_month),
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.chevron_right),
                              onPressed: () => _shiftMonth(1),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          'LKR ${formatAmount(data.collectedThisMonth)} collected',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF15803D),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: data.sessionDates.isEmpty
                      ? const Center(
                          child: Text(
                            'This class had no scheduled sessions this month.',
                            style: TextStyle(color: Colors.grey),
                          ),
                        )
                      : data.students.isEmpty
                      ? const Center(
                          child: Text(
                            'No students enrolled in this class yet.',
                            style: TextStyle(color: Colors.grey),
                          ),
                        )
                      : Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: SingleChildScrollView(
                            child: SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: _MonthlyGrid(
                                sessionDates: data.sessionDates,
                                students: data.students,
                              ),
                            ),
                          ),
                        ),
                ),
                const SizedBox(height: 16),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Could not load attendance history.\n$err',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MonthlyGrid extends StatelessWidget {
  final List<String> sessionDates;
  final List<MonthlyAttendanceStudentRow> students;
  const _MonthlyGrid({required this.sessionDates, required this.students});

  @override
  Widget build(BuildContext context) {
    return DataTable(
      headingRowColor: WidgetStateProperty.all(Colors.white),
      dataRowColor: WidgetStateProperty.all(Colors.white),
      columns: [
        const DataColumn(
          label: Text(
            'STUDENT',
            style: TextStyle(fontSize: 11, color: Colors.grey),
          ),
        ),
        for (final date in sessionDates)
          DataColumn(
            label: Text(
              formatDayLabel(date),
              style: const TextStyle(fontSize: 11, color: Colors.grey),
            ),
          ),
      ],
      rows: [
        for (final s in students)
          DataRow(
            cells: [
              DataCell(_StudentCell(student: s)),
              for (final date in sessionDates)
                DataCell(_StatusCell(status: s.statusByDate[date])),
            ],
          ),
      ],
    );
  }
}

class _StudentCell extends StatelessWidget {
  final MonthlyAttendanceStudentRow student;
  const _StudentCell({required this.student});

  @override
  Widget build(BuildContext context) {
    final Color bg;
    final Color fg;
    final String label;
    if (!student.hasFeeRecords) {
      bg = const Color(0xFFF3F4F6);
      fg = const Color(0xFF6B7280);
      label = 'No fee';
    } else if (student.feeBalance <= 0) {
      bg = const Color(0xFFDCFCE7);
      fg = const Color(0xFF15803D);
      label = 'Paid';
    } else if (student.feeIsOverdue) {
      bg = const Color(0xFFFEE2E2);
      fg = const Color(0xFFB91C1C);
      label = 'LKR ${formatAmount(student.feeBalance)} overdue';
    } else {
      bg = const Color(0xFFFEF9C3);
      fg = const Color(0xFFA16207);
      label = 'LKR ${formatAmount(student.feeBalance)} due';
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            student.name,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          ),
          Text(
            student.phone,
            style: const TextStyle(color: Colors.grey, fontSize: 11),
          ),
          const SizedBox(height: 2),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: fg,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusCell extends StatelessWidget {
  final AttendanceStatus? status;
  const _StatusCell({required this.status});

  @override
  Widget build(BuildContext context) {
    if (status == null) {
      return const Center(
        child: Text('–', style: TextStyle(color: Color(0xFFD1D5DB))),
      );
    }
    return Center(
      child: Container(
        width: 24,
        height: 24,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: _statusBg[status],
          shape: BoxShape.circle,
        ),
        child: Text(
          _statusLetter[status]!,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: _statusColors[status],
          ),
        ),
      ),
    );
  }
}
