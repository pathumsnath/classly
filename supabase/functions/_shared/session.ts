import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface CallerSession {
  userId: string;
  name: string;
  phone: string;
  instituteId: string;
  instituteName: string;
  role: "owner" | "admin_staff" | "tutor" | "student";
}

// The only trusted source of "who is calling and from where." Never trust
// a client-supplied instituteId/role in a request body — this always
// re-derives identity from the caller's own forwarded JWT via the same
// get_current_session() RPC the web app's getSessionInfo() uses
// (supabase/migrations/0001_init.sql). auth.uid() resolves from the JWT
// itself once PostgREST verifies it; nothing here decides trust, it just
// reads what's already been verified.
export async function resolveSession(req: Request): Promise<{ session: CallerSession; asUser: SupabaseClient } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const asUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error } = await asUser.rpc("get_current_session").single();
  if (error || !data) return null;

  const row = data as {
    user_id: string;
    name: string;
    phone: string;
    institute_id: string;
    institute_name: string;
    role: CallerSession["role"];
  };

  return {
    session: {
      userId: row.user_id,
      name: row.name,
      phone: row.phone,
      instituteId: row.institute_id,
      instituteName: row.institute_name,
      role: row.role,
    },
    asUser,
  };
}

// A tutor may only ever act on a class they teach; owner/admin_staff act
// institute-wide. This check does not exist in the web app's Server
// Actions today (see the Flutter plan's Finding A) — every Edge Function
// must call this before touching the service-role client.
export async function assertClassAccess(
  admin: SupabaseClient,
  session: CallerSession,
  classId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: cls } = await admin
    .from("classes")
    .select("institute_id, tutor_id")
    .eq("id", classId)
    .maybeSingle();

  if (!cls || cls.institute_id !== session.instituteId) {
    return { ok: false, message: "Class not found." };
  }
  if (session.role === "tutor" && cls.tutor_id !== session.userId) {
    return { ok: false, message: "You don't teach this class." };
  }
  if (session.role !== "owner" && session.role !== "admin_staff" && session.role !== "tutor") {
    return { ok: false, message: "Not authorized." };
  }
  return { ok: true };
}
