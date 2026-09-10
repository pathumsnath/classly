import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/attendance_student.dart';
import 'attendance_repository.dart';

final attendanceRepositoryProvider = Provider((ref) => AttendanceRepository());

final classRosterProvider = FutureProvider.autoDispose
    .family<List<AttendanceStudent>, ({String classId, String date})>((
      ref,
      args,
    ) {
      return ref
          .read(attendanceRepositoryProvider)
          .fetchRoster(args.classId, args.date);
    });
