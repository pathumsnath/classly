import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/supabase/types";

export interface SessionInfo {
  userId: string;
  name: string;
  phone: string;
  instituteId: string;
  instituteName: string;
  role: AppRole;
}

// Backed by the get_current_session() SQL function (0001_init.sql), which
// resolves auth.uid() -> users -> user_roles -> institutes in one call.
//
// Wrapped in React's cache() — nearly every page-level query function
// calls requireSession()/requireOwner() independently (defense in depth,
// see plan), and each call was re-running both the Supabase Auth check
// and this RPC from scratch. A page composing 3-4 queries in parallel was
// making 3-4x the actual session round trips. cache() dedupes all of that
// to a single resolution per request, since this function takes no args.
export const getSessionInfo = cache(async (): Promise<SessionInfo | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("get_current_session").single();
  if (error || !data) return null;

  return {
    userId: data.user_id,
    name: data.name,
    phone: data.phone,
    instituteId: data.institute_id,
    instituteName: data.institute_name,
    role: data.role,
  };
});
