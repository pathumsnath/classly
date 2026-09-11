import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/session/session_provider.dart';
import '../../shared/models/subject_row.dart';
import 'subjects_repository.dart';

final subjectsRepositoryProvider = Provider((ref) => SubjectsRepository());

final subjectsListProvider = FutureProvider.autoDispose<List<SubjectRow>>((
  ref,
) async {
  final session = await ref.watch(sessionInfoProvider.future);
  if (session == null) return [];
  return ref.read(subjectsRepositoryProvider).fetchSubjects(session);
});
