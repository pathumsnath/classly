import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import '../supabase/client.dart';
import '../../features/attendance/attendance_screen.dart';
import '../../features/auth/login_screen.dart';
import '../../features/classes/class_detail_screen.dart';
import '../../features/classes/classes_list_screen.dart';
import '../../features/fees/fees_list_screen.dart';
import '../../features/fees/record_payment_screen.dart';
import '../../features/fees/student_fees_screen.dart';
import '../../features/attendance/monthly_attendance_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/money/money_screen.dart';
import '../../features/salaries/salaries_list_screen.dart';
import '../../features/salaries/tutor_salary_screen.dart';
import '../../features/staff/invite_staff_screen.dart';
import '../../features/students/student_detail_screen.dart';
import '../../features/students/students_list_screen.dart';
import '../../features/subjects/subjects_screen.dart';
import '../../features/tutors/tutor_detail_screen.dart';
import '../../features/tutors/tutor_edit_screen.dart';
import '../../features/tutors/tutors_list_screen.dart';

/// Converts the Supabase auth-state Stream into a Listenable so go_router
/// can re-evaluate `redirect` whenever sign-in/sign-out happens, without
/// needing every route's data already loaded synchronously.
class GoRouterRefreshStream extends ChangeNotifier {
  late final StreamSubscription<dynamic> _subscription;

  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}

final appRouter = GoRouter(
  initialLocation: '/',
  refreshListenable: GoRouterRefreshStream(supabase.auth.onAuthStateChange),
  redirect: (context, state) {
    final loggedIn = supabase.auth.currentSession != null;
    final loggingIn = state.matchedLocation == '/login';

    if (!loggedIn) return loggingIn ? null : '/login';
    if (loggingIn) return '/';
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
    GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
    GoRoute(
      path: '/attendance/:classId',
      builder: (context, state) {
        final extra = state.extra as Map<String, String?>?;
        return AttendanceScreen(
          classId: state.pathParameters['classId']!,
          title: extra?['title'] ?? 'Attendance',
          subtitle: extra?['subtitle'],
        );
      },
    ),
    GoRoute(
      path: '/attendance/:classId/history',
      builder: (context, state) =>
          MonthlyAttendanceScreen(classId: state.pathParameters['classId']!),
    ),
    GoRoute(
      path: '/classes',
      builder: (context, state) => const ClassesListScreen(),
    ),
    GoRoute(
      path: '/classes/:classId',
      builder: (context, state) =>
          ClassDetailScreen(classId: state.pathParameters['classId']!),
    ),
    GoRoute(
      path: '/students',
      builder: (context, state) => const StudentsListScreen(),
    ),
    GoRoute(
      path: '/students/:studentId',
      builder: (context, state) =>
          StudentDetailScreen(studentId: state.pathParameters['studentId']!),
    ),
    GoRoute(
      path: '/tutors',
      builder: (context, state) => const TutorsListScreen(),
    ),
    GoRoute(
      path: '/tutors/:tutorId',
      builder: (context, state) =>
          TutorDetailScreen(tutorId: state.pathParameters['tutorId']!),
    ),
    GoRoute(
      path: '/tutors/:tutorId/edit',
      builder: (context, state) =>
          TutorEditScreen(tutorId: state.pathParameters['tutorId']!),
    ),
    GoRoute(
      path: '/subjects',
      builder: (context, state) => const SubjectsScreen(),
    ),
    GoRoute(path: '/fees', builder: (context, state) => const FeesListScreen()),
    GoRoute(
      path: '/fees/:studentId',
      builder: (context, state) =>
          StudentFeesScreen(studentId: state.pathParameters['studentId']!),
    ),
    GoRoute(
      path: '/fees/:studentId/record',
      builder: (context, state) =>
          RecordPaymentScreen(studentId: state.pathParameters['studentId']!),
    ),
    GoRoute(
      path: '/salaries',
      builder: (context, state) => const SalariesListScreen(),
    ),
    GoRoute(
      path: '/salaries/:tutorId',
      builder: (context, state) => TutorSalaryScreen(
        tutorId: state.pathParameters['tutorId']!,
        initialMonth: state.uri.queryParameters['month'],
      ),
    ),
    GoRoute(path: '/money', builder: (context, state) => const MoneyScreen()),
    GoRoute(
      path: '/staff/invite',
      builder: (context, state) => const InviteStaffScreen(),
    ),
  ],
);
