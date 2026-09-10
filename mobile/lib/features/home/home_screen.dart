import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/session/session_provider.dart';
import '../dashboard/dashboard_screen.dart';
import '../today/today_screen.dart';

/// Picks the landing screen by role — owner/admin_staff get the
/// dashboard (nav grid into the rest of the app), tutors get the daily
/// Today view. A dispatcher widget rather than a go_router redirect,
/// since role only resolves async (after the get_current_session() RPC),
/// and go_router's redirect callback needs a synchronous answer.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionAsync = ref.watch(sessionInfoProvider);

    return sessionAsync.when(
      data: (session) {
        if (session != null && (session.isOwner || session.isAdminStaff)) {
          return const DashboardScreen();
        }
        return const TodayScreen();
      },
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (err, _) => Scaffold(
        body: Center(child: Text('Could not load your session.\n$err')),
      ),
    );
  }
}
