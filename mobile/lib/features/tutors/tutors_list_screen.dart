import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/session/session_provider.dart';
import '../../shared/models/tutor_row.dart';
import 'tutors_providers.dart';

class TutorsListScreen extends ConsumerStatefulWidget {
  const TutorsListScreen({super.key});

  @override
  ConsumerState<TutorsListScreen> createState() => _TutorsListScreenState();
}

class _TutorsListScreenState extends ConsumerState<TutorsListScreen> {
  String _query = '';
  final _pending = <String>{};

  Future<void> _toggleStatus(TutorRow tutor) async {
    final session = await ref.read(sessionInfoProvider.future);
    if (session == null) return;
    setState(() => _pending.add(tutor.id));
    final nextStatus = tutor.status == 'active' ? 'inactive' : 'active';
    try {
      await ref
          .read(tutorsRepositoryProvider)
          .setTutorStatus(session, tutor.id, nextStatus);
      ref.invalidate(tutorsListProvider);
      await ref.read(tutorsListProvider.future);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Could not update status.\n$e')));
      }
    } finally {
      if (mounted) setState(() => _pending.remove(tutor.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final tutorsAsync = ref.watch(tutorsListProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Tutors',
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
      ),
      body: SafeArea(
        child: tutorsAsync.when(
          data: (tutors) {
            if (tutors.isEmpty) {
              return const Center(
                child: Text(
                  'No tutors yet.',
                  style: TextStyle(color: Colors.grey),
                ),
              );
            }
            final needle = _query.trim().toLowerCase();
            final visible = tutors
                .where((t) => t.name.toLowerCase().contains(needle))
                .toList();

            return RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(tutorsListProvider);
                await ref.read(tutorsListProvider.future);
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: [
                  TextField(
                    onChanged: (v) => setState(() => _query = v),
                    decoration: InputDecoration(
                      hintText: 'Search tutors…',
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
                        'No tutors match "$_query".',
                        style: const TextStyle(color: Colors.grey),
                      ),
                    )
                  else
                    for (final t in visible) ...[
                      _TutorRowCard(
                        tutor: t,
                        busy: _pending.contains(t.id),
                        onToggleStatus: () => _toggleStatus(t),
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
                'Could not load tutors.\n$err',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TutorRowCard extends StatelessWidget {
  final TutorRow tutor;
  final bool busy;
  final VoidCallback onToggleStatus;
  const _TutorRowCard({
    required this.tutor,
    required this.busy,
    required this.onToggleStatus,
  });

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
          Expanded(
            child: InkWell(
              onTap: () => context.push('/tutors/${tutor.id}'),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: const Color(0xFFEEF2FF),
                    child: Text(
                      tutor.name.isNotEmpty ? tutor.name[0].toUpperCase() : '?',
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
                          tutor.name,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(
                          tutor.phone,
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
          IconButton(
            onPressed: () => context.push('/tutors/${tutor.id}/edit'),
            icon: const Icon(Icons.edit_outlined, size: 20, color: Colors.grey),
            tooltip: 'Edit',
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
                    tutor.status == 'active' ? 'Deactivate' : 'Reactivate',
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
        ],
      ),
    );
  }
}
