import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/labels/class_labels.dart';
import '../models/today_class.dart';

const _bucketColors = {
  ClassBucket.now: Color(0xFF22C55E),
  ClassBucket.upcoming: Color(0xFFD1D5DB),
  ClassBucket.done: Color(0xFFE5E7EB),
};

/// Shared between the tutor's Today screen and the owner/admin_staff
/// dashboard's "Today's classes" section — same card, same tap target
/// (mirrors web's TodaysClassesList in src/app/page.tsx).
class TodayClassesList extends StatelessWidget {
  final List<TodayClass> classes;
  const TodayClassesList({super.key, required this.classes});

  @override
  Widget build(BuildContext context) {
    if (classes.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          children: [
            SizedBox(height: 16),
            Icon(Icons.event_available, color: Colors.grey, size: 40),
            SizedBox(height: 12),
            Text(
              'Nothing scheduled today.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        for (final cls in classes) ...[
          TodayClassCard(cls: cls),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class TodayClassCard extends StatelessWidget {
  final TodayClass cls;
  const TodayClassCard({super.key, required this.cls});

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
        ? '${formatTime12h(cls.scheduleStartTime!)}${cls.scheduleEndTime != null ? '–${formatTime12h(cls.scheduleEndTime!)}' : ''}'
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
