/// Mirrors src/lib/people/queries.ts's TutorRow.
class TutorRow {
  final String id;
  final String name;
  final String phone;
  final String? email;
  final String status;
  final num? commissionOverridePercent;
  // Null when not fetched (the list screen doesn't need it) — only the
  // detail screen resolves this, mirroring src/lib/people/queries.ts's
  // getPerson().hasLogin.
  final bool? hasLogin;

  const TutorRow({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    required this.status,
    required this.commissionOverridePercent,
    this.hasLogin,
  });
}
