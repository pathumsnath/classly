import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/labels/class_labels.dart';
import '../../core/session/session_provider.dart';
import '../../core/time/colombo_time.dart';
import '../../shared/models/class_detail.dart';
import '../subjects/subjects_providers.dart';
import '../tutors/tutors_providers.dart';
import 'classes_providers.dart';

const _days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// Ported from src/app/classes/create-class-form.tsx and
/// src/app/classes/[id]/edit/edit-class-form.tsx — one screen for both,
/// since the fields are near-identical; `classId` null means create.
class ClassFormScreen extends ConsumerStatefulWidget {
  final String? classId;
  const ClassFormScreen({super.key, this.classId});

  @override
  ConsumerState<ClassFormScreen> createState() => _ClassFormScreenState();
}

class _ClassFormScreenState extends ConsumerState<ClassFormScreen> {
  bool get _isEdit => widget.classId != null;

  String? _subjectId;
  String? _grade;
  String? _medium;
  String? _tutorId;
  final Set<String> _scheduleDays = {};
  TimeOfDay? _startTime;
  TimeOfDay? _endTime;
  final _roomController = TextEditingController();
  final _groupNameController = TextEditingController();
  final _maxStudentsController = TextEditingController();
  final _feeAmountController = TextEditingController();
  bool _sessionBilling = false;
  final _billingCycleSessionsController = TextEditingController(text: '4');
  String _cycleStartDate = todayInColombo();

  // Preserved as-is on edit — this form doesn't change pay terms.
  String _tutorPaymentModel = 'revenue_share';
  num _tutorPaymentValue = 0;

  bool _seeded = false;
  bool _saving = false;

  @override
  void dispose() {
    _roomController.dispose();
    _groupNameController.dispose();
    _maxStudentsController.dispose();
    _feeAmountController.dispose();
    _billingCycleSessionsController.dispose();
    super.dispose();
  }

  void _seedFromExisting(ClassDetail cls) {
    if (_seeded) return;
    _seeded = true;
    _subjectId = cls.subjectId;
    _grade = cls.grade;
    _medium = cls.medium;
    _tutorId = cls.tutorId;
    _scheduleDays.addAll(cls.scheduleDays);
    _startTime = _parseTime(cls.scheduleStartTime);
    _endTime = _parseTime(cls.scheduleEndTime);
    _roomController.text = cls.room ?? '';
    _groupNameController.text = cls.groupName ?? '';
    _maxStudentsController.text = cls.maxStudents?.toString() ?? '';
    _feeAmountController.text = formatAmount(cls.feeAmount);
    _sessionBilling = cls.billingCycleSessions != null;
    _billingCycleSessionsController.text = (cls.billingCycleSessions ?? 4)
        .toString();
    _cycleStartDate = cls.cycleStartedAt ?? todayInColombo();
    _tutorPaymentModel = cls.tutorPaymentModel;
    _tutorPaymentValue = cls.tutorPaymentValue;
  }

  void _seedForCreate(num commissionPercent) {
    if (_seeded) return;
    _seeded = true;
    _tutorPaymentModel = 'revenue_share';
    _tutorPaymentValue = 100 - commissionPercent;
  }

  TimeOfDay? _parseTime(String? hhmmss) {
    if (hhmmss == null) return null;
    final parts = hhmmss.split(':');
    return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
  }

  String _formatTimeOfDay(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}:00';

  Future<void> _pickTime({required bool isStart}) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: (isStart ? _startTime : _endTime) ?? TimeOfDay.now(),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startTime = picked;
      } else {
        _endTime = picked;
      }
    });
  }

  Future<void> _pickCycleStartDate() async {
    final initial = DateTime.tryParse(_cycleStartDate) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null) return;
    setState(() {
      _cycleStartDate =
          '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    });
  }

  Future<void> _submit() async {
    if (_subjectId == null) {
      _showError('Select a subject.');
      return;
    }
    if (_grade == null) {
      _showError('Select a grade.');
      return;
    }
    if (_medium == null) {
      _showError('Select a medium.');
      return;
    }
    if (_tutorId == null) {
      _showError('Select a tutor.');
      return;
    }
    if (_scheduleDays.isEmpty) {
      _showError('Select at least one day.');
      return;
    }
    if (_startTime == null || _endTime == null) {
      _showError('Start and end time are required.');
      return;
    }
    final startStr = _formatTimeOfDay(_startTime!);
    final endStr = _formatTimeOfDay(_endTime!);
    if (endStr.compareTo(startStr) <= 0) {
      _showError('End time must be after start time.');
      return;
    }
    final feeAmount = num.tryParse(_feeAmountController.text.trim());
    if (feeAmount == null || feeAmount < 0) {
      _showError('A valid fee amount is required.');
      return;
    }
    final maxStudents = _maxStudentsController.text.trim().isEmpty
        ? null
        : int.tryParse(_maxStudentsController.text.trim());
    if (_maxStudentsController.text.trim().isNotEmpty &&
        (maxStudents == null || maxStudents < 1)) {
      _showError('Max students must be a positive number.');
      return;
    }
    int? billingCycleSessions;
    String? cycleStartDate;
    if (_sessionBilling) {
      billingCycleSessions = int.tryParse(
        _billingCycleSessionsController.text.trim(),
      );
      if (billingCycleSessions == null || billingCycleSessions < 1) {
        _showError('Sessions per billing cycle must be a positive number.');
        return;
      }
      cycleStartDate = _cycleStartDate;
    }

    final session = await ref.read(sessionInfoProvider.future);
    if (!mounted || session == null) return;

    setState(() => _saving = true);
    try {
      final repo = ref.read(classesRepositoryProvider);
      if (_isEdit) {
        await repo.updateClass(
          session,
          classId: widget.classId!,
          subjectId: _subjectId!,
          grade: _grade!,
          medium: _medium!,
          tutorId: _tutorId!,
          scheduleDays: _scheduleDays.toList(),
          scheduleStartTime: startStr,
          scheduleEndTime: endStr,
          room: _roomController.text.trim().isEmpty
              ? null
              : _roomController.text.trim(),
          groupName: _groupNameController.text.trim().isEmpty
              ? null
              : _groupNameController.text.trim(),
          maxStudents: maxStudents,
          feeAmount: feeAmount,
          tutorPaymentModel: _tutorPaymentModel,
          tutorPaymentValue: _tutorPaymentValue,
          billingCycleSessions: billingCycleSessions,
          cycleStartDate: cycleStartDate,
        );
        ref.invalidate(classDetailProvider(widget.classId!));
        ref.invalidate(classesListProvider);
      } else {
        await repo.createClass(
          session,
          subjectId: _subjectId!,
          grade: _grade!,
          medium: _medium!,
          tutorId: _tutorId!,
          scheduleDays: _scheduleDays.toList(),
          scheduleStartTime: startStr,
          scheduleEndTime: endStr,
          room: _roomController.text.trim().isEmpty
              ? null
              : _roomController.text.trim(),
          groupName: _groupNameController.text.trim().isEmpty
              ? null
              : _groupNameController.text.trim(),
          maxStudents: maxStudents,
          feeAmount: feeAmount,
          tutorPaymentValue: _tutorPaymentValue,
          billingCycleSessions: billingCycleSessions,
          cycleStartDate: cycleStartDate,
        );
        ref.invalidate(classesListProvider);
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) _showError('$e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final subjectsAsync = ref.watch(subjectsListProvider);
    final tutorsAsync = ref.watch(tutorsListProvider);
    final commissionAsync = ref.watch(commissionPercentProvider);
    final classDetailAsync = _isEdit
        ? ref.watch(classDetailProvider(widget.classId!))
        : null;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          _isEdit ? 'Edit class' : 'Create a class',
          style: const TextStyle(
            color: Colors.black,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: SafeArea(
        child: subjectsAsync.when(
          data: (allSubjects) => tutorsAsync.when(
            data: (allTutors) {
              final subjects = allSubjects
                  .where((s) => s.status == 'active')
                  .toList();
              final tutors = allTutors
                  .where((t) => t.status == 'active')
                  .toList();

              Widget buildForm() {
                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _DropdownField(
                      label: 'Subject',
                      value: _subjectId,
                      items: [
                        for (final s in subjects) (value: s.id, label: s.name),
                      ],
                      onChanged: (v) => setState(() => _subjectId = v),
                    ),
                    const SizedBox(height: 12),
                    _DropdownField(
                      label: 'Grade',
                      value: _grade,
                      items: [
                        for (final g in gradeOptions)
                          (value: g.value, label: g.label),
                      ],
                      onChanged: (v) => setState(() => _grade = v),
                    ),
                    const SizedBox(height: 12),
                    _DropdownField(
                      label: 'Medium',
                      value: _medium,
                      items: [
                        for (final m in mediumOptions)
                          (value: m.value, label: m.label),
                      ],
                      onChanged: (v) => setState(() => _medium = v),
                    ),
                    const SizedBox(height: 12),
                    _DropdownField(
                      label: 'Tutor',
                      value: _tutorId,
                      items: [
                        for (final t in tutors) (value: t.id, label: t.name),
                      ],
                      onChanged: (v) => setState(() => _tutorId = v),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Days',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF374151),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final day in _days)
                          ChoiceChip(
                            label: Text(day),
                            selected: _scheduleDays.contains(day),
                            onSelected: (selected) => setState(() {
                              if (selected) {
                                _scheduleDays.add(day);
                              } else {
                                _scheduleDays.remove(day);
                              }
                            }),
                            selectedColor: const Color(0xFF4F46E5),
                            labelStyle: TextStyle(
                              color: _scheduleDays.contains(day)
                                  ? Colors.white
                                  : const Color(0xFF4B5563),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _TimeField(
                            label: 'Start time',
                            time: _startTime,
                            onTap: () => _pickTime(isStart: true),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _TimeField(
                            label: 'End time',
                            time: _endTime,
                            onTap: () => _pickTime(isStart: false),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _LabeledField(
                      label: 'Room (optional)',
                      controller: _roomController,
                    ),
                    const SizedBox(height: 12),
                    _LabeledField(
                      label: 'Group / batch name (optional)',
                      controller: _groupNameController,
                    ),
                    const SizedBox(height: 12),
                    _LabeledField(
                      label: 'Max students (optional)',
                      controller: _maxStudentsController,
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 12),
                    _LabeledField(
                      label: 'Fee amount (LKR)',
                      controller: _feeAmountController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF9FAFB),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          CheckboxListTile(
                            value: _sessionBilling,
                            onChanged: (v) =>
                                setState(() => _sessionBilling = v ?? false),
                            title: const Text(
                              'Bill by session count, not calendar month',
                              style: TextStyle(fontSize: 14),
                            ),
                            contentPadding: EdgeInsets.zero,
                            controlAffinity: ListTileControlAffinity.leading,
                          ),
                          if (_sessionBilling) ...[
                            _LabeledField(
                              label: 'Sessions per billing cycle',
                              controller: _billingCycleSessionsController,
                              keyboardType: TextInputType.number,
                            ),
                            const SizedBox(height: 10),
                            const Text(
                              'Cycle start date',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF374151),
                              ),
                            ),
                            const SizedBox(height: 6),
                            InkWell(
                              onTap: _pickCycleStartDate,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 10,
                                  horizontal: 12,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: const Color(0xFFE5E7EB),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Text(_cycleStartDate),
                                    const Spacer(),
                                    const Icon(
                                      Icons.calendar_today,
                                      size: 16,
                                      color: Colors.grey,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              "Sessions are counted from this date onward. If this class already had sessions before you turned this on, backdate it to the first of those — otherwise leave it as today.",
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                            ),
                          ] else
                            const Text(
                              'For a tutor who treats "a month" as any 4 (or however many) sessions they actually hold — the fee generates once that many sessions have attendance recorded, not on a fixed date.',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (!_isEdit) ...[
                      const SizedBox(height: 12),
                      Text(
                        'Tutor is paid ${formatAmount(_tutorPaymentValue)}% of collected fees (institute keeps ${formatAmount(100 - _tutorPaymentValue)}%) — the institute-wide rate, changeable from the dashboard.',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _saving ? null : _submit,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF4F46E5),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: _saving
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(_isEdit ? 'Save changes' : 'Create class'),
                      ),
                    ),
                  ],
                );
              }

              if (_isEdit) {
                return classDetailAsync!.when(
                  data: (cls) {
                    if (cls == null) {
                      return const Center(
                        child: Text(
                          'Class not found.',
                          style: TextStyle(color: Colors.grey),
                        ),
                      );
                    }
                    _seedFromExisting(cls);
                    return buildForm();
                  },
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (err, _) => Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        'Could not load this class.\n$err',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                );
              }

              return commissionAsync.when(
                data: (commission) {
                  _seedForCreate(commission ?? 25);
                  return buildForm();
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, _) {
                  _seedForCreate(25);
                  return buildForm();
                },
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => Center(
              child: Text(
                'Could not load tutors.\n$err',
                textAlign: TextAlign.center,
              ),
            ),
          ),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(
            child: Text(
              'Could not load subjects.\n$err',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}

class _DropdownField extends StatelessWidget {
  final String label;
  final String? value;
  final List<({String value, String label})> items;
  final ValueChanged<String?> onChanged;
  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: Color(0xFF374151),
          ),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              isExpanded: true,
              value: items.any((i) => i.value == value) ? value : null,
              hint: Text('Select $label'.toLowerCase()),
              items: [
                for (final i in items)
                  DropdownMenuItem(value: i.value, child: Text(i.label)),
              ],
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }
}

class _TimeField extends StatelessWidget {
  final String label;
  final TimeOfDay? time;
  final VoidCallback onTap;
  const _TimeField({
    required this.label,
    required this.time,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: Color(0xFF374151),
          ),
        ),
        const SizedBox(height: 6),
        InkWell(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Text(time != null ? time!.format(context) : 'Select'),
          ),
        ),
      ],
    );
  }
}

class _LabeledField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final TextInputType? keyboardType;
  const _LabeledField({
    required this.label,
    required this.controller,
    this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: Color(0xFF374151),
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(
              vertical: 10,
              horizontal: 12,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
          ),
        ),
      ],
    );
  }
}
