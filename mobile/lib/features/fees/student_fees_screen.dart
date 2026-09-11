import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/labels/class_labels.dart';
import '../../core/session/session_provider.dart';
import '../../shared/models/fee_row.dart';
import '../students/students_providers.dart';
import 'fee_status.dart';
import 'fees_providers.dart';

class StudentFeesScreen extends ConsumerStatefulWidget {
  final String studentId;
  const StudentFeesScreen({super.key, required this.studentId});

  @override
  ConsumerState<StudentFeesScreen> createState() => _StudentFeesScreenState();
}

class _StudentFeesScreenState extends ConsumerState<StudentFeesScreen> {
  final _waiving = <String>{};

  Future<void> _waive(FeeRow fee) async {
    final session = await ref.read(sessionInfoProvider.future);
    if (!mounted || session == null) return;
    setState(() => _waiving.add(fee.id));
    try {
      await ref.read(feesRepositoryProvider).waiveFee(session, fee.id);
      ref.invalidate(studentFeesProvider(widget.studentId));
      await ref.read(studentFeesProvider(widget.studentId).future);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not waive this fee.\n$e')),
        );
      }
    } finally {
      if (mounted) setState(() => _waiving.remove(fee.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final studentAsync = ref.watch(studentDetailProvider(widget.studentId));
    final feesAsync = ref.watch(studentFeesProvider(widget.studentId));
    final walletAsync = ref.watch(feeWalletBalanceProvider(widget.studentId));

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: studentAsync.when(
          data: (s) => Text(
            s?.name ?? 'Fees',
            style: const TextStyle(
              color: Colors.black,
              fontWeight: FontWeight.bold,
            ),
          ),
          loading: () =>
              const Text('Fees', style: TextStyle(color: Colors.black)),
          error: (_, _) =>
              const Text('Fees', style: TextStyle(color: Colors.black)),
        ),
      ),
      body: SafeArea(
        child: feesAsync.when(
          data: (fees) {
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    studentAsync.when(
                      data: (s) => Text(
                        s?.phone ?? '',
                        style: const TextStyle(color: Colors.grey),
                      ),
                      loading: () => const SizedBox.shrink(),
                      error: (_, _) => const SizedBox.shrink(),
                    ),
                    walletAsync.when(
                      data: (balance) => balance > 0
                          ? Text(
                              'Wallet: LKR ${formatAmount(balance)}',
                              style: const TextStyle(
                                color: Color(0xFF4F46E5),
                                fontWeight: FontWeight.w600,
                              ),
                            )
                          : const SizedBox.shrink(),
                      loading: () => const SizedBox.shrink(),
                      error: (_, _) => const SizedBox.shrink(),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (fees.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: Text(
                        'No fees yet.',
                        style: TextStyle(color: Colors.grey),
                      ),
                    ),
                  )
                else
                  for (final f in fees) ...[
                    _FeeRowTile(
                      fee: f,
                      busy: _waiving.contains(f.id),
                      onWaive: () => _waive(f),
                    ),
                    const SizedBox(height: 8),
                  ],
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () =>
                        context.push('/fees/${widget.studentId}/record'),
                    icon: const Icon(Icons.payments, size: 18),
                    label: const Text('Record payment'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF4F46E5),
                      padding: const EdgeInsets.symmetric(vertical: 12),
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
                'Could not load fees.\n$err',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FeeRowTile extends StatelessWidget {
  final FeeRow fee;
  final bool busy;
  final VoidCallback onWaive;
  const _FeeRowTile({
    required this.fee,
    required this.busy,
    required this.onWaive,
  });

  @override
  Widget build(BuildContext context) {
    final canWaive = fee.status != 'paid' && fee.status != 'waived';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${fee.subject}${fee.groupName != null ? ' (${fee.groupName})' : ''} — ${fee.month.substring(0, 7)}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(
                  'Due LKR ${formatAmount(fee.amountDue)} · Paid LKR ${formatAmount(fee.amountPaid)} · Balance LKR ${formatAmount(fee.balance)}',
                  style: const TextStyle(color: Colors.grey, fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              FeeStatusBadge(status: fee.status, isOverdue: fee.isOverdue),
              if (canWaive)
                busy
                    ? const Padding(
                        padding: EdgeInsets.only(top: 4),
                        child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : TextButton(
                        onPressed: onWaive,
                        style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(0, 32),
                        ),
                        child: const Text(
                          'Waive',
                          style: TextStyle(fontSize: 12),
                        ),
                      ),
            ],
          ),
        ],
      ),
    );
  }
}
