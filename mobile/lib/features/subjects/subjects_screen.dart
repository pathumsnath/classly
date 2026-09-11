import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/session/session_provider.dart';
import '../../shared/models/subject_row.dart';
import 'subjects_providers.dart';

class SubjectsScreen extends ConsumerStatefulWidget {
  const SubjectsScreen({super.key});

  @override
  ConsumerState<SubjectsScreen> createState() => _SubjectsScreenState();
}

class _SubjectsScreenState extends ConsumerState<SubjectsScreen> {
  final _pending = <String>{};

  Future<void> _toggleStatus(SubjectRow subject) async {
    final session = await ref.read(sessionInfoProvider.future);
    if (!mounted || session == null) return;
    setState(() => _pending.add(subject.id));
    final nextStatus = subject.status == 'active' ? 'inactive' : 'active';
    try {
      await ref
          .read(subjectsRepositoryProvider)
          .setSubjectStatus(session, subject.id, nextStatus);
      ref.invalidate(subjectsListProvider);
      await ref.read(subjectsListProvider.future);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Could not update status.\n$e')));
      }
    } finally {
      if (mounted) setState(() => _pending.remove(subject.id));
    }
  }

  Future<void> _addSubject() async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add subject'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Subject name'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text('Add'),
          ),
        ],
      ),
    );
    if (name == null || name.isEmpty) return;

    final session = await ref.read(sessionInfoProvider.future);
    if (!mounted || session == null) return;
    try {
      await ref.read(subjectsRepositoryProvider).addSubject(session, name);
      ref.invalidate(subjectsListProvider);
      await ref.read(subjectsListProvider.future);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final subjectsAsync = ref.watch(subjectsListProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Subjects',
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _addSubject,
        backgroundColor: const Color(0xFF4F46E5),
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: SafeArea(
        child: subjectsAsync.when(
          data: (subjects) {
            if (subjects.isEmpty) {
              return const Center(
                child: Text(
                  'No subjects yet — add your first one.',
                  style: TextStyle(color: Colors.grey),
                ),
              );
            }
            return RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(subjectsListProvider);
                await ref.read(subjectsListProvider.future);
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: [
                  for (final s in subjects) ...[
                    _SubjectRowCard(
                      subject: s,
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
                'Could not load subjects.\n$err',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SubjectRowCard extends StatelessWidget {
  final SubjectRow subject;
  final bool busy;
  final VoidCallback onToggleStatus;
  const _SubjectRowCard({
    required this.subject,
    required this.busy,
    required this.onToggleStatus,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              subject.name,
              style: const TextStyle(fontWeight: FontWeight.w600),
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
                    subject.status == 'active' ? 'Deactivate' : 'Reactivate',
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
        ],
      ),
    );
  }
}
