import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/models/fee_row.dart';
import 'fee_status.dart';
import 'fees_providers.dart';

class FeesListScreen extends ConsumerStatefulWidget {
  const FeesListScreen({super.key});

  @override
  ConsumerState<FeesListScreen> createState() => _FeesListScreenState();
}

class _FeesListScreenState extends ConsumerState<FeesListScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final feesAsync = ref.watch(feesListProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Fees',
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
      ),
      body: SafeArea(
        child: feesAsync.when(
          data: (fees) {
            if (fees.isEmpty) {
              return const Center(
                child: Text(
                  'No fee records yet.',
                  style: TextStyle(color: Colors.grey),
                ),
              );
            }
            final needle = _query.trim().toLowerCase();
            final visible = fees
                .where(
                  (f) =>
                      needle.isEmpty ||
                      f.studentName.toLowerCase().contains(needle) ||
                      f.studentPhone.contains(needle),
                )
                .toList();

            return RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(feesListProvider);
                await ref.read(feesListProvider.future);
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: [
                  TextField(
                    onChanged: (v) => setState(() => _query = v),
                    decoration: InputDecoration(
                      hintText: 'Search student by name or phone',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(
                        vertical: 0,
                        horizontal: 12,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (visible.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        'No matching fees.',
                        style: const TextStyle(color: Colors.grey),
                      ),
                    )
                  else
                    for (final f in visible) ...[
                      _FeeCard(fee: f),
                      const SizedBox(height: 8),
                    ],
                ],
              ),
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

class _FeeCard extends StatelessWidget {
  final FeeRow fee;
  const _FeeCard({required this.fee});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => context.push('/fees/${fee.studentId}'),
      child: Container(
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
                    fee.studentName,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    '${fee.subject}${fee.groupName != null ? ' (${fee.groupName})' : ''} · ${formatFeeMonth(fee.month)} · LKR ${fee.balance} due',
                    style: const TextStyle(color: Colors.grey, fontSize: 13),
                  ),
                ],
              ),
            ),
            FeeStatusBadge(status: fee.status, isOverdue: fee.isOverdue),
          ],
        ),
      ),
    );
  }
}
