import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/session/session_provider.dart';
import '../../shared/models/class_row.dart';
import '../../shared/models/tutor_row.dart';
import 'tutors_repository.dart';

final tutorsRepositoryProvider = Provider((ref) => TutorsRepository());

final tutorsListProvider = FutureProvider.autoDispose<List<TutorRow>>((
  ref,
) async {
  final session = await ref.watch(sessionInfoProvider.future);
  if (session == null) return [];
  return ref.read(tutorsRepositoryProvider).fetchTutors(session);
});

final tutorDetailProvider = FutureProvider.autoDispose
    .family<TutorRow?, String>((ref, tutorId) async {
      final session = await ref.watch(sessionInfoProvider.future);
      if (session == null) return null;
      return ref.read(tutorsRepositoryProvider).fetchTutor(session, tutorId);
    });

final tutorClassesProvider = FutureProvider.autoDispose
    .family<List<ClassRow>, String>((ref, tutorId) async {
      final session = await ref.watch(sessionInfoProvider.future);
      if (session == null) return [];
      return ref
          .read(tutorsRepositoryProvider)
          .fetchClassesForTutor(session, tutorId);
    });
