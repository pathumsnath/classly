import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/labels/class_labels.dart';
import '../../shared/models/class_row.dart';
import 'tutors_providers.dart';

class TutorDetailScreen extends ConsumerWidget {
  final String tutorId;
  const TutorDetailScreen({super.key, required this.tutorId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tutorAsync = ref.watch(tutorDetailProvider(tutorId));
    final classesAsync = ref.watch(tutorClassesProvider(tutorId));

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: tutorAsync.when(
          data: (t) => Text(
            t?.name ?? 'Tutor',
            style: const TextStyle(
              color: Colors.black,
              fontWeight: FontWeight.bold,
            ),
          ),
          loading: () =>
              const Text('Tutor', style: TextStyle(color: Colors.black)),
          error: (_, _) =>
              const Text('Tutor', style: TextStyle(color: Colors.black)),
        ),
        actions: [
          if (tutorAsync.value != null)
            IconButton(
              onPressed: () => context.push('/tutors/$tutorId/edit'),
              icon: const Icon(Icons.edit_outlined, color: Colors.grey),
            ),
        ],
      ),
      body: SafeArea(
        child: tutorAsync.when(
          data: (tutor) {
            if (tutor == null) {
              return const Center(
                child: Text(
                  'Tutor not found.',
                  style: TextStyle(color: Colors.grey),
                ),
              );
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(tutor.phone, style: const TextStyle(color: Colors.grey)),
                const SizedBox(height: 8),
                if (tutor.hasLogin == true)
                  const Text(
                    'Has login access.',
                    style: TextStyle(color: Colors.grey, fontSize: 13),
                  )
                else if (tutor.hasLogin == false)
                  TextButton.icon(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Inviting tutors is coming in a future build.',
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.send, size: 16),
                    label: const Text(
                      'Invite to log in',
                      style: TextStyle(fontSize: 13),
                    ),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      alignment: Alignment.centerLeft,
                    ),
                  ),
                const SizedBox(height: 24),
                const Text(
                  'CLASSES TAUGHT',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 8),
                classesAsync.when(
                  data: (classes) {
                    if (classes.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Center(
                          child: Text(
                            'Not assigned to any classes yet.',
                            style: TextStyle(color: Colors.grey),
                          ),
                        ),
                      );
                    }
                    return Column(
                      children: [
                        for (final c in classes) ...[
                          _TutorClassCard(cls: c),
                          const SizedBox(height: 8),
                        ],
                      ],
                    );
                  },
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (err, _) => Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      'Could not load classes.\n$err',
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Could not load this tutor.\n$err',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TutorClassCard extends StatelessWidget {
  final ClassRow cls;
  const _TutorClassCard({required this.cls});

  @override
  Widget build(BuildContext context) {
    final title = cls.groupName != null
        ? '${cls.subject} (${cls.groupName})'
        : cls.subject;
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => context.push('/classes/${cls.id}'),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFF3F4F6)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    '${formatGrade(cls.grade)} · ${formatMedium(cls.medium)}',
                    style: const TextStyle(color: Colors.grey, fontSize: 13),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.people, size: 14, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text(
                    '${cls.studentCount}',
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
