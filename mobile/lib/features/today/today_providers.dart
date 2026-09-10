import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/session/session_provider.dart';
import '../../shared/models/today_class.dart';
import 'today_repository.dart';

final todayRepositoryProvider = Provider((ref) => TodayRepository());

final todaysClassesProvider = FutureProvider.autoDispose<List<TodayClass>>((
  ref,
) async {
  final session = await ref.watch(sessionInfoProvider.future);
  if (session == null) return [];
  return ref.read(todayRepositoryProvider).fetchTodaysClasses(session);
});
