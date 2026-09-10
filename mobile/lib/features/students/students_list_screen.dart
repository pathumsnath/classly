import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/session/session_provider.dart';
import '../../shared/models/student_row.dart';
import 'students_providers.dart';

class StudentsListScreen extends ConsumerStatefulWidget {
  const StudentsListScreen({super.key});

  @override
  ConsumerState<StudentsListScreen> createState() => _StudentsListScreenState();
}

class _StudentsListScreenState extends ConsumerState<StudentsListScreen> {
  String _query = '';
  final _pending = <String>{};

  Future<void> _toggleStatus(StudentRow student) async {
    final session = await ref.read(sessionInfoProvider.future);
    if (session == null) return;
    setState(() => _pending.add(student.id));
    final nextStatus = student.status == 'active' ? 'inactive' : 'active';
    try {
      await ref
          .read(studentsRepositoryProvider)
          .setStudentStatus(session, student.id, nextStatus);
      ref.invalidate(studentsListProvider);
      await ref.read(studentsListProvider.future);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Could not update status.\n$e')));
      }
    } finally {
      if (mounted) setState(() => _pending.remove(student.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final studentsAsync = ref.watch(studentsListProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Students',
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
      ),
      body: SafeArea(
        child: studentsAsync.when(
          data: (students) {
            if (students.isEmpty) {
              return const Center(
                child: Text(
                  'No students yet.',
                  style: TextStyle(color: Colors.grey),
                ),
              );
            }
            final needle = _query.trim().toLowerCase();
            final visible = students
                .where((s) => s.name.toLowerCase().contains(needle))
                .toList();

            return RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(studentsListProvider);
                await ref.read(studentsListProvider.future);
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: [
                  TextField(
                    onChanged: (v) => setState(() => _query = v),
                    decoration: InputDecoration(
                      hintText: 'Search students…',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(
                        vertical: 0,
                        horizontal: 12,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (visible.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        'No students match "$_query".',
                        style: const TextStyle(color: Colors.grey),
                      ),
                    )
                  else
                    for (final s in visible) ...[
                      _StudentRowCard(
                        student: s,
                        busy: _pending.contains(s.id),
                        onToggleStatus: () => _toggleStatus(s),
                      ),
                      const SizedBox(height: 8),
                    ],
                ],
              ),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Could not load students.\n$err',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _StudentRowCard extends StatelessWidget {
  final StudentRow student;
  final bool busy;
  final VoidCallback onToggleStatus;
  const _StudentRowCard({
    required this.student,
    required this.busy,
    required this.onToggleStatus,
  });

  @override
  Widget build(BuildContext context) {
    final subtitle = student.parentPhone != null
        ? '${student.phone} · parent: ${student.parentPhone}'
        : student.phone;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: () => context.push('/students/${student.id}'),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: const Color(0xFFEEF2FF),
                    child: Text(
                      student.name.isNotEmpty
                          ? student.name[0].toUpperCase()
                          : '?',
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
                        Text(
                          student.name,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(
                          subtitle,
                          style: const TextStyle(
                            color: Colors.grey,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          busy
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : TextButton(
                  onPressed: onToggleStatus,
                  child: Text(
                    student.status == 'active' ? 'Deactivate' : 'Reactivate',
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
        ],
      ),
    );
  }
}
