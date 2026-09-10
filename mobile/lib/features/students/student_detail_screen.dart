import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/labels/class_labels.dart';
import '../../shared/models/student_row.dart';
import 'students_providers.dart';

class StudentDetailScreen extends ConsumerWidget {
  final String studentId;
  const StudentDetailScreen({super.key, required this.studentId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentAsync = ref.watch(studentDetailProvider(studentId));
    final walletAsync = ref.watch(studentWalletBalanceProvider(studentId));
    final classesAsync = ref.watch(studentClassesProvider(studentId));

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: studentAsync.when(
          data: (s) => Text(
            s?.name ?? 'Student',
            style: const TextStyle(
              color: Colors.black,
              fontWeight: FontWeight.bold,
            ),
          ),
          loading: () =>
              const Text('Student', style: TextStyle(color: Colors.black)),
          error: (_, _) =>
              const Text('Student', style: TextStyle(color: Colors.black)),
        ),
      ),
      body: SafeArea(
        child: studentAsync.when(
          data: (student) {
            if (student == null) {
              return const Center(
                child: Text(
                  'Student not found.',
                  style: TextStyle(color: Colors.grey),
                ),
              );
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  student.parentPhone != null
                      ? '${student.phone} · parent: ${student.parentPhone}'
                      : student.phone,
                  style: const TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 16),
                walletAsync.when(
                  data: (balance) => _WalletCard(balance: balance),
                  loading: () => const SizedBox.shrink(),
                  error: (_, _) => const SizedBox.shrink(),
                ),
                const SizedBox(height: 24),
                const Text(
                  'CLASSES',
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
                    final active = classes
                        .where((c) => c.enrollmentStatus == 'active')
                        .toList();
                    if (active.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Center(
                          child: Text(
                            'Not enrolled in any classes.',
                            style: TextStyle(color: Colors.grey),
                          ),
                        ),
                      );
                    }
                    return Column(
                      children: [
                        for (final c in active) ...[
                          _EnrolledClassCard(cls: c),
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
                'Could not load this student.\n$err',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _WalletCard extends StatelessWidget {
  final num balance;
  const _WalletCard({required this.balance});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: Color(0xFFEEF2FF),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.account_balance_wallet,
              color: Color(0xFF4F46E5),
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Wallet balance',
                style: TextStyle(color: Colors.grey, fontSize: 12),
              ),
              Text(
                'LKR ${formatAmount(balance)}',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EnrolledClassCard extends StatelessWidget {
  final EnrolledClassForStudent cls;
  const _EnrolledClassCard({required this.cls});

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
                    '${cls.tutorName} · ${formatGrade(cls.grade)} · ${formatMedium(cls.medium)}',
                    style: const TextStyle(color: Colors.grey, fontSize: 13),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.grey),
          ],
        ),
      ),
    );
  }
}
