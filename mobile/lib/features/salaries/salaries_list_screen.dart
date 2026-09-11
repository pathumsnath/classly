import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/labels/class_labels.dart';
import '../../core/time/colombo_time.dart';
import '../../shared/models/salary.dart';
import 'month_switcher.dart';
import 'salaries_providers.dart';

class SalariesListScreen extends ConsumerStatefulWidget {
  const SalariesListScreen({super.key});

  @override
  ConsumerState<SalariesListScreen> createState() => _SalariesListScreenState();
}

class _SalariesListScreenState extends ConsumerState<SalariesListScreen> {
  late String _month = currentMonthInColombo();
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final currentMonth = currentMonthInColombo();
    final salariesAsync = ref.watch(tutorSalariesProvider(_month));

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Tutor Salaries',
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            MonthSwitcher(
              month: _month,
              currentMonth: currentMonth,
              onChanged: (m) => setState(() => _month = m),
            ),
            const SizedBox(height: 16),
            salariesAsync.when(
              data: (salaries) {
                if (salaries.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: Text(
                        "No salary figures yet — these appear once fee and attendance data exists for your tutors' classes.",
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey),
                      ),
                    ),
                  );
                }

                final totalPaid = salaries
                    .where((s) => s.status == 'paid')
                    .fold<num>(0, (sum, s) => sum + s.netTotal);
                final totalUnpaid = salaries
                    .where((s) => s.status != 'paid')
                    .fold<num>(0, (sum, s) => sum + s.netTotal);
                final needle = _query.trim().toLowerCase();
                final visible = salaries
                    .where((s) => s.tutorName.toLowerCase().contains(needle))
                    .toList();

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _SummaryCard(
                            label: 'Paid',
                            amount: totalPaid,
                            color: const Color(0xFF15803D),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _SummaryCard(
                            label: 'Still to pay',
                            amount: totalUnpaid,
                            color: const Color(0xFF111827),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      onChanged: (v) => setState(() => _query = v),
                      decoration: InputDecoration(
                        hintText: 'Search tutors…',
                        prefixIcon: const Icon(Icons.search, size: 20),
                        filled: true,
                        fillColor: Colors.white,
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: 0,
                          horizontal: 12,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                            color: Color(0xFFE5E7EB),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (visible.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(
                          'No tutors match "$_query".',
                          style: const TextStyle(color: Colors.grey),
                        ),
                      )
                    else
                      for (final s in visible) ...[
                        _SalaryCard(salary: s, month: _month),
                        const SizedBox(height: 8),
                      ],
                  ],
                );
              },
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (err, _) => Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Could not load salaries.\n$err',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String label;
  final num amount;
  final Color color;
  const _SummaryCard({
    required this.label,
    required this.amount,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Colors.grey,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'LKR ${formatAmount(amount)}',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _SalaryCard extends StatelessWidget {
  final TutorSalary salary;
  final String month;
  const _SalaryCard({required this.salary, required this.month});

  @override
  Widget build(BuildContext context) {
    final rate = salary.revenueShareRate;
    final isPaid = salary.status == 'paid';
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => context.push('/salaries/${salary.tutorId}?month=$month'),
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
                    salary.tutorName,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    '${salary.classes.length} class(es)${rate != null ? ' · ${formatAmount(rate)}% share' : ''}',
                    style: const TextStyle(color: Colors.grey, fontSize: 13),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  'LKR ${formatAmount(salary.netTotal)}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
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
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: isPaid
                          ? const Color(0xFF15803D)
                          : const Color(0xFF4B5563),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
