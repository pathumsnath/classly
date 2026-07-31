"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/sms";
import { requireOwner, ForbiddenError } from "./require-owner";
import { createInviteToken, verifyInviteToken } from "./invite-token";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// FR-1.1/1.2 — owner signup. Creates the Supabase Auth user (which
// triggers the Send SMS hook -> Notify.lk OTP), then provisions the
// institute/users/user_roles rows via the service-role client — RLS can't
// apply yet since there's no user_roles row for this person until this
// function creates one.
export async function signupOwner(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const instituteName = String(formData.get("instituteName") || "").trim();
  const ownerName = String(formData.get("ownerName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!instituteName || !ownerName || !phone || !password) {
    return { error: "Institute name, your name, phone, and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    phone,
    password,
  });

  if (signUpError || !signUpData.user) {
    return { error: signUpError?.message ?? "Signup failed." };
  }

  const authUserId = signUpData.user.id;
  const admin = createAdminClient();

  // Resume, don't recreate: if the client timed out waiting for a previous
  // attempt's response, Supabase Auth reuses the same (still-unverified)
  // identity on retry rather than erroring. If we already fully provisioned
  // this auth user, just continue to OTP instead of re-inserting (which
  // would hit the auth_user_id unique constraint) and treating that as a
  // fresh failure.
  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (existing) {
    redirect(`/verify-otp?phone=${encodeURIComponent(phone)}`);
  }

  const { data: userRow, error: userError } = await admin
    .from("users")
    .insert({ auth_user_id: authUserId, name: ownerName, phone, email: email || null })
    .select("id")
    .single();

  if (userError || !userRow) {
    // Do NOT delete the auth user here: authUserId may belong to a
    // previous successful attempt (see the resume check above) — deleting
    // it would silently orphan that prior signup via the auth_user_id
    // ON DELETE SET NULL foreign key, which is exactly the bug this
    // comment used to cause.
    return { error: `Could not create user profile: ${userError?.message}` };
  }

  const { data: instituteRow, error: instituteError } = await admin
    .from("institutes")
    .insert({ name: instituteName, owner_id: userRow.id })
    .select("id")
    .single();

  if (instituteError || !instituteRow) {
    return { error: `Could not create institute: ${instituteError?.message}` };
  }

  const { error: roleError } = await admin
    .from("user_roles")
    .insert({ user_id: userRow.id, institute_id: instituteRow.id, role: "owner" });

  if (roleError) {
    return { error: `Could not assign owner role: ${roleError.message}` };
  }

  redirect(`/verify-otp?phone=${encodeURIComponent(phone)}`);
}

// FR-1.3 — phone + password login.
export async function login(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const phone = String(formData.get("phone") || "").trim();
  const password = String(formData.get("password") || "");

  if (!phone || !password) {
    return { error: "Phone and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ phone, password });
  if (error) return { error: error.message };

  redirect("/");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// FR-1.4 — owner invites admin staff. Phone-first (FR-3.4): reuse the
// directory row if this phone is already known (e.g. an existing tutor),
// otherwise create one.
export async function inviteAdminStaff(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireOwner();
  } catch (err) {
    return { error: err instanceof ForbiddenError ? err.message : "Not authorized." };
  }

  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();

  if (!name || !phone) {
    return { error: "Name and phone are required." };
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("users")
    .select("id, auth_user_id")
    .eq("phone", phone)
    .maybeSingle();

  let userId: string;
  if (existing) {
    if (existing.auth_user_id) {
      return { error: "This phone number already has a login account." };
    }
    userId = existing.id;
  } else {
    const { data: created, error } = await admin
      .from("users")
      .insert({ name, phone, email: email || null })
      .select("id")
      .single();
    if (error || !created) {
      return { error: `Could not create user: ${error?.message}` };
    }
    userId = created.id;
  }

  const tempPassword = crypto.randomUUID() + crypto.randomUUID();
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    phone,
    password: tempPassword,
    phone_confirm: true,
  });

  if (authError || !authUser.user) {
    return { error: `Could not create login account: ${authError?.message}` };
  }

  await admin.from("users").update({ auth_user_id: authUser.user.id }).eq("id", userId);

  const { error: roleError } = await admin
    .from("user_roles")
    .insert({ user_id: userId, institute_id: session.instituteId, role: "admin_staff" });

  if (roleError) {
    return { error: `Could not assign admin_staff role: ${roleError.message}` };
  }

  const token = createInviteToken(authUser.user.id);
  const link = `${process.env.NEXT_PUBLIC_APP_URL}/set-password?token=${token}`;
  await sendSms({
    to: phone,
    message: `You've been added as admin staff on Classly. Set your password: ${link}`,
  });

  return { success: true };
}

// FR-1.3 — password reset via OTP, step 2: consume a verified OTP session
// (established client-side via verifyOtp) and set the new password.
export async function updatePassword(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get("password") || "");
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/");
}

// Admin-staff set-password invite link: verifies the signed token, then
// sets the password via the service-role client (no session exists yet).
export async function setPasswordFromInvite(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const payload = verifyInviteToken(token);
  if (!payload) {
    return { error: "This invite link is invalid or has expired." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(payload.userId, { password });
  if (error) return { error: error.message };

  redirect("/login");
}
