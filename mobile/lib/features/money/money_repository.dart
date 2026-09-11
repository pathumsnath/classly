import '../../core/fees/is_overdue.dart';
import '../../core/session/session_info.dart';
import '../../core/supabase/client.dart';
import '../../core/time/colombo_time.dart';
import '../../shared/models/money.dart';
import '../salaries/salaries_repository.dart';

/// Ported from src/lib/money/queries.ts — every read here is the same
/// institute-wide RLS already relied on elsewhere (owner-only enforced
/// by the dashboard's nav gating, same defense-in-depth level as web's
/// page-level redirect).
class MoneyRepository {
  final _salariesRepository = SalariesRepository();

  Future<MoneyOverview> fetchMoneyOverview(
    SessionInfo session,
    String month,
  ) async {
    final currentMonth = currentMonthInColombo();

    final results = await Future.wait([
      supabase
          .from('payments')
          .select(
            'class_id, student_id, amount_due, amount_paid, balance, status, month, cycle_started_at',
          )
          .eq('institute_id', session.instituteId)
          .eq('month', month),
      // Overdue is a snapshot of what's currently late across every
      // month, not scoped to whichever month the switcher shows.
      supabase
          .from('payments')
          .select('class_id, balance, status, month, cycle_started_at')
          .eq('institute_id', session.instituteId)
          .inFilter('status', ['pending', 'partial']),
    ]);
    final rows = (results[0] as List).cast<Map<String, dynamic>>();
    final unpaidRows = (results[1] as List).cast<Map<String, dynamic>>();

    final overdueCheckClassIds = {
      ...rows.map((p) => p['class_id'] as String),
      ...unpaidRows.map((p) => p['class_id'] as String),
    }.toList();
    final overdueCheckClasses = overdueCheckClassIds.isEmpty
        ? <Map<String, dynamic>>[]
        : (await supabase
                  .from('classes')
                  .select('id, billing_cycle_sessions, cycle_started_at')
                  .inFilter('id', overdueCheckClassIds))
              .cast<Map<String, dynamic>>();
    final classById = {
      for (final c in overdueCheckClasses) c['id'] as String: c,
    };

    num collected = 0;
    num pending = 0;
    num totalDue = 0;
    final dueByClass = <String, num>{};
    final paidByClass = <String, num>{};
    final studentsByClass = <String, Set<String>>{};

    for (final p in rows) {
      final classId = p['class_id'] as String;
      final amountPaid = p['amount_paid'] as num;
      final amountDue = p['amount_due'] as num;
      collected += amountPaid;
      totalDue += amountDue;

      final cls = classById[classId];
      final status = p['status'] as String;
      final overdueNow = isOverdue(
        status: status,
        paymentMonth: p['month'] as String,
        paymentCycleStartedAt: p['cycle_started_at'] as String?,
        billingCycleSessions: cls?['billing_cycle_sessions'] as int?,
        classCycleStartedAt: cls?['cycle_started_at'] as String?,
        currentMonth: currentMonth,
      );
      if (!overdueNow && (status == 'pending' || status == 'partial')) {
        pending += p['balance'] as num;
      }

      dueByClass[classId] = (dueByClass[classId] ?? 0) + amountDue;
      paidByClass[classId] = (paidByClass[classId] ?? 0) + amountPaid;
      (studentsByClass[classId] ??= {}).add(p['student_id'] as String);
    }

    num overdueTotal = 0;
    for (final p in unpaidRows) {
      final classId = p['class_id'] as String;
      final cls = classById[classId];
      final overdueNow = isOverdue(
        status: p['status'] as String,
        paymentMonth: p['month'] as String,
        paymentCycleStartedAt: p['cycle_started_at'] as String?,
        billingCycleSessions: cls?['billing_cycle_sessions'] as int?,
        classCycleStartedAt: cls?['cycle_started_at'] as String?,
        currentMonth: currentMonth,
      );
      if (overdueNow) overdueTotal += p['balance'] as num;
    }

    final classIds = dueByClass.keys.toList();
    final classes = classIds.isEmpty
        ? <Map<String, dynamic>>[]
        : (await supabase
                  .from('classes')
                  .select('id, subject_id, group_name')
                  .inFilter('id', classIds))
              .cast<Map<String, dynamic>>();
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
    final subjectByClassId = {
      for (final c in classes)
        c['id'] as String: subjectNameById[c['subject_id']] ?? 'Unknown',
    };
    final groupNameByClassId = {
      for (final c in classes) c['id'] as String: c['group_name'] as String?,
    };

    final perClass = classIds.map((classId) {
      final due = dueByClass[classId] ?? 0;
      final paid = paidByClass[classId] ?? 0;
      return ClassMoneySummary(
        classId: classId,
        subject: subjectByClassId[classId] ?? 'Unknown',
        groupName: groupNameByClassId[classId],
        studentCount: (studentsByClass[classId] ?? const {}).length,
        collected: paid,
        collectionRate: due > 0 ? (paid / due) * 100 : 0,
      );
    }).toList();

    final tutorSalaries = await _salariesRepository.fetchTutorSalaries(
      session,
      month,
    );
    final tutorTotal = tutorSalaries.fold<num>(0, (sum, s) => sum + s.total);

    return MoneyOverview(
      month: month,
      collected: collected,
      pending: pending,
      overdue: overdueTotal,
      collectionRate: totalDue > 0 ? (collected / totalDue) * 100 : 0,
      netFigure: collected - tutorTotal,
      perClass: perClass,
    );
  }

  Future<List<InstituteIncomePoint>> fetchInstituteIncomeTrend(
    SessionInfo session,
    int months,
    String endMonth,
  ) async {
    final monthList = [
      for (var i = 0; i < months; i++) _shiftMonth(endMonth, i - (months - 1)),
    ];

    final paymentsFuture = supabase
        .from('payments')
        .select('month, amount_paid')
        .eq('institute_id', session.instituteId)
        .inFilter('month', monthList);
    final salariesFuture = Future.wait(
      monthList.map((m) => _salariesRepository.fetchTutorSalaries(session, m)),
    );

    final payments = (await paymentsFuture).cast<Map<String, dynamic>>();
    final salariesByMonth = await salariesFuture;

    final collectedByMonth = <String, num>{};
    for (final p in payments) {
      final month = p['month'] as String;
      collectedByMonth[month] =
          (collectedByMonth[month] ?? 0) + (p['amount_paid'] as num);
    }

    return [
      for (var i = 0; i < monthList.length; i++)
        InstituteIncomePoint(
          month: monthList[i],
          net:
              (collectedByMonth[monthList[i]] ?? 0) -
              salariesByMonth[i].fold<num>(0, (sum, s) => sum + s.total),
        ),
    ];
  }

  String _shiftMonth(String month, int delta) {
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
