import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/session/session_provider.dart';
import '../../shared/models/attendance_student.dart';
import 'attendance_repository.dart';

final attendanceRepositoryProvider = Provider((ref) => AttendanceRepository());

final classRosterProvider = FutureProvider.autoDispose
    .family<List<AttendanceStudent>, ({String classId, String date})>((
      ref,
      args,
    ) async {
      final session = await ref.watch(sessionInfoProvider.future);
      if (session == null) return [];
      return ref
          .read(attendanceRepositoryProvider)
          .fetchRoster(session, args.classId, args.date);
    });
