import 'package:flutter/material.dart';
import '../../core/labels/class_labels.dart';

/// Ported from src/components/month-switcher.tsx — prev/next month
/// navigation, capped at the current month (can't view a salary month
/// that hasn't happened yet).
class MonthSwitcher extends StatelessWidget {
  final String month;
  final String currentMonth;
  final ValueChanged<String> onChanged;
  const MonthSwitcher({
    super.key,
    required this.month,
    required this.currentMonth,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isCurrent = month == currentMonth;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left),
            onPressed: () => onChanged(_shift(month, -1)),
          ),
          Text(
            formatMonthLabel(month),
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          IconButton(
            icon: Icon(
              Icons.chevron_right,
              color: isCurrent ? const Color(0xFFE5E7EB) : null,
            ),
            onPressed: isCurrent ? null : () => onChanged(_shift(month, 1)),
          ),
        ],
      ),
    );
  }

  static String _shift(String month, int delta) {
    final parts = month.split('-');
    var year = int.parse(parts[0]);
    var mon = int.parse(parts[1]) + delta;
    while (mon < 1) {
      mon += 12;
      year -= 1;
    }
    while (mon > 12) {
      mon -= 12;
      year += 1;
    }
    return '${year.toString().padLeft(4, '0')}-${mon.toString().padLeft(2, '0')}-01';
  }
}
