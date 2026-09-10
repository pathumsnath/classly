import '../../core/supabase/client.dart';

/// Identical call to the web app's login Server Action
/// (src/lib/auth/actions.ts) — phone+password is the only login method,
/// no email/username path exists anywhere in this app.
class AuthRepository {
  Future<void> signIn({required String phone, required String password}) async {
    await supabase.auth.signInWithPassword(phone: phone, password: password);
  }

  Future<void> signOut() async {
    await supabase.auth.signOut();
  }
}
