import '../../core/session/session_info.dart';
import '../../core/supabase/client.dart';
import '../../core/time/colombo_time.dart';
import '../../shared/models/salary.dart';

typedef _MonthRange = ({String start, String end});

typedef _RevenueShareFigures = ({
  num collectedThisMonth,
  num overdueReceived,
  num outstanding,
  int outstandingCycleCount,
});

/// Ported from src/lib/salaries/(queries|calculate|actions).ts. Every
/// read here is institute-wide RLS (classes/payments/attendance/users,
/// already relied on elsewhere); every write here — salary_payments and
/// tutor_advances — is owner-only RLS (migrations 0001/0007), and the
/// web app itself deliberately writes these through its RLS-respecting
/// client rather than the admin one, so there's nothing privileged to
/// route through an Edge Function for.
class SalariesRepository {
  _MonthRange _monthDateRange(String month) {
    final parts = month.split('-');
    final year = int.parse(parts[0]);
    final mon = int.parse(parts[1]);
    final start =
        '${year.toString().padLeft(4, '0')}-${mon.toString().padLeft(2, '0')}-01';
    final lastDay = DateTime.utc(year, mon + 1, 0).day;
    final end =
        '${year.toString().padLeft(4, '0')}-${mon.toString().padLeft(2, '0')}-${lastDay.toString().padLeft(2, '0')}';
    return (start: start, end: end);
  }

  Future<int> _paidStudents(String classId, String month) async {
    final rows = await supabase
        .from('payments')
        .select('amount_paid')
        .eq('class_id', classId)
        .eq('month', month);
    return (rows as List)
        .cast<Map<String, dynamic>>()
        .where((p) => (p['amount_paid'] as num) > 0)
        .length;
  }

  Future<int> _sessionsHeld(String classId, String month) async {
    final range = _monthDateRange(month);
    final rows = await supabase
        .from('attendance')
        .select('date')
        .eq('class_id', classId)
        .gte('date', range.start)
        .lte('date', range.end);
    return (rows as List)
        .cast<Map<String, dynamic>>()
        .map((a) => a['date'] as String)
        .toSet()
        .length;
  }

  /// Cash-basis (the institute never pays out more than it actually took
  /// in) — income for a month is whatever was actually collected during
  /// that calendar month, split into fees due this month vs. an earlier
  /// month's overdue fee finally settled now.
  Future<_RevenueShareFigures> _revenueShareFigures(
    String classId,
    String month,
  ) async {
    final range = _monthDateRange(month);
    final rows =
        (await supabase
                .from('payments')
                .select(
                  'amount_paid, balance, status, month, paid_date, cycle_started_at',
                )
                .eq('class_id', classId))
            .cast<Map<String, dynamic>>();

    final collectedInMonth = rows.where((p) {
      final amountPaid = p['amount_paid'] as num;
      final paidDate = p['paid_date'] as String?;
      return amountPaid > 0 &&
          paidDate != null &&
          paidDate.compareTo(range.start) >= 0 &&
          paidDate.compareTo(range.end) <= 0;
    }).toList();

    num collectedThisMonth = 0;
    num overdueReceived = 0;
    for (final p in collectedInMonth) {
      final amountPaid = p['amount_paid'] as num;
      if (p['month'] == month) {
        collectedThisMonth += amountPaid;
      } else {
        overdueReceived += amountPaid;
      }
    }

    final outstandingRows = rows
        .where((p) => p['status'] == 'pending' || p['status'] == 'partial')
        .toList();
    final outstanding = outstandingRows.fold<num>(
      0,
      (sum, p) => sum + (p['balance'] as num),
    );
    final outstandingCycleCount = outstandingRows
        .where((p) => p['cycle_started_at'] != null)
        .map((p) => p['cycle_started_at'] as String)
        .toSet()
        .length;

    return (
      collectedThisMonth: collectedThisMonth,
      overdueReceived: overdueReceived,
      outstanding: outstanding,
      outstandingCycleCount: outstandingCycleCount,
    );
  }

  Future<ClassSalaryBreakdown> _calculateClassSalary({
    required Map<String, dynamic> cls,
    required String month,
    required num revenueShareCommissionPercent,
  }) async {
    num amount = 0;
    num? collected;
    num? overdueReceived;
    num? outstanding;
    int? outstandingCycleCount;
    num value = cls['tutor_payment_value'] as num;
    final model = cls['tutor_payment_model'] as String;
    final classId = cls['id'] as String;

    switch (model) {
      case 'revenue_share':
        value = 100 - revenueShareCommissionPercent;
        final figures = await _revenueShareFigures(classId, month);
        collected = figures.collectedThisMonth + figures.overdueReceived;
        overdueReceived = figures.overdueReceived;
        outstanding = figures.outstanding;
        outstandingCycleCount = figures.outstandingCycleCount;
        amount = collected * (value / 100);
        break;
      case 'fixed':
        amount = cls['tutor_payment_value'] as num;
        break;
      case 'per_student':
        amount =
            (await _paidStudents(classId, month)) *
            (cls['tutor_payment_value'] as num);
        break;
      case 'per_session':
        amount =
            (await _sessionsHeld(classId, month)) *
            (cls['tutor_payment_value'] as num);
        break;
    }

    return ClassSalaryBreakdown(
      classId: classId,
      subject: cls['subject'] as String,
      groupName: cls['groupName'] as String?,
      grade: cls['grade'] as String?,
      medium: cls['medium'] as String?,
      model: model,
      value: value,
      amount: amount,
      collectedFees: collected,
      overdueReceived: overdueReceived,
      outstandingFees: outstanding,
      outstandingCycleCount: outstandingCycleCount,
    );
  }

  Future<List<TutorSalary>> fetchTutorSalaries(
    SessionInfo session,
    String month, {
    List<String>? filterTutorIds,
  }) async {
    var tutorLinksQuery = supabase
        .from('institute_tutors')
        .select('tutor_id, commission_override_percent')
        .eq('institute_id', session.instituteId)
        .eq('status', 'active');
    final tutorLinksRows =
        (filterTutorIds != null
                ? await tutorLinksQuery.inFilter('tutor_id', filterTutorIds)
                : await tutorLinksQuery)
            .cast<Map<String, dynamic>>();
    if (tutorLinksRows.isEmpty) return [];

    final tutorIds = tutorLinksRows
        .map((t) => t['tutor_id'] as String)
        .toList();

    final results = await Future.wait<dynamic>([
      supabase.from('users').select('id, name').inFilter('id', tutorIds),
      supabase
          .from('classes')
          .select(
            'id, subject_id, tutor_id, tutor_payment_model, tutor_payment_value, group_name, grade, medium',
          )
          .eq('institute_id', session.instituteId)
          .inFilter('tutor_id', tutorIds),
      supabase
          .from('salary_payments')
          .select('tutor_id, amount, status')
          .eq('institute_id', session.instituteId)
          .eq('month', month),
      supabase
          .from('tutor_advances')
          .select('id, tutor_id, amount, reason, recorded_at')
          .eq('institute_id', session.instituteId)
          .eq('month', month)
          .inFilter('tutor_id', tutorIds),
      supabase
          .from('institutes')
          .select('revenue_share_commission_percent')
          .eq('id', session.instituteId)
          .single(),
    ]);

    final tutors = (results[0] as List).cast<Map<String, dynamic>>();
    final classes = (results[1] as List).cast<Map<String, dynamic>>();
    final salaryPayments = (results[2] as List).cast<Map<String, dynamic>>();
    final advances = (results[3] as List).cast<Map<String, dynamic>>();
    final institute = results[4] as Map<String, dynamic>?;

    final defaultCommissionPercent =
        (institute?['revenue_share_commission_percent'] as num?) ?? 25;
    final commissionOverrideByTutor = {
      for (final t in tutorLinksRows)
        t['tutor_id'] as String: t['commission_override_percent'] as num?,
    };

    final subjectIds = classes
        .map((c) => c['subject_id'] as String)
        .toSet()
        .toList();
    final subjectRows = subjectIds.isEmpty
        ? <Map<String, dynamic>>[]
        : (await supabase
                  .from('subjects')
                  .select('id, name')
                  .inFilter('id', subjectIds))
              .cast<Map<String, dynamic>>();
    final subjectNameById = {
      for (final s in subjectRows) s['id'] as String: s['name'] as String,
    };

    final nameById = {
      for (final t in tutors) t['id'] as String: t['name'] as String,
    };
    final salaryByTutor = {
      for (final s in salaryPayments) s['tutor_id'] as String: s,
    };

    final advancesByTutor = <String, List<TutorAdvanceRow>>{};
    for (final a in advances) {
      final tutorId = a['tutor_id'] as String;
      (advancesByTutor[tutorId] ??= []).add(
        TutorAdvanceRow(
          id: a['id'] as String,
          amount: a['amount'] as num,
          reason: a['reason'] as String,
          recordedAt: a['recorded_at'] as String,
        ),
      );
    }

    // Tutors (and each tutor's own classes) are independent of each other
    // — compute all of them concurrently instead of one at a time.
    final salaries = await Future.wait(
      tutorIds.map((tutorId) async {
        final tutorClasses = classes
            .where((c) => c['tutor_id'] == tutorId)
            .toList();
        final revenueShareCommissionPercent =
            commissionOverrideByTutor[tutorId] ?? defaultCommissionPercent;
        final breakdown = await Future.wait(
          tutorClasses.map(
            (c) => _calculateClassSalary(
              cls: {
                'id': c['id'],
                'subject': subjectNameById[c['subject_id']] ?? 'Unknown',
                'groupName': c['group_name'],
                'grade': c['grade'],
                'medium': c['medium'],
                'tutor_payment_model': c['tutor_payment_model'],
                'tutor_payment_value': c['tutor_payment_value'],
              },
              month: month,
              revenueShareCommissionPercent: revenueShareCommissionPercent,
            ),
          ),
        );
        final total = breakdown.fold<num>(0, (sum, b) => sum + b.amount);
        final salary = salaryByTutor[tutorId];
        final tutorAdvances =
            advancesByTutor[tutorId] ?? const <TutorAdvanceRow>[];
        final advancesTotal = tutorAdvances.fold<num>(
          0,
          (sum, a) => sum + a.amount,
        );
        final net = total - advancesTotal;

        return TutorSalary(
          tutorId: tutorId,
          tutorName: nameById[tutorId] ?? 'Unknown',
          classes: breakdown,
          total: total,
          advances: tutorAdvances,
          advancesTotal: advancesTotal,
          netTotal: net < 0 ? 0 : net,
          status: (salary?['status'] as String?) ?? 'pending',
          paidAmount: salary?['amount'] as num?,
        );
      }),
    );

    return salaries;
  }

  Future<TutorSalary?> fetchTutorSalary(
    SessionInfo session,
    String tutorId,
    String month,
  ) async {
    final salaries = await fetchTutorSalaries(
      session,
      month,
      filterTutorIds: [tutorId],
    );
    return salaries.isEmpty ? null : salaries.first;
  }

  /// Direct RLS write — salary_payments_insert/update already restrict
  /// this to owner (migration 0001), matching the web app's own choice
  /// to write this one through the RLS-respecting client, not admin.
  Future<void> markSalaryPaid(
    SessionInfo session,
    String tutorId,
    String month,
    num amount,
  ) async {
    await supabase.from('salary_payments').upsert({
      'institute_id': session.instituteId,
      'tutor_id': tutorId,
      'month': month,
      'amount': amount,
      'status': 'paid',
      'paid_date': todayInColombo(),
      'recorded_by': session.userId,
      'recorded_at': DateTime.now().toUtc().toIso8601String(),
    }, onConflict: 'tutor_id,month');
  }

  Future<void> recordAdvance(
    SessionInfo session, {
    required String tutorId,
    required String month,
    required num amount,
    required String reason,
  }) async {
    await supabase.from('tutor_advances').insert({
      'institute_id': session.instituteId,
      'tutor_id': tutorId,
      'month': month,
      'amount': amount,
      'reason': reason,
      'recorded_by': session.userId,
    });
  }

  Future<void> deleteAdvance(SessionInfo session, String advanceId) async {
    await supabase
        .from('tutor_advances')
        .delete()
        .eq('id', advanceId)
        .eq('institute_id', session.instituteId);
  }
}
