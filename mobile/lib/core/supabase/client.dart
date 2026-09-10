import 'package:supabase_flutter/supabase_flutter.dart';
import '../env.dart';

Future<void> initSupabase() async {
  await Supabase.initialize(
    url: Env.supabaseUrl,
    publishableKey: Env.supabaseAnonKey,
  );
}

/// The single Supabase client for the whole app — auth session persistence
/// and token refresh are handled automatically by supabase_flutter.
SupabaseClient get supabase => Supabase.instance.client;
