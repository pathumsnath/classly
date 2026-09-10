import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/session/session_provider.dart';
import '../../shared/models/student_row.dart';
import 'students_repository.dart';

final studentsRepositoryProvider = Provider((ref) => StudentsRepository());

final studentsListProvider = FutureProvider.autoDispose<List<StudentRow>>((
  ref,
) async {
  final session = await ref.watch(sessionInfoProvider.future);
  if (session == null) return [];
  return ref.read(studentsRepositoryProvider).fetchStudents(session);
});

final studentDetailProvider = FutureProvider.autoDispose
    .family<StudentRow?, String>((ref, studentId) async {
      final session = await ref.watch(sessionInfoProvider.future);
      if (session == null) return null;
      return ref
          .read(studentsRepositoryProvider)
          .fetchStudent(session, studentId);
    });

final studentWalletBalanceProvider = FutureProvider.autoDispose
    .family<num, String>((ref, studentId) async {
      final session = await ref.watch(sessionInfoProvider.future);
      if (session == null) return 0;
      return ref
          .read(studentsRepositoryProvider)
          .fetchWalletBalance(session, studentId);
    });

final studentClassesProvider = FutureProvider.autoDispose
    .family<List<EnrolledClassForStudent>, String>((ref, studentId) async {
      final session = await ref.watch(sessionInfoProvider.future);
      if (session == null) return [];
      return ref
          .read(studentsRepositoryProvider)
          .fetchClassesForStudent(session, studentId);
    });
