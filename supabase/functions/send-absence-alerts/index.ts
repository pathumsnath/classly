import { resolveSession, assertClassAccess } from "../_shared/session.ts";
import { createAdminClient } from "../_shared/adminClient.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { sendSms } from "../_shared/sms.ts";

// Deliberately minimal input — never accept a client-supplied recipient
// list, even though Flutter reads "who's absent" directly beforehand
// (plain RLS read) to render the confirmation UI. Always re-derive
// absentees server-side before texting, so a crafted payload can't be
// used to spam arbitrary numbers.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const resolved = await resolveSession(req);
  if (!resolved) return jsonResponse({ error: "Not signed in." }, 401);
  const { session } = resolved;

  let body: { classId?: string; date?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const { classId, date } = body;
  if (!classId || !date) return jsonResponse({ error: "Missing classId or date." }, 400);

  const admin = createAdminClient();

  const access = await assertClassAccess(admin, session, classId);
  if (!access.ok) return jsonResponse({ error: access.message }, 403);

  const { data: absentRows } = await admin
    .from("attendance")
    .select("enrollment_id")
    .eq("class_id", classId)
    .eq("date", date)
    .eq("status", "absent");

  if (!absentRows || absentRows.length === 0) return jsonResponse({ sent: 0 });

  const enrollmentIds = absentRows.map((a: { enrollment_id: string }) => a.enrollment_id);
  const { data: enrollments } = await admin.from("enrollments").select("student_id").in("id", enrollmentIds);
  const studentIds = [...new Set((enrollments ?? []).map((e: { student_id: string }) => e.student_id))];

  const [{ data: students }, { data: cls }] = await Promise.all([
    admin.from("users").select("id, name, phone, parent_phone").in("id", studentIds),
    admin.from("classes").select("subject_id").eq("id", classId).maybeSingle(),
  ]);

  let subjectName: string | undefined;
  if (cls) {
    const { data: subject } = await admin.from("subjects").select("name").eq("id", cls.subject_id).maybeSingle();
    subjectName = subject?.name;
  }

  let sent = 0;
  for (const student of students ?? []) {
    const to = student.parent_phone || student.phone;
    const message = `${student.name} was marked absent in ${subjectName ?? "class"} on ${date}. - ${session.instituteName}`;

    try {
      await sendSms({ to, message });
      await admin.from("notifications").insert({
        user_id: student.id,
        institute_id: session.instituteId,
        type: "attendance_alert",
        message,
      });
      sent++;
    } catch (err) {
      console.error("Failed to send absence alert:", err);
    }
  }

  return jsonResponse({ sent });
});
