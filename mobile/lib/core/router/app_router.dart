import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import '../supabase/client.dart';
import '../../features/attendance/attendance_screen.dart';
import '../../features/auth/login_screen.dart';
import '../../features/home/home_screen.dart';

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
  ],
);
