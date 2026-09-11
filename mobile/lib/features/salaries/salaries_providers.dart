import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/session/session_provider.dart';
import '../../shared/models/salary.dart';
import 'salaries_repository.dart';

final salariesRepositoryProvider = Provider((ref) => SalariesRepository());

final tutorSalariesProvider = FutureProvider.autoDispose
    .family<List<TutorSalary>, String>((ref, month) async {
      final session = await ref.watch(sessionInfoProvider.future);
      if (session == null) return [];
      return ref
          .read(salariesRepositoryProvider)
          .fetchTutorSalaries(session, month);
    });

final tutorSalaryProvider = FutureProvider.autoDispose
    .family<TutorSalary?, ({String tutorId, String month})>((ref, args) async {
      final session = await ref.watch(sessionInfoProvider.future);
      if (session == null) return null;
      return ref
          .read(salariesRepositoryProvider)
          .fetchTutorSalary(session, args.tutorId, args.month);
    });
