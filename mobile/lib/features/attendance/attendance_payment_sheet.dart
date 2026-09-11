import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/labels/class_labels.dart';
import '../../shared/models/attendance_student.dart';
import '../fees/fees_providers.dart';
import 'attendance_providers.dart';

const _methods = [
  (value: 'cash', label: 'Cash'),
  (value: 'bank_transfer', label: 'Bank transfer'),
  (value: 'other', label: 'Other'),
];

/// FR-5.6 on mobile — record a payment inline from the attendance roster,
/// scoped to just this one class's outstanding months. Mirrors
/// src/app/attendance/[classId]/payment-sheet.tsx: same fields, same
/// record-payment Edge Function, all outstanding months checked by
/// default so a student behind on 2-3 months settles in one submit.
Future<void> showAttendancePaymentSheet(
  BuildContext context,
  WidgetRef ref, {
  required String classId,
  required String date,
  required AttendanceStudent student,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: _AttendancePaymentSheetContent(
        classId: classId,
        date: date,
        student: student,
      ),
    ),
  );
}

class _AttendancePaymentSheetContent extends ConsumerStatefulWidget {
  final String classId;
  final String date;
  final AttendanceStudent student;
  const _AttendancePaymentSheetContent({
    required this.classId,
    required this.date,
    required this.student,
  });

  @override
  ConsumerState<_AttendancePaymentSheetContent> createState() =>
      _AttendancePaymentSheetContentState();
}

class _AttendancePaymentSheetContentState
    extends ConsumerState<_AttendancePaymentSheetContent> {
  late final Set<String> _selected = widget.student.outstandingPayments
      .map((p) => p.id)
      .toSet();
  late final Map<String, TextEditingController> _amountControllers = {
    for (final p in widget.student.outstandingPayments)
      p.id: TextEditingController(text: formatAmount(p.balance)),
  };
  final _referenceController = TextEditingController();
  final _walletTopUpController = TextEditingController();
  String _method = 'cash';
  DateTime _paidDate = DateTime.now();
  bool _sendReceipt = false;
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

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _paidDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (picked != null) setState(() => _paidDate = picked);
  }

  Future<void> _submit() async {
    final walletTopUp = num.tryParse(_walletTopUpController.text.trim()) ?? 0;
    if (_selected.isEmpty && walletTopUp <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Select at least one fee, or enter an amount to add to the wallet.',
          ),
        ),
      );
      return;
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
      final paidDateStr =
          '${_paidDate.year.toString().padLeft(4, '0')}-${_paidDate.month.toString().padLeft(2, '0')}-${_paidDate.day.toString().padLeft(2, '0')}';
      await ref
          .read(feesRepositoryProvider)
          .recordPayment(
            paymentIds: _selected.toList(),
            amounts: amounts,
            method: _method,
            reference: _referenceController.text.trim().isEmpty
                ? null
                : _referenceController.text.trim(),
            paidDate: paidDateStr,
            walletTopUp: walletTopUp,
            studentId: widget.student.studentId,
            sendReceipt: _sendReceipt,
          );
      ref.invalidate(
        classRosterProvider((classId: widget.classId, date: widget.date)),
      );
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
    final student = widget.student;
    final canUseWalletCredit = student.walletBalance > 0;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5E7EB),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Record payment — ${student.name}',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        student.phone,
                        style: const TextStyle(
                          color: Colors.grey,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 12),
            for (final p in student.outstandingPayments) ...[
              Row(
                children: [
                  Checkbox(
                    value: _selected.contains(p.id),
                    onChanged: (v) => setState(() {
                      if (v == true) {
                        _selected.add(p.id);
                      } else {
                        _selected.remove(p.id);
                      }
                    }),
                  ),
                  Expanded(
                    child: Text(p.label, style: const TextStyle(fontSize: 14)),
                  ),
                  SizedBox(
                    width: 90,
                    child: TextField(
                      controller: _amountControllers[p.id],
                      enabled: _selected.contains(p.id),
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      textAlign: TextAlign.right,
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
            ],
            const SizedBox(height: 12),
            const Text(
              'Method',
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
                      DropdownMenuItem(value: m.value, child: Text(m.label)),
                    DropdownMenuItem(
                      value: 'wallet_credit',
                      enabled: canUseWalletCredit,
                      child: Text(
                        'Wallet credit (LKR ${formatAmount(student.walletBalance)} available)',
                        style: TextStyle(
                          color: canUseWalletCredit ? null : Colors.grey,
                        ),
                      ),
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
            Text(
              'Date received',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF374151),
              ),
            ),
            const SizedBox(height: 6),
            InkWell(
              onTap: _pickDate,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  vertical: 10,
                  horizontal: 12,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Row(
                  children: [
                    Text(
                      '${_paidDate.year.toString().padLeft(4, '0')}-${_paidDate.month.toString().padLeft(2, '0')}-${_paidDate.day.toString().padLeft(2, '0')}',
                    ),
                    const Spacer(),
                    const Icon(
                      Icons.calendar_today,
                      size: 16,
                      color: Colors.grey,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            _LabeledField(
              label: 'Add extra to wallet (optional)',
              controller: _walletTopUpController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              "Paid more than what's due? Park the rest here.",
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
            const SizedBox(height: 8),
            CheckboxListTile(
              value: _sendReceipt,
              onChanged: (v) => setState(() => _sendReceipt = v ?? false),
              title: const Text(
                'Send SMS receipt to parent',
                style: TextStyle(fontSize: 14),
              ),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
            ),
            const SizedBox(height: 16),
            SizedBox(
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
                    : const Text('Record payment'),
              ),
            ),
          ],
        ),
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
