import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/labels/class_labels.dart';
import '../../shared/models/class_detail.dart';
import 'classes_providers.dart';

class ClassDetailScreen extends ConsumerWidget {
  final String classId;
  const ClassDetailScreen({super.key, required this.classId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(classDetailProvider(classId));
    final studentsAsync = ref.watch(enrolledStudentsProvider(classId));
    final commissionAsync = ref.watch(commissionPercentProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: detailAsync.when(
          data: (cls) => Text(
            cls == null
                ? 'Class'
                : (cls.groupName != null
                      ? '${cls.subject} — ${cls.groupName}'
                      : cls.subject),
            style: const TextStyle(
              color: Colors.black,
              fontWeight: FontWeight.bold,
            ),
          ),
          loading: () =>
              const Text('Class', style: TextStyle(color: Colors.black)),
          error: (_, _) =>
              const Text('Class', style: TextStyle(color: Colors.black)),
        ),
        actions: [
          if (detailAsync.value != null)
            IconButton(
              icon: const Icon(Icons.edit_outlined, color: Colors.grey),
              onPressed: () async {
                await context.push('/classes/$classId/edit');
                ref.invalidate(classDetailProvider(classId));
                ref.invalidate(classesListProvider);
              },
            ),
        ],
      ),
      body: SafeArea(
        child: detailAsync.when(
          data: (cls) {
            if (cls == null) {
              return const Center(
                child: Text(
                  'Class not found.',
                  style: TextStyle(color: Colors.grey),
                ),
              );
            }

            final commissionPercent = commissionAsync.value;
            final tutorPaymentValue =
                cls.tutorPaymentModel == 'revenue_share' &&
                    commissionPercent != null
                ? 100 - commissionPercent
                : cls.tutorPaymentValue;

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _InfoCard(cls: cls, tutorPaymentValue: tutorPaymentValue),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () {
                      context.push(
                        '/attendance/${cls.id}',
                        extra: <String, String?>{
                          'title': cls.groupName != null
                              ? '${cls.subject} (${cls.groupName})'
                              : cls.subject,
                          'subtitle': cls.tutorName,
                        },
                      );
                    },
                    icon: const Icon(Icons.assignment_turned_in, size: 18),
                    label: const Text('Take attendance'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF4F46E5),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'ENROLLED STUDENTS',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey,
                        letterSpacing: 0.5,
                      ),
                    ),
                    TextButton.icon(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Enrolling students is coming in a future build.',
                            ),
                          ),
                        );
                      },
                      icon: const Icon(Icons.person_add, size: 16),
                      label: const Text(
                        'Enroll',
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                studentsAsync.when(
                  data: (students) {
                    if (students.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Center(
                          child: Text(
                            'No students enrolled yet.',
                            style: TextStyle(color: Colors.grey),
                          ),
                        ),
                      );
                    }
                    return Column(
                      children: [
                        for (final s in students) ...[
                          _StudentRow(name: s.name, phone: s.phone),
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
                      'Could not load students.\n$err',
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
                'Could not load this class.\n$err',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final ClassDetail cls;
  final num tutorPaymentValue;
  const _InfoCard({required this.cls, required this.tutorPaymentValue});

  @override
  Widget build(BuildContext context) {
    final scheduleText = cls.scheduleDays.isEmpty
        ? 'no schedule'
        : cls.scheduleDays.join(', ');
    final timeText = cls.scheduleStartTime != null
        ? ' at ${formatTime(cls.scheduleStartTime)}${cls.scheduleEndTime != null ? '–${formatTime(cls.scheduleEndTime)}' : ''}'
        : '';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _InfoRow(
            icon: Icons.school,
            text: '${formatGrade(cls.grade)} · ${formatMedium(cls.medium)}',
          ),
          const SizedBox(height: 10),
          _InfoRow(
            icon: Icons.calendar_today,
            text: '${cls.tutorName} · $scheduleText$timeText',
          ),
          if (cls.room != null) ...[
            const SizedBox(height: 10),
            _InfoRow(icon: Icons.meeting_room, text: cls.room!),
          ],
          const SizedBox(height: 10),
          _InfoRow(
            icon: Icons.account_balance_wallet,
            text:
                'LKR ${formatAmount(cls.feeAmount)}/month · tutor: ${formatAmount(tutorPaymentValue)}% share',
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: Colors.grey),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 14, color: Color(0xFF374151)),
          ),
        ),
      ],
    );
  }
}

class _StudentRow extends StatelessWidget {
  final String name;
  final String phone;
  const _StudentRow({required this.name, required this.phone});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: const Color(0xFFEEF2FF),
            child: Text(
              name.isNotEmpty ? name[0].toUpperCase() : '?',
              style: const TextStyle(
                color: Color(0xFF4F46E5),
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                Text(
                  phone,
                  style: const TextStyle(color: Colors.grey, fontSize: 13),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Unenrolling is coming in a future build.'),
                ),
              );
            },
            child: const Text('Unenrol', style: TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }
}
