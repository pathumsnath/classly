// Mirrors src/lib/classes/labels.ts — same option lists and formatting so
// a grade/medium reads identically on mobile and web.

class GradeOption {
  final String value;
  final String label;
  const GradeOption(this.value, this.label);
}

final List<GradeOption> gradeOptions = [
  for (var n = 1; n <= 13; n++) GradeOption('grade_$n', 'Grade $n'),
  const GradeOption('ol', 'O/L'),
  const GradeOption('al', 'A/L'),
];

const mediumOptions = [
  GradeOption('sinhala', 'Sinhala'),
  GradeOption('english', 'English'),
  GradeOption('tamil', 'Tamil'),
];

String formatGrade(String? grade) {
  if (grade == null) return '—';
  return gradeOptions
      .firstWhere(
        (g) => g.value == grade,
        orElse: () => const GradeOption('', '—'),
      )
      .label;
}

String formatMedium(String? medium) {
  if (medium == null) return '—';
  final label = mediumOptions
      .firstWhere(
        (m) => m.value == medium,
        orElse: () => const GradeOption('', ''),
      )
      .label;
  return label.isEmpty ? '—' : '$label medium';
}

/// Schedule times come back from Postgres as "HH:MM:SS" — trim the
/// seconds, which are never set meaningfully for a class's schedule.
String formatTime(String? time) {
  if (time == null) return '';
  return time.length >= 5 ? time.substring(0, 5) : time;
}

/// Drops a trailing ".0" so a whole-number amount (e.g. Postgres numeric
/// 1000.0) reads "1000", matching the web app's plain-number display.
String formatAmount(num n) => n % 1 == 0 ? n.toInt().toString() : n.toString();

/// 12-hour clock display, e.g. "4:30 PM" — used by the Today cards.
String formatTime12h(String hhmmss) {
  final parts = hhmmss.split(':');
  final h = int.parse(parts[0]);
  final m = int.parse(parts[1]);
  final period = h >= 12 ? 'PM' : 'AM';
  final h12 = h % 12 == 0 ? 12 : h % 12;
  return '$h12:${m.toString().padLeft(2, '0')} $period';
}

const _monthAbbrev = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

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

/// "2026-09-11" -> "Sep 11" — a session-cycle's dates (or a monthly
/// grid's columns) can straddle a month boundary, so a bare day number
/// would be ambiguous about which month it's actually in.
String formatDayLabel(String date) {
  final parts = date.split('-');
  final month = int.parse(parts[1]);
  final day = int.parse(parts[2]);
  return '${_monthAbbrev[month - 1]} $day';
}

/// "2026-09-01" -> "September 2026".
String formatMonthLabel(String month) {
  final parts = month.split('-');
  final monthIndex = int.parse(parts[1]);
  return '${_monthNames[monthIndex - 1]} ${parts[0]}';
}
