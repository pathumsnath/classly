// Ported from src/lib/time.ts. Sri Lanka has used a single fixed +05:30
// offset with no daylight saving since 2006, so a hardcoded offset is
// exact — no need for the `timezone` package's IANA database just for
// this one, permanently-fixed zone.
const _colomboOffset = Duration(hours: 5, minutes: 30);

DateTime colomboNow() => DateTime.now().toUtc().add(_colomboOffset);

String _pad2(int n) => n.toString().padLeft(2, '0');

String todayInColombo() {
  final now = colomboNow();
  return '${now.year}-${_pad2(now.month)}-${_pad2(now.day)}';
}

String currentMonthInColombo() => '${todayInColombo().substring(0, 7)}-01';

const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/// Dart's DateTime.weekday is 1=Monday..7=Sunday; the web app's schedule_days
/// strings use Sun-first (Sun,Mon,...,Sat), matching JS's Date.getDay().
String weekdayName(DateTime date) => weekdayNames[date.weekday % 7];
