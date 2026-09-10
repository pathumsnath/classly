import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/session/session_provider.dart';
import '../../shared/models/today_class.dart';
import '../auth/auth_repository.dart';
import 'today_providers.dart';

const _bucketColors = {
  ClassBucket.now: Color(0xFF22C55E),
  ClassBucket.upcoming: Color(0xFFD1D5DB),
  ClassBucket.done: Color(0xFFE5E7EB),
};

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
            data: (classes) => _TodayList(classes: classes),
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

class _TodayList extends StatelessWidget {
  final List<TodayClass> classes;
  const _TodayList({required this.classes});

  @override
  Widget build(BuildContext context) {
    if (classes.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: const [
          SizedBox(height: 80),
          Icon(Icons.event_available, color: Colors.grey, size: 40),
          SizedBox(height: 12),
          Text(
            'Nothing scheduled today.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey),
          ),
        ],
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      itemCount: classes.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, index) => _TodayClassCard(cls: classes[index]),
    );
  }
}

class _TodayClassCard extends StatelessWidget {
  final TodayClass cls;
  const _TodayClassCard({required this.cls});

  String get _label {
    switch (cls.bucket) {
      case ClassBucket.now:
        return 'Mark attendance';
      case ClassBucket.upcoming:
        return 'Mark attendance';
      case ClassBucket.done:
        return 'View';
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = cls.groupName != null
        ? '${cls.subject} (${cls.groupName})'
        : cls.subject;
    final timeText = cls.scheduleStartTime != null
        ? '${_formatTime(cls.scheduleStartTime!)}${cls.scheduleEndTime != null ? '–${_formatTime(cls.scheduleEndTime!)}' : ''}'
        : null;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF3F4F6)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: _bucketColors[cls.bucket],
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  [cls.tutorName, ?timeText].join(' · '),
                  style: const TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],
            ),
          ),
          FilledButton(
            onPressed: () {
              context.push(
                '/attendance/${cls.id}',
                extra: <String, String?>{
                  'title': title,
                  'subtitle': cls.tutorName,
                },
              );
            },
            style: FilledButton.styleFrom(
              backgroundColor: cls.bucket == ClassBucket.done
                  ? const Color(0xFFF3F4F6)
                  : const Color(0xFF4F46E5),
              foregroundColor: cls.bucket == ClassBucket.done
                  ? Colors.grey.shade700
                  : Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            ),
            child: Text(_label, style: const TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }
}

String _formatTime(String hhmmss) {
  final parts = hhmmss.split(':');
  final h = int.parse(parts[0]);
  final m = int.parse(parts[1]);
  final period = h >= 12 ? 'PM' : 'AM';
  final h12 = h % 12 == 0 ? 12 : h % 12;
  return '$h12:${m.toString().padLeft(2, '0')} $period';
}
