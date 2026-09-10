/// Mirrors src/lib/auth/session.ts's SessionInfo shape, resolved from the
/// same get_current_session() RPC the web app uses.
class SessionInfo {
  final String userId;
  final String name;
  final String phone;
  final String instituteId;
  final String instituteName;
  final String role; // owner | admin_staff | tutor | student

  const SessionInfo({
    required this.userId,
    required this.name,
    required this.phone,
    required this.instituteId,
    required this.instituteName,
    required this.role,
  });

  bool get isOwner => role == 'owner';
  bool get isAdminStaff => role == 'admin_staff';
  bool get isTutor => role == 'tutor';
  bool get isOwnerOrAdminStaff => isOwner || isAdminStaff;

  factory SessionInfo.fromRpcRow(Map<String, dynamic> row) {
    return SessionInfo(
      userId: row['user_id'] as String,
      name: row['name'] as String,
      phone: row['phone'] as String,
      instituteId: row['institute_id'] as String,
      instituteName: row['institute_name'] as String,
      role: row['role'] as String,
    );
  }
}
