import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/labels/class_labels.dart';
import '../../shared/models/fee_row.dart';
import 'fee_status.dart';
import 'fees_providers.dart';

const _methods = [
  (value: 'cash', label: 'Cash'),
  (value: 'bank_transfer', label: 'Bank transfer'),
  (value: 'wallet_credit', label: 'Wallet credit'),
  (value: 'other', label: 'Other'),
];

class RecordPaymentScreen extends ConsumerStatefulWidget {
  final String studentId;
  const RecordPaymentScreen({super.key, required this.studentId});

  @override
  ConsumerState<RecordPaymentScreen> createState() =>
      _RecordPaymentScreenState();
}

class _RecordPaymentScreenState extends ConsumerState<RecordPaymentScreen> {
  final _selected = <String>{};
  final _amountControllers = <String, TextEditingController>{};
  final _referenceController = TextEditingController();
  final _walletTopUpController = TextEditingController();
  String _method = 'cash';
  bool _sendReceipt = false;
  bool _seeded = false;
  bool _submitting = false;

  @override
  void dispose() {
    for (final c in _amountControllers.values) {
      c.dispose();
    }
    _referenceController.dispose();
    _walletTopUpController.dispose();
    super.dispose();
  }

  void _seed(List<FeeRow> outstanding) {
    if (_seeded) return;
    _seeded = true;
    for (final fee in outstanding) {
      _amountControllers[fee.id] = TextEditingController(
        text: formatAmount(fee.balance),
      );
    }
  }

  Future<void> _submit(List<FeeRow> outstanding) async {
    final walletTopUp = num.tryParse(_walletTopUpController.text.trim()) ?? 0;

    if (_selected.isEmpty) {
      if (walletTopUp <= 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Select at least one fee, or enter an amount to add to the wallet.',
            ),
          ),
        );
        return;
      }
    }

    final amounts = <String, num>{};
    for (final id in _selected) {
      final parsed = num.tryParse(_amountControllers[id]!.text.trim());
      if (parsed == null || parsed < 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Enter a valid amount for each selected fee.'),
          ),
        );
        return;
      }
      amounts[id] = parsed;
    }

    setState(() => _submitting = true);
    try {
      await ref
          .read(feesRepositoryProvider)
          .recordPayment(
            paymentIds: _selected.toList(),
            amounts: amounts,
            method: _method,
            reference: _referenceController.text.trim().isEmpty
                ? null
                : _referenceController.text.trim(),
            walletTopUp: walletTopUp,
            studentId: widget.studentId,
            sendReceipt: _sendReceipt,
          );
      ref.invalidate(studentFeesProvider(widget.studentId));
      ref.invalidate(feeWalletBalanceProvider(widget.studentId));
      ref.invalidate(feesListProvider);
      if (mounted) Navigator.of(context).pop();
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

  @override
  Widget build(BuildContext context) {
    final feesAsync = ref.watch(studentFeesProvider(widget.studentId));

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Record payment',
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
      ),
      body: SafeArea(
        child: feesAsync.when(
          data: (fees) {
            final outstanding = fees
                .where((f) => f.status == 'pending' || f.status == 'partial')
                .toList();
            _seed(outstanding);

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'OUTSTANDING FEES',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 8),
                if (outstanding.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Text(
                      'No outstanding fees — you can still park an amount as wallet credit below.',
                      style: TextStyle(color: Colors.grey),
                    ),
                  )
                else
                  for (final fee in outstanding) ...[
                    _SelectableFeeTile(
                      fee: fee,
                      selected: _selected.contains(fee.id),
                      amountController: _amountControllers[fee.id]!,
                      onToggle: (v) => setState(() {
                        if (v) {
                          _selected.add(fee.id);
                        } else {
                          _selected.remove(fee.id);
                        }
                      }),
                    ),
                    const SizedBox(height: 8),
                  ],
                const SizedBox(height: 16),
                const Text(
                  'Payment method',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF374151),
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      isExpanded: true,
                      value: _method,
                      items: [
                        for (final m in _methods)
                          DropdownMenuItem(
                            value: m.value,
                            child: Text(m.label),
                          ),
                      ],
                      onChanged: (v) => setState(() => _method = v ?? _method),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                _LabeledField(
                  label: 'Reference (optional)',
                  controller: _referenceController,
                ),
                const SizedBox(height: 12),
                _LabeledField(
                  label: 'Add to wallet as credit (optional)',
                  controller: _walletTopUpController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                ),
                const SizedBox(height: 8),
                CheckboxListTile(
                  value: _sendReceipt,
                  onChanged: (v) => setState(() => _sendReceipt = v ?? false),
                  title: const Text(
                    'Send SMS receipt',
                    style: TextStyle(fontSize: 14),
                  ),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _submitting ? null : () => _submit(outstanding),
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
                        : const Text('Record payment'),
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

class _SelectableFeeTile extends StatelessWidget {
  final FeeRow fee;
  final bool selected;
  final TextEditingController amountController;
  final ValueChanged<bool> onToggle;
  const _SelectableFeeTile({
    required this.fee,
    required this.selected,
    required this.amountController,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: selected ? const Color(0xFF4F46E5) : const Color(0xFFF3F4F6),
        ),
      ),
      child: Row(
        children: [
          Checkbox(value: selected, onChanged: (v) => onToggle(v ?? false)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${fee.subject}${fee.groupName != null ? ' (${fee.groupName})' : ''} — ${fee.month.substring(0, 7)}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                Text(
                  'Balance LKR ${formatAmount(fee.balance)}',
                  style: const TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],
            ),
          ),
          FeeStatusBadge(status: fee.status, isOverdue: fee.isOverdue),
          const SizedBox(width: 8),
          SizedBox(
            width: 90,
            child: TextField(
              controller: amountController,
              enabled: selected,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                isDense: true,
                contentPadding: EdgeInsets.symmetric(
                  vertical: 8,
                  horizontal: 8,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LabeledField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final TextInputType? keyboardType;
  const _LabeledField({
    required this.label,
    required this.controller,
    this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: Color(0xFF374151),
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(
              vertical: 10,
              horizontal: 12,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
          ),
        ),
      ],
    );
  }
}
