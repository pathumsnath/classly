import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/session/session_provider.dart';
import '../../shared/models/class_detail.dart';
import '../../shared/models/class_row.dart';
import 'classes_repository.dart';

final classesRepositoryProvider = Provider((ref) => ClassesRepository());

final classesListProvider = FutureProvider.autoDispose<List<ClassRow>>((
  ref,
) async {
  final session = await ref.watch(sessionInfoProvider.future);
  if (session == null) return [];
  return ref.read(classesRepositoryProvider).fetchClasses(session);
});

final classDetailProvider = FutureProvider.autoDispose
    .family<ClassDetail?, String>((ref, classId) async {
      final session = await ref.watch(sessionInfoProvider.future);
      if (session == null) return null;
      return ref
          .read(classesRepositoryProvider)
          .fetchClassDetail(session, classId);
    });

final enrolledStudentsProvider = FutureProvider.autoDispose
    .family<List<EnrolledStudent>, String>((ref, classId) {
      return ref.read(classesRepositoryProvider).fetchEnrolledStudents(classId);
    });

final commissionPercentProvider = FutureProvider.autoDispose<num?>((ref) async {
  final session = await ref.watch(sessionInfoProvider.future);
  if (session == null) return null;
  return ref.read(classesRepositoryProvider).fetchCommissionPercent(session);
});
