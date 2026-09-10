import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../supabase/client.dart';
import 'session_info.dart';

/// Re-emits on every sign-in/sign-out/token-refresh — sessionInfoProvider
/// watches this so it re-resolves whenever auth state actually changes.
final authStateProvider = StreamProvider<AuthState>((ref) {
  return supabase.auth.onAuthStateChange;
});

/// The same one-round-trip identity resolution the web app's
/// getSessionInfo() does via get_current_session() — auth.uid() resolves
/// from the request's own JWT, so no separate "verify the user" step is
/// needed before this. Returns null for "signed in but no role/institute
/// row yet" the same way the web app's requireSession() treats that case,
/// not as a crash.
final sessionInfoProvider = FutureProvider<SessionInfo?>((ref) async {
  ref.watch(authStateProvider);

  if (supabase.auth.currentSession == null) return null;

  try {
    final row = await supabase.rpc('get_current_session').single();
    return SessionInfo.fromRpcRow(row);
  } on PostgrestException {
    return null;
  }
});
