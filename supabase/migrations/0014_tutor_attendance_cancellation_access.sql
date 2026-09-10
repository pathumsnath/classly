begin;

-- The Flutter app lets a tutor cancel/uncancel their own class's dates
-- as a direct write (no Edge Function) — cancellation has no billing
-- side effect (a cancelled date simply never accumulates an attendance
-- row, so it can't corrupt a session-cycle's distinct-date count), so
-- it's safe to grant this directly via RLS. This is unlike attendance
-- *submission* itself, which stays behind a privileged Edge Function for
-- every role, so its cycle-close/billing side effect can never be
-- skipped by writing attendance a different way.
--
-- Today only owner/admin_staff can even insert a class_cancellations row
-- (and only via the web app's service-role Server Action in practice,
-- since there's no update/delete policy at all yet, and no attendance
-- delete policy either — cancelling deletes any attendance already
-- recorded for that date). This migration extends insert to a tutor's
-- own classes and adds the missing update/delete/attendance-delete
-- policies needed for a direct client write to fully cancel/uncancel.

drop policy class_cancellations_insert on class_cancellations;
create policy class_cancellations_insert on class_cancellations for insert
  with check (
    institute_id = current_institute_id()
    and recorded_by = current_app_user_id()
    and (
      current_app_role() in ('owner', 'admin_staff')
      or (
        current_app_role() = 'tutor'
        and class_id in (select id from classes where tutor_id = current_app_user_id())
      )
    )
  );

create policy class_cancellations_update on class_cancellations for update
  using (
    institute_id = current_institute_id()
    and (
      current_app_role() in ('owner', 'admin_staff')
      or (
        current_app_role() = 'tutor'
        and class_id in (select id from classes where tutor_id = current_app_user_id())
      )
    )
  );

create policy class_cancellations_delete on class_cancellations for delete
  using (
    institute_id = current_institute_id()
    and (
      current_app_role() in ('owner', 'admin_staff')
      or (
        current_app_role() = 'tutor'
        and class_id in (select id from classes where tutor_id = current_app_user_id())
      )
    )
  );

create policy attendance_delete on attendance for delete
  using (
    institute_id = current_institute_id()
    and (
      current_app_role() in ('owner', 'admin_staff')
      or (
        current_app_role() = 'tutor'
        and class_id in (select id from classes where tutor_id = current_app_user_id())
      )
    )
  );

commit;
