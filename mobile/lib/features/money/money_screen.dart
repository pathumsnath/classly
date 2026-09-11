import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/labels/class_labels.dart';
import '../../core/time/colombo_time.dart';
import '../../shared/models/money.dart';
import '../../shared/widgets/income_trend_chart.dart';
import '../salaries/month_switcher.dart';
import 'money_providers.dart';

class MoneyScreen extends ConsumerStatefulWidget {
  const MoneyScreen({super.key});

  @override
  ConsumerState<MoneyScreen> createState() => _MoneyScreenState();
}

class _MoneyScreenState extends ConsumerState<MoneyScreen> {
  late String _month = currentMonthInColombo();

  @override
  Widget build(BuildContext context) {
    final currentMonth = currentMonthInColombo();
    final overviewAsync = ref.watch(moneyOverviewProvider(_month));
    final trendAsync = ref.watch(instituteIncomeTrendProvider(currentMonth));

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Money',
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            trendAsync.when(
              data: (points) => IncomeTrendChart(
                title: 'Income progress',
                data: [for (final p in points) (month: p.month, value: p.net)],
              ),
              loading: () => const SizedBox.shrink(),
              error: (_, _) => const SizedBox.shrink(),
            ),
            const SizedBox(height: 16),
            MonthSwitcher(
              month: _month,
              currentMonth: currentMonth,
              onChanged: (m) => setState(() => _month = m),
            ),
            const SizedBox(height: 16),
            overviewAsync.when(
              data: (overview) {
                if (overview == null) {
                  return const Center(
                    child: Text(
                      'Could not load overview.',
                      style: TextStyle(color: Colors.grey),
                    ),
                  );
                }
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _StatCard(
                            icon: Icons.account_balance_wallet,
                            label: 'Collected',
                            value: 'LKR ${formatAmount(overview.collected)}',
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _StatCard(
                            icon: Icons.schedule,
                            label: 'Pending',
                            value: 'LKR ${formatAmount(overview.pending)}',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _StatCard(
                            icon: Icons.error_outline,
                            label: 'Overdue (all-time)',
                            value: 'LKR ${formatAmount(overview.overdue)}',
                            valueColor: const Color(0xFFDC2626),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _StatCard(
                            icon: Icons.trending_up,
                            label: 'Collection rate',
                            value: '${overview.collectionRate.round()}%',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF2FF),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE0E7FF)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: const BoxDecoration(
                              color: Color(0xFFE0E7FF),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.balance,
                              color: Color(0xFF4F46E5),
                              size: 18,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Net (collected − tutor salaries owed)',
                                  style: TextStyle(
                                    color: Color(0xFF4338CA),
                                    fontSize: 12,
                                  ),
                                ),
                                Text(
                                  'LKR ${formatAmount(overview.netFigure)}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16,
                                    color: Color(0xFF312E81),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'PER CLASS',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (overview.perClass.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 16),
                        child: Text(
                          'No fee records this month.',
                          style: TextStyle(color: Colors.grey),
                        ),
                      )
                    else
                      for (final c in overview.perClass) ...[
                        _ClassMoneyCard(cls: c),
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
                  'Could not load overview.\n$err',
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

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
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
          Row(
            children: [
              Icon(icon, size: 15, color: Colors.grey),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }
}

class _ClassMoneyCard extends StatelessWidget {
  final ClassMoneySummary cls;
  const _ClassMoneyCard({required this.cls});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => context.push('/classes/${cls.classId}'),
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
              child: Text(
                cls.groupName != null
                    ? '${cls.subject} (${cls.groupName})'
                    : cls.subject,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            Text(
              '${cls.studentCount} students · LKR ${formatAmount(cls.collected)} · ${cls.collectionRate.round()}%',
              style: const TextStyle(color: Colors.grey, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
