/// Mirrors src/lib/salaries/calculate.ts's ClassSalaryBreakdown.
class ClassSalaryBreakdown {
  final String classId;
  final String subject;
  final String? groupName;
  final String? grade;
  final String? medium;
  final String model;
  final num value;
  final num amount;
  // Only meaningful for revenue_share.
  final num? collectedFees;
  final num? overdueReceived;
  final num? outstandingFees;
  final int? outstandingCycleCount;

  const ClassSalaryBreakdown({
    required this.classId,
    required this.subject,
    required this.groupName,
    required this.grade,
    required this.medium,
    required this.model,
    required this.value,
    required this.amount,
    required this.collectedFees,
    required this.overdueReceived,
    required this.outstandingFees,
    required this.outstandingCycleCount,
  });
}

/// Mirrors src/lib/salaries/queries.ts's TutorAdvanceRow.
class TutorAdvanceRow {
  final String id;
  final num amount;
  final String reason;
  final String recordedAt;

  const TutorAdvanceRow({
    required this.id,
    required this.amount,
    required this.reason,
    required this.recordedAt,
  });
}

/// Mirrors src/lib/salaries/queries.ts's TutorSalary.
class TutorSalary {
  final String tutorId;
  final String tutorName;
  final List<ClassSalaryBreakdown> classes;
  final num total;
  final List<TutorAdvanceRow> advances;
  final num advancesTotal;
  final num netTotal;
  final String status;
  final num? paidAmount;

  const TutorSalary({
    required this.tutorId,
    required this.tutorName,
    required this.classes,
    required this.total,
    required this.advances,
    required this.advancesTotal,
    required this.netTotal,
    required this.status,
    required this.paidAmount,
  });

  /// A tutor's revenue-share rate is uniform across all their
  /// revenue_share classes — any one of those classes' `value` shows it.
  num? get revenueShareRate {
    for (final c in classes) {
      if (c.model == 'revenue_share') return c.value;
    }
    return null;
  }
}
