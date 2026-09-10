// The Supabase anon/publishable key is meant to be shipped in client
// apps (it's what the new "publishable key" naming reflects) — RLS is
// what actually protects data, not keeping this secret. The service-role
// key must NEVER appear here; it only ever lives in Edge Function
// environment variables (see supabase/functions/_shared/adminClient.ts
// in the web app's repo root).
class Env {
  static const supabaseUrl = 'https://kpmhuawzdarzwwvdualz.supabase.co';
  static const supabaseAnonKey =
      'sb_publishable_gfjTQ6bLn0qOO2YniQkZfQ_dLggjzU5';
}
