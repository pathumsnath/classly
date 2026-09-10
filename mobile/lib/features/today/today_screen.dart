import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/session/session_provider.dart';
import '../../shared/widgets/today_classes_list.dart';
import '../auth/auth_repository.dart';
import 'today_providers.dart';

class TodayScreen extends ConsumerWidget {
  const TodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionAsync = ref.watch(sessionInfoProvider);
    final classesAsync = ref.watch(todaysClassesProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: sessionAsync.when(
          data: (session) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                session?.instituteName ?? 'Classly',
                style: const TextStyle(
                  color: Colors.black,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (session != null)
                Text(
                  session.name,
                  style: const TextStyle(
                    color: Colors.grey,
                    fontSize: 12,
                    fontWeight: FontWeight.normal,
                  ),
                ),
            ],
          ),
          loading: () =>
              const Text('Classly', style: TextStyle(color: Colors.black)),
          error: (_, _) =>
              const Text('Classly', style: TextStyle(color: Colors.black)),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.grey),
            onPressed: () => AuthRepository().signOut(),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(todaysClassesProvider);
            await ref.read(todaysClassesProvider.future);
          },
          child: classesAsync.when(
            data: (classes) => ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: [TodayClassesList(classes: classes)],
            ),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => ListView(
              padding: const EdgeInsets.all(24),
              children: [
                const Icon(Icons.error_outline, color: Colors.red, size: 40),
                const SizedBox(height: 12),
                Text(
                  'Could not load today\'s classes.\n$err',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
