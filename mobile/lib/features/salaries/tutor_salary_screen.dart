import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/labels/class_labels.dart';
import '../../core/session/session_provider.dart';
import '../../core/time/colombo_time.dart';
import '../../shared/models/salary.dart';
import 'month_switcher.dart';
import 'salaries_providers.dart';

class TutorSalaryScreen extends ConsumerStatefulWidget {
  final String tutorId;
  final String? initialMonth;
  const TutorSalaryScreen({
    super.key,
    required this.tutorId,
    this.initialMonth,
  });

  @override
  ConsumerState<TutorSalaryScreen> createState() => _TutorSalaryScreenState();
}

class _TutorSalaryScreenState extends ConsumerState<TutorSalaryScreen> {
  late String _month = widget.initialMonth ?? currentMonthInColombo();
  bool _marking = false;
  final _removing = <String>{};

  Future<void> _markPaid(TutorSalary salary) async {
    final session = await ref.read(sessionInfoProvider.future);
    if (!mounted || session == null) return;
    setState(() => _marking = true);
    try {
      await ref
          .read(salariesRepositoryProvider)
          .markSalaryPaid(session, salary.tutorId, _month, salary.netTotal);
      ref.invalidate(
        tutorSalaryProvider((tutorId: widget.tutorId, month: _month)),
      );
      ref.invalidate(tutorSalariesProvider(_month));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Could not mark as paid.\n$e')));
      }
    } finally {
      if (mounted) setState(() => _marking = false);
    }
  }

  Future<void> _removeAdvance(TutorAdvanceRow advance) async {
    final session = await ref.read(sessionInfoProvider.future);
    if (!mounted || session == null) return;
    setState(() => _removing.add(advance.id));
    try {
      await ref
          .read(salariesRepositoryProvider)
          .deleteAdvance(session, advance.id);
      ref.invalidate(
        tutorSalaryProvider((tutorId: widget.tutorId, month: _month)),
      );
      ref.invalidate(tutorSalariesProvider(_month));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not remove advance.\n$e')),
        );
      }
    } finally {
      if (mounted) setState(() => _removing.remove(advance.id));
    }
  }

  Future<void> _recordAdvance() async {
    final amountController = TextEditingController();
    final reasonController = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Record advance'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: amountController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(labelText: 'Amount'),
            ),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(labelText: 'Reason'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Record'),
          ),
        ],
      ),
    );
    if (result != true) return;

    final amount = num.tryParse(amountController.text.trim());
    final reason = reasonController.text.trim();
    if (amount == null || amount <= 0) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Enter a valid amount.')));
      }
      return;
    }
    if (reason.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter a reason for the advance.')),
        );
      }
      return;
    }

    final session = await ref.read(sessionInfoProvider.future);
    if (!mounted || session == null) return;
    try {
      await ref
          .read(salariesRepositoryProvider)
          .recordAdvance(
            session,
            tutorId: widget.tutorId,
            month: _month,
            amount: amount,
            reason: reason,
          );
      ref.invalidate(
        tutorSalaryProvider((tutorId: widget.tutorId, month: _month)),
      );
      ref.invalidate(tutorSalariesProvider(_month));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not record advance.\n$e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentMonth = currentMonthInColombo();
    final salaryAsync = ref.watch(
      tutorSalaryProvider((tutorId: widget.tutorId, month: _month)),
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: salaryAsync.when(
          data: (s) => Text(
            s?.tutorName ?? 'Salary',
            style: const TextStyle(
              color: Colors.black,
              fontWeight: FontWeight.bold,
            ),
          ),
          loading: () =>
              const Text('Salary', style: TextStyle(color: Colors.black)),
          error: (_, _) =>
              const Text('Salary', style: TextStyle(color: Colors.black)),
        ),
      ),
      body: SafeArea(
        child: salaryAsync.when(
          data: (salary) {
            if (salary == null) {
              return const Center(
                child: Text(
                  'No salary data for this tutor.',
                  style: TextStyle(color: Colors.grey),
                ),
              );
            }
            final isPaid = salary.status == 'paid';

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                MonthSwitcher(
                  month: _month,
                  currentMonth: currentMonth,
                  onChanged: (m) => setState(() => _month = m),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFF3F4F6)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Income breakdown',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: isPaid
                                  ? const Color(0xFFDCFCE7)
                                  : const Color(0xFFF3F4F6),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              isPaid ? 'Paid' : 'Unpaid',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: isPaid
                                    ? const Color(0xFF15803D)
                                    : const Color(0xFF4B5563),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (salary.classes.isEmpty)
                        const Text(
                          'No classes assigned.',
                          style: TextStyle(color: Colors.grey),
                        )
                      else
                        for (final c in salary.classes) ...[
                          _ClassBreakdown(cls: c),
                          const SizedBox(height: 10),
                        ],
                      if (salary.advances.isNotEmpty) ...[
                        const Divider(height: 24),
                        const Text(
                          'ADVANCES TAKEN',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        for (final a in salary.advances) ...[
                          _AdvanceRow(
                            advance: a,
                            busy: _removing.contains(a.id),
                            onRemove: () => _removeAdvance(a),
                          ),
                          const SizedBox(height: 6),
                        ],
                      ],
                      const Divider(height: 24),
                      if (salary.advancesTotal > 0)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Gross total',
                                style: TextStyle(
                                  color: Colors.grey,
                                  fontSize: 13,
                                ),
                              ),
                              Text(
                                'LKR ${formatAmount(salary.total)}',
                                style: const TextStyle(
                                  color: Colors.grey,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              '${salary.advancesTotal > 0 ? 'Payable (after advances)' : 'Total'}: LKR ${formatAmount(salary.netTotal)}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          if (!isPaid)
                            _marking
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : TextButton(
                                    onPressed: () => _markPaid(salary),
                                    child: const Text('Mark as paid'),
                                  ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: _recordAdvance,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Record advance'),
                ),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Could not load salary.\n$err',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ClassBreakdown extends StatelessWidget {
  final ClassSalaryBreakdown cls;
  const _ClassBreakdown({required this.cls});

  @override
  Widget build(BuildContext context) {
    final title =
        '${cls.subject}${cls.groupName != null ? ' (${cls.groupName})' : ''}';
    final subtitle = '${formatGrade(cls.grade)} · ${formatMedium(cls.medium)}';

    if (cls.model == 'revenue_share' && cls.collectedFees != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$title (${formatAmount(cls.value)}% share)',
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          ),
          Text(
            subtitle,
            style: const TextStyle(color: Colors.grey, fontSize: 11),
          ),
          const SizedBox(height: 4),
          _row('Total income', 'LKR ${formatAmount(cls.collectedFees!)}'),
          if (cls.overdueReceived != null && cls.overdueReceived! > 0)
            _row(
              '— incl. carried forward from a past overdue month',
              'LKR ${formatAmount(cls.overdueReceived!)}',
              muted: true,
            ),
          _row(
            'Institute commission (${formatAmount(100 - cls.value)}%)',
            'LKR ${formatAmount(cls.collectedFees! - cls.amount)}',
          ),
          _row('Monthly salary', 'LKR ${formatAmount(cls.amount)}'),
          if (cls.outstandingFees != null && cls.outstandingFees! > 0)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Outstanding (unpaid) — your cut if collected',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFFB45309),
                          ),
                        ),
                        if (cls.outstandingCycleCount != null &&
                            cls.outstandingCycleCount! > 1)
                          Text(
                            'Spans ${cls.outstandingCycleCount} unpaid billing cycles, not one large bill',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFFD97706),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Text(
                    'LKR ${formatAmount(cls.outstandingFees!)} → LKR ${formatAmount(cls.outstandingFees! * cls.value / 100)}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFFB45309),
                    ),
                  ),
                ],
              ),
            ),
        ],
      );
    }

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$title (${cls.model.replaceAll('_', ' ')})',
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
              Text(
                subtitle,
                style: const TextStyle(color: Colors.grey, fontSize: 11),
              ),
            ],
          ),
        ),
        Text(
          'LKR ${formatAmount(cls.amount)}',
          style: const TextStyle(fontSize: 13),
        ),
      ],
    );
  }

  Widget _row(String label, String value, {bool muted = false}) {
    return Padding(
      padding: const EdgeInsets.only(left: 8, bottom: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: muted ? Colors.grey : const Color(0xFF4B5563),
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 12,
              color: muted ? Colors.grey : const Color(0xFF4B5563),
            ),
          ),
        ],
      ),
    );
  }
}

class _AdvanceRow extends StatelessWidget {
  final TutorAdvanceRow advance;
  final bool busy;
  final VoidCallback onRemove;
  const _AdvanceRow({
    required this.advance,
    required this.busy,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(advance.reason, style: const TextStyle(fontSize: 13)),
              Text(
                advance.recordedAt.substring(0, 10),
                style: const TextStyle(color: Colors.grey, fontSize: 11),
              ),
            ],
          ),
        ),
        Text(
          '− LKR ${formatAmount(advance.amount)}',
          style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 13),
        ),
        busy
            ? const Padding(
                padding: EdgeInsets.only(left: 8),
                child: SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            : TextButton(
                onPressed: onRemove,
                child: const Text('Remove', style: TextStyle(fontSize: 12)),
              ),
      ],
    );
  }
}
