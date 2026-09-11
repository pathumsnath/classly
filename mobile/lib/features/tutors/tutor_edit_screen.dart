import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/session/session_provider.dart';
import '../classes/classes_providers.dart';
import 'tutors_providers.dart';

class TutorEditScreen extends ConsumerStatefulWidget {
  final String tutorId;
  const TutorEditScreen({super.key, required this.tutorId});

  @override
  ConsumerState<TutorEditScreen> createState() => _TutorEditScreenState();
}

class _TutorEditScreenState extends ConsumerState<TutorEditScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _commissionController = TextEditingController();
  bool _overrideEnabled = false;
  bool _seeded = false;
  bool _saving = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _commissionController.dispose();
    super.dispose();
  }

  void _seed(
    num defaultCommissionPercent, {
    required String name,
    required String phone,
    String? email,
    num? override,
  }) {
    if (_seeded) return;
    _seeded = true;
    _nameController.text = name;
    _phoneController.text = phone;
    _emailController.text = email ?? '';
    _overrideEnabled = override != null;
    _commissionController.text = (override ?? defaultCommissionPercent)
        .toString();
  }

  Future<void> _save() async {
    final session = await ref.read(sessionInfoProvider.future);
    if (!mounted || session == null) return;

    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();
    if (name.isEmpty || phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name and phone are required.')),
      );
      return;
    }

    num? commissionOverridePercent;
    if (_overrideEnabled) {
      final parsed = num.tryParse(_commissionController.text.trim());
      if (parsed == null || parsed < 0 || parsed > 100) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'A valid commission percent (0–100) is required when overriding.',
            ),
          ),
        );
        return;
      }
      commissionOverridePercent = parsed;
    }

    setState(() => _saving = true);
    try {
      await ref
          .read(tutorsRepositoryProvider)
          .updateTutor(
            session,
            tutorId: widget.tutorId,
            name: name,
            phone: phone,
            email: _emailController.text.trim().isEmpty
                ? null
                : _emailController.text.trim(),
            commissionOverridePercent: commissionOverridePercent,
          );
      ref.invalidate(tutorDetailProvider(widget.tutorId));
      ref.invalidate(tutorsListProvider);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Could not save.\n$e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tutorAsync = ref.watch(tutorDetailProvider(widget.tutorId));
    final commissionAsync = ref.watch(commissionPercentProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Edit tutor',
          style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
        ),
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
            final defaultCommission = commissionAsync.value ?? 25;
            _seed(
              defaultCommission,
              name: tutor.name,
              phone: tutor.phone,
              email: tutor.email,
              override: tutor.commissionOverridePercent,
            );

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _LabeledField(label: 'Name', controller: _nameController),
                const SizedBox(height: 12),
                _LabeledField(
                  label: 'Phone',
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 12),
                _LabeledField(
                  label: 'Email (optional)',
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
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
                        value: _overrideEnabled,
                        onChanged: (v) =>
                            setState(() => _overrideEnabled = v ?? false),
                        title: const Text(
                          'Override the institute commission rate',
                          style: TextStyle(fontSize: 14),
                        ),
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                      ),
                      if (_overrideEnabled)
                        _LabeledField(
                          label: 'Institute commission for this tutor (%)',
                          controller: _commissionController,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _saving ? null : _save,
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
                        : const Text('Save'),
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
