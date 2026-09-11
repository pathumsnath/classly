/// Mirrors src/lib/money/queries.ts's ClassMoneySummary.
class ClassMoneySummary {
  final String classId;
  final String subject;
  final String? groupName;
  final int studentCount;
  final num collected;
  final num collectionRate;

  const ClassMoneySummary({
    required this.classId,
    required this.subject,
    required this.groupName,
    required this.studentCount,
    required this.collected,
    required this.collectionRate,
  });
}

/// Mirrors src/lib/money/queries.ts's MoneyOverview.
class MoneyOverview {
  final String month;
  final num collected;
  final num pending;
  final num overdue;
  final num collectionRate;
  final num netFigure;
  final List<ClassMoneySummary> perClass;

  const MoneyOverview({
    required this.month,
    required this.collected,
    required this.pending,
    required this.overdue,
    required this.collectionRate,
    required this.netFigure,
    required this.perClass,
  });
}

/// Mirrors src/lib/money/queries.ts's InstituteIncomePoint.
class InstituteIncomePoint {
  final String month;
  final num net;
  const InstituteIncomePoint({required this.month, required this.net});
}
