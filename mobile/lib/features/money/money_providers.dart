import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/session/session_provider.dart';
import '../../shared/models/money.dart';
import 'money_repository.dart';

final moneyRepositoryProvider = Provider((ref) => MoneyRepository());

final moneyOverviewProvider = FutureProvider.autoDispose
    .family<MoneyOverview?, String>((ref, month) async {
      final session = await ref.watch(sessionInfoProvider.future);
      if (session == null) return null;
      return ref
          .read(moneyRepositoryProvider)
          .fetchMoneyOverview(session, month);
    });

final instituteIncomeTrendProvider = FutureProvider.autoDispose
    .family<List<InstituteIncomePoint>, String>((ref, endMonth) async {
      final session = await ref.watch(sessionInfoProvider.future);
      if (session == null) return [];
      return ref
          .read(moneyRepositoryProvider)
          .fetchInstituteIncomeTrend(session, 6, endMonth);
    });
