import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/session/session_info.dart';
import '../../core/supabase/client.dart';
import '../../core/time/colombo_time.dart';
import '../../shared/models/fee_row.dart';

/// Ported from src/lib/fees/queries.ts. Reads are direct RLS-scoped
/// queries (payments_select is institute-wide); waiveFee is also a
/// direct RLS write (payments_update already permits owner/admin_staff
/// on their own institute, migration 0001). Recording a payment stays
/// behind the record-payment Edge Function from Phase 0 — it validates
/// amounts against balances, applies wallet credit, and optionally sends
/// an SMS receipt, none of which is safe to trust from the client.
class FeesRepository {
  Future<List<FeeRow>> fetchFees(SessionInfo session) async {
    final rows = await supabase
        .from('payments')
        .select(
          'id, student_id, class_id, month, amount_due, amount_paid, balance, status, paid_date, cycle_started_at',
        )
        .eq('institute_id', session.instituteId);
    return _toFeeRows((rows as List).cast<Map<String, dynamic>>());
  }

  Future<List<FeeRow>> fetchFeesForStudent(
    SessionInfo session,
    String studentId,
  ) async {
    final rows = await supabase
        .from('payments')
        .select(
          'id, student_id, class_id, month, amount_due, amount_paid, balance, status, paid_date, cycle_started_at',
        )
        .eq('institute_id', session.instituteId)
        .eq('student_id', studentId);
    return _toFeeRows((rows as List).cast<Map<String, dynamic>>());
  }

  Future<List<FeeRow>> _toFeeRows(List<Map<String, dynamic>> payments) async {
    if (payments.isEmpty) return [];

    final studentIds = payments
        .map((p) => p['student_id'] as String)
        .toSet()
        .toList();
    final classIds = payments
        .map((p) => p['class_id'] as String)
        .toSet()
        .toList();

    final results = await Future.wait([
      supabase
          .from('users')
          .select('id, name, phone')
          .inFilter('id', studentIds),
      supabase
          .from('classes')
          .select(
            'id, subject_id, tutor_id, group_name, billing_cycle_sessions, cycle_started_at',
          )
          .inFilter('id', classIds),
    ]);
    final studentById = {
      for (final s in (results[0] as List).cast<Map<String, dynamic>>())
        s['id'] as String: s,
    };
    final classById = {
      for (final c in (results[1] as List).cast<Map<String, dynamic>>())
        c['id'] as String: c,
    };

    final subjectIds = classById.values
        .map((c) => c['subject_id'] as String)
        .toSet()
        .toList();
    final tutorIds = classById.values
        .map((c) => c['tutor_id'] as String)
        .toSet()
        .toList();
    final results2 = await Future.wait([
      supabase.from('subjects').select('id, name').inFilter('id', subjectIds),
      supabase.from('users').select('id, name').inFilter('id', tutorIds),
    ]);
    final subjectNameById = {
      for (final s in (results2[0] as List).cast<Map<String, dynamic>>())
        s['id'] as String: s['name'] as String,
    };
    final tutorNameById = {
      for (final t in (results2[1] as List).cast<Map<String, dynamic>>())
        t['id'] as String: t['name'] as String,
    };

    final currentMonth = currentMonthInColombo();

    final rows = payments.map((p) {
      final student = studentById[p['student_id']];
      final cls = classById[p['class_id']];
      final status = p['status'] as String;
      final isOverdue = _isOverdue(
        status: status,
        paymentMonth: p['month'] as String,
        paymentCycleStartedAt: p['cycle_started_at'] as String?,
        billingCycleSessions: cls?['billing_cycle_sessions'] as int?,
        classCycleStartedAt: cls?['cycle_started_at'] as String?,
        currentMonth: currentMonth,
      );

      return FeeRow(
        id: p['id'] as String,
        studentId: p['student_id'] as String,
        studentName: student?['name'] as String? ?? 'Unknown',
        studentPhone: student?['phone'] as String? ?? '',
        classId: p['class_id'] as String,
        subject: subjectNameById[cls?['subject_id']] ?? 'Unknown',
        groupName: cls?['group_name'] as String?,
        tutorName: tutorNameById[cls?['tutor_id']] ?? 'Unknown',
        month: p['month'] as String,
        amountDue: p['amount_due'] as num,
        amountPaid: p['amount_paid'] as num,
        balance: p['balance'] as num,
        status: status,
        paidDate: p['paid_date'] as String?,
        isOverdue: isOverdue,
      );
    }).toList();

    int rank(FeeRow r) => r.isOverdue
        ? 0
        : (r.status == 'partial' ? 1 : (r.status == 'pending' ? 2 : 3));
    rows.sort((a, b) {
      final byRank = rank(a).compareTo(rank(b));
      if (byRank != 0) return byRank;
      return b.month.compareTo(a.month);
    });
    return rows;
  }

  /// Ported from src/lib/fees/status.ts's isOverdue.
  bool _isOverdue({
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
    return paymentMonth
            .substring(0, 7)
            .compareTo(currentMonth.substring(0, 7)) <
        0;
  }

  Future<num> fetchWalletBalance(SessionInfo session, String studentId) async {
    final rows = await supabase
        .from('wallet_transactions')
        .select('amount, type')
        .eq('institute_id', session.instituteId)
        .eq('student_id', studentId);
    num balance = 0;
    for (final r in (rows as List).cast<Map<String, dynamic>>()) {
      final amount = r['amount'] as num;
      balance += r['type'] == 'credit' ? amount : -amount;
    }
    return balance;
  }

  /// Direct RLS write — payments_update already permits owner/admin_staff
  /// on their own institute.
  Future<void> waiveFee(SessionInfo session, String paymentId) async {
    await supabase
        .from('payments')
        .update({
          'status': 'waived',
          'recorded_by': session.userId,
          'recorded_at': DateTime.now().toUtc().toIso8601String(),
        })
        .eq('id', paymentId)
        .eq('institute_id', session.instituteId);
  }

  Future<void> recordPayment({
    required List<String> paymentIds,
    required Map<String, num> amounts,
    required String method,
    String? reference,
    String? paidDate,
    num walletTopUp = 0,
    String? studentId,
    bool sendReceipt = false,
  }) async {
    try {
      await supabase.functions.invoke(
        'record-payment',
        body: {
          'paymentIds': paymentIds,
          'amounts': amounts,
          'method': method,
          'reference': ?reference,
          'paidDate': ?paidDate,
          'walletTopUp': walletTopUp,
          'studentId': ?studentId,
          'sendReceipt': sendReceipt,
        },
      );
    } on FunctionException catch (e) {
      final details = e.details;
      final message = details is Map ? details['error'] as String? : null;
      throw Exception(message ?? 'Could not record payment.');
    }
  }
}
