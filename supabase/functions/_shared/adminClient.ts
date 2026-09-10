import { createClient } from "npm:@supabase/supabase-js@2";

// Service-role client — bypasses RLS. Only ever used after resolveSession()
// + assertClassAccess() have already established who's calling and that
// they're allowed to touch this specific class. Never accept an
// instituteId/role from the request body itself.
export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
