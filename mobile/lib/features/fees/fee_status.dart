import 'package:flutter/material.dart';

const _monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/// Mirrors the web fees pages' formatMonth — "2026-09-01" -> "September 2026".
String formatFeeMonth(String month) {
  final parts = month.split('-');
  if (parts.length < 2) return month;
  final year = parts[0];
  final monthIndex = int.tryParse(parts[1]);
  if (monthIndex == null || monthIndex < 1 || monthIndex > 12) return month;
  return '${_monthNames[monthIndex - 1]} $year';
}

/// Mirrors the web fees pages' statusBadgeClass.
class FeeStatusBadge extends StatelessWidget {
  final String status;
  final bool isOverdue;
  const FeeStatusBadge({
    super.key,
    required this.status,
    required this.isOverdue,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    if (isOverdue) {
      bg = const Color(0xFFFEE2E2);
      fg = const Color(0xFFB91C1C);
    } else if (status == 'paid') {
      bg = const Color(0xFFDCFCE7);
      fg = const Color(0xFF15803D);
    } else if (status == 'partial') {
      bg = const Color(0xFFFEF9C3);
      fg = const Color(0xFFA16207);
    } else {
      bg = const Color(0xFFF3F4F6);
      fg = const Color(0xFF4B5563);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        isOverdue ? 'Overdue' : status,
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: fg),
      ),
    );
  }
}
