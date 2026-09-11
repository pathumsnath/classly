import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/labels/class_labels.dart';
import '../../core/time/colombo_time.dart';
import '../../shared/models/attendance_student.dart';
import '../today/today_providers.dart';
import 'attendance_payment_sheet.dart';
import 'attendance_providers.dart';

const _statusColors = {
  AttendanceStatus.present: Color(0xFF16A34A),
  AttendanceStatus.absent: Color(0xFFDC2626),
  AttendanceStatus.late: Color(0xFFD97706),
};

const _statusBg = {
  AttendanceStatus.present: Color(0xFFF0FDF4),
  AttendanceStatus.absent: Color(0xFFFEF2F2),
  AttendanceStatus.late: Color(0xFFFFFBEB),
};

const _statusIcons = {
  AttendanceStatus.present: Icons.check_circle,
  AttendanceStatus.absent: Icons.cancel,
  AttendanceStatus.late: Icons.schedule,
};

// absent -> present -> late -> absent. A single tap does the most common
// thing (mark present), matching the web app's tap-to-cycle order.
const _nextStatus = {
  AttendanceStatus.absent: AttendanceStatus.present,
  AttendanceStatus.present: AttendanceStatus.late,
  AttendanceStatus.late: AttendanceStatus.absent,
};

typedef _SubmitResult = ({
  int present,
  int absent,
  int late,
  bool cycleCompleted,
});

class AttendanceScreen extends ConsumerStatefulWidget {
  final String classId;
  final String title;
  final String? subtitle;

  const AttendanceScreen({
    super.key,
    required this.classId,
    required this.title,
    this.subtitle,
  });

  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  final String _date = todayInColombo();

  // Local editable copy, seeded once from the fetched roster — the
  // provider stays the source of truth for the initial load/retry, but
  // toggles are local state until submit.
  List<AttendanceStudent>? _roster;
  bool _submitting = false;
  _SubmitResult? _result;

  void _toggle(int index) {
    setState(() {
      final student = _roster![index];
      _roster![index] = student.copyWith(status: _nextStatus[student.status]);
    });
  }

  void _markAllPresent() {
    setState(() {
      _roster = _roster!
          .map((s) => s.copyWith(status: AttendanceStatus.present))
          .toList();
    });
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final roster = _roster!;
      final cycleCompleted = await ref
          .read(attendanceRepositoryProvider)
          .submit(classId: widget.classId, date: _date, roster: roster);

      final counts = {for (final s in AttendanceStatus.values) s: 0};
      for (final s in roster) {
        counts[s.status] = counts[s.status]! + 1;
      }
      // The Today list's bucket for this class depends on whether
      // attendance now exists for today, so it needs to re-fetch.
      ref.invalidate(todaysClassesProvider);

      if (!mounted) return;
      setState(() {
        _result = (
          present: counts[AttendanceStatus.present]!,
          absent: counts[AttendanceStatus.absent]!,
          late: counts[AttendanceStatus.late]!,
          cycleCompleted: cycleCompleted,
        );
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _openPaymentSheet(AttendanceStudent student) async {
    await showAttendancePaymentSheet(
      context,
      ref,
      classId: widget.classId,
      date: _date,
      student: student,
    );
    // The sheet invalidates classRosterProvider on a successful payment —
    // pull the refreshed fee numbers into the local roster copy so the
    // badge updates without losing in-progress attendance taps.
    final refreshed = await ref.read(
      classRosterProvider((classId: widget.classId, date: _date)).future,
    );
    if (!mounted || _roster == null) return;
    final byId = {for (final s in refreshed) s.enrollmentId: s};
    setState(() {
      _roster = _roster!.map((s) {
        final updated = byId[s.enrollmentId];
        if (updated == null) return s;
        return updated.copyWith(status: s.status);
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final rosterAsync = ref.watch(
      classRosterProvider((classId: widget.classId, date: _date)),
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              widget.title,
              style: const TextStyle(
                color: Colors.black,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            if (widget.subtitle != null)
              Text(
                widget.subtitle!,
                style: const TextStyle(color: Colors.grey, fontSize: 12),
              ),
          ],
        ),
      ),
      body: SafeArea(
        child: rosterAsync.when(
          data: (loaded) {
            _roster ??= loaded;
            final roster = _roster!;

            if (_result != null) return _SubmittedView(result: _result!);

            if (roster.isEmpty) {
              return const Center(
                child: Text(
                  'No students enrolled in this class.',
                  style: TextStyle(color: Colors.grey),
                ),
              );
            }

            final presentCount = roster
                .where((s) => s.status == AttendanceStatus.present)
                .length;

            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Row(
                    children: [
                      Text(
                        '$presentCount of ${roster.length} present',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const Spacer(),
                      TextButton.icon(
                        onPressed: _markAllPresent,
                        icon: const Icon(Icons.done_all, size: 18),
                        label: const Text('Mark all present'),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    itemCount: roster.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) => _StudentRow(
                      student: roster[index],
                      onTap: () => _toggle(index),
                      onTapFeeBadge: () => _openPaymentSheet(roster[index]),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _submitting ? null : _submit,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF4F46E5),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _submitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Submit attendance'),
                    ),
                  ),
                ),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Could not load students.\n$err',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _StudentRow extends StatelessWidget {
  final AttendanceStudent student;
  final VoidCallback onTap;
  final VoidCallback onTapFeeBadge;
  const _StudentRow({
    required this.student,
    required this.onTap,
    required this.onTapFeeBadge,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  student.name,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              InkWell(
                onTap: onTap,
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: _statusBg[student.status],
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _statusColors[student.status]!.withValues(
                        alpha: 0.3,
                      ),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _statusIcons[student.status],
                        size: 16,
                        color: _statusColors[student.status],
                      ),
                      const SizedBox(width: 6),
                      Text(
                        student.status.name,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: _statusColors[student.status],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _FeeBadge(student: student, onTap: onTapFeeBadge),
        ],
      ),
    );
  }
}

class _FeeBadge extends StatelessWidget {
  final AttendanceStudent student;
  final VoidCallback onTap;
  const _FeeBadge({required this.student, required this.onTap});

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

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: fg,
          ),
        ),
      ),
    );
  }
}

class _SubmittedView extends StatelessWidget {
  final _SubmitResult result;
  const _SubmittedView({required this.result});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 40),
        const Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 48),
        const SizedBox(height: 12),
        Text(
          'Submitted: ${result.present} present, ${result.absent} absent, ${result.late} late.',
          textAlign: TextAlign.center,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        if (result.cycleCompleted) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFEEF2FF),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Text(
              "That was this cycle's final session — the fee for the next cycle has been billed.",
              style: TextStyle(color: Color(0xFF4338CA), fontSize: 13),
              textAlign: TextAlign.center,
            ),
          ),
        ],
        const SizedBox(height: 20),
        Center(
          child: TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Back to today'),
          ),
        ),
      ],
    );
  }
}
