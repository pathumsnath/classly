import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/labels/class_labels.dart';
import '../../shared/models/class_row.dart';
import 'classes_providers.dart';

class ClassesListScreen extends ConsumerStatefulWidget {
  const ClassesListScreen({super.key});

  @override
  ConsumerState<ClassesListScreen> createState() => _ClassesListScreenState();
}

class _ClassesListScreenState extends ConsumerState<ClassesListScreen> {
  String _query = '';
  String? _gradeFilter;
  String? _subjectFilter;

  @override
  Widget build(BuildContext context) {
    final classesAsync = ref.watch(classesListProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Classes',
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
      ),
      body: SafeArea(
        child: classesAsync.when(
          data: (classes) {
            if (classes.isEmpty) {
              return const Center(
                child: Text(
                  'No classes yet.',
                  style: TextStyle(color: Colors.grey),
                ),
              );
            }

            final subjectOptions = {for (final c in classes) c.subject}.toList()
              ..sort();
            final gradeOptions = <String>{
              for (final c in classes)
                if (c.grade != null) c.grade!,
            };
            final visibleGradeOptions = gradeOptions
                .map((g) => formatGrade(g))
                .toSet();

            final needle = _query.trim().toLowerCase();
            final visible = classes.where((c) {
              if (_gradeFilter != null && c.grade != _gradeFilter) {
                return false;
              }
              if (_subjectFilter != null && c.subject != _subjectFilter) {
                return false;
              }
              final haystack =
                  '${c.subject} ${formatGrade(c.grade)} ${formatMedium(c.medium)} ${c.tutorName}'
                      .toLowerCase();
              return haystack.contains(needle);
            }).toList();

            return RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(classesListProvider);
                await ref.read(classesListProvider.future);
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: [
                  TextField(
                    onChanged: (v) => setState(() => _query = v),
                    decoration: InputDecoration(
                      hintText: 'Search by subject, grade, or tutor…',
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
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _FilterDropdown(
                          hint: 'All grades',
                          value: _gradeFilter == null
                              ? null
                              : formatGrade(_gradeFilter),
                          options: visibleGradeOptions.toList(),
                          onChanged: (label) {
                            setState(() {
                              _gradeFilter = label == null
                                  ? null
                                  : gradeOptions.firstWhere(
                                      (g) => formatGrade(g) == label,
                                    );
                            });
                          },
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _FilterDropdown(
                          hint: 'All subjects',
                          value: _subjectFilter,
                          options: subjectOptions,
                          onChanged: (v) => setState(() => _subjectFilter = v),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (visible.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        _query.isNotEmpty
                            ? 'No classes match "$_query".'
                            : 'No classes match the selected filters.',
                        style: const TextStyle(color: Colors.grey),
                      ),
                    )
                  else
                    for (final cls in visible) ...[
                      _ClassCard(cls: cls),
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
                'Could not load classes.\n$err',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FilterDropdown extends StatelessWidget {
  final String hint;
  final String? value;
  final List<String> options;
  final ValueChanged<String?> onChanged;

  const _FilterDropdown({
    required this.hint,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String?>(
          isExpanded: true,
          value: value,
          hint: Text(
            hint,
            style: const TextStyle(fontSize: 13, color: Colors.grey),
          ),
          items: [
            DropdownMenuItem(
              value: null,
              child: Text(hint, style: const TextStyle(fontSize: 13)),
            ),
            for (final o in options)
              DropdownMenuItem(
                value: o,
                child: Text(o, style: const TextStyle(fontSize: 13)),
              ),
          ],
          onChanged: onChanged,
        ),
      ),
    );
  }
}

class _ClassCard extends StatelessWidget {
  final ClassRow cls;
  const _ClassCard({required this.cls});

  @override
  Widget build(BuildContext context) {
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
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      Text(
                        '${cls.subject} · ${formatGrade(cls.grade)}',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      _Pill(
                        text: formatMedium(cls.medium),
                        bg: const Color(0xFFF5F3FF),
                        fg: const Color(0xFF7C3AED),
                      ),
                      if (cls.groupName != null)
                        _Pill(
                          text: cls.groupName!,
                          bg: const Color(0xFFFFFBEB),
                          fg: const Color(0xFFB45309),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    cls.tutorName,
                    style: const TextStyle(color: Colors.grey, fontSize: 13),
                  ),
                  Text(
                    cls.scheduleDays.isEmpty
                        ? 'no schedule set'
                        : '${cls.scheduleDays.join(', ')}'
                              '${cls.scheduleStartTime != null ? ' · ${formatTime(cls.scheduleStartTime)}${cls.scheduleEndTime != null ? '–${formatTime(cls.scheduleEndTime)}' : ''}' : ''}',
                    style: const TextStyle(color: Colors.grey, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
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

class _Pill extends StatelessWidget {
  final String text;
  final Color bg;
  final Color fg;
  const _Pill({required this.text, required this.bg, required this.fg});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: fg),
      ),
    );
  }
}
