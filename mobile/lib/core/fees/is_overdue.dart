/// Ported from src/lib/fees/status.ts's isOverdue — shared by the Fees
/// feature and the attendance roster's fee badges so both agree on what
/// "overdue" means.
///
/// A payment is overdue if it's still pending/partial and belongs to a
/// billing period strictly before the current one. Calendar-billed
/// classes compare calendar months; session-cycle billed classes compare
/// the payment's own cycle start date against the class's current one,
/// since two different cycles for the same class can land in the same
/// calendar month.
bool isOverdue({
  required String status,
  required String paymentMonth,
  required String? paymentCycleStartedAt,
  required int? billingCycleSessions,
  required String? classCycleStartedAt,
  required String currentMonth,
}) {
  if (status != 'pending' && status != 'partial') return false;
  if (billingCycleSessions != null && classCycleStartedAt != null) {
    return (paymentCycleStartedAt ?? '').compareTo(classCycleStartedAt) < 0;
  }
  return paymentMonth.substring(0, 7).compareTo(currentMonth.substring(0, 7)) <
      0;
}
