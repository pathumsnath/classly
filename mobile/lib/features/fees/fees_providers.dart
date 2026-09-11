import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/session/session_provider.dart';
import '../../shared/models/fee_row.dart';
import 'fees_repository.dart';

final feesRepositoryProvider = Provider((ref) => FeesRepository());

final feesListProvider = FutureProvider.autoDispose<List<FeeRow>>((ref) async {
  final session = await ref.watch(sessionInfoProvider.future);
  if (session == null) return [];
  return ref.read(feesRepositoryProvider).fetchFees(session);
});

final studentFeesProvider = FutureProvider.autoDispose
    .family<List<FeeRow>, String>((ref, studentId) async {
      final session = await ref.watch(sessionInfoProvider.future);
      if (session == null) return [];
      return ref
          .read(feesRepositoryProvider)
          .fetchFeesForStudent(session, studentId);
    });

final feeWalletBalanceProvider = FutureProvider.autoDispose.family<num, String>(
  (ref, studentId) async {
    final session = await ref.watch(sessionInfoProvider.future);
    if (session == null) return 0;
    return ref
        .read(feesRepositoryProvider)
        .fetchWalletBalance(session, studentId);
  },
);
