-- Classly Phase B — schema additions.
-- See gentle-popping-hammock.md plan for full rationale; summary:
--
-- 1) `institute_students`, mirroring `institute_tutors`: Section 7's schema
--    scopes students to an institute only via `enrollments`, but FR-3.2
--    ("add/edit/deactivate students") is independent of enrollment. Without
--    this table, a freshly-added-but-not-yet-enrolled student has nowhere
--    to record deactivation and is invisible under `users_select` RLS.
-- 2) `institutes.onboarding_completed_at`: tracks whether the onboarding
--    wizard (FR-2.1) has been finished/skipped, so the dashboard knows
--    whether to redirect there without inferring it from record counts.
-- 3) `class_cancellations`: FR-5.8 needs "this class was cancelled on this
--    date" to be a persisted, re-visitable state, and no existing table
--    has a home for it (a cancelled day writes zero attendance rows).
-- 4) `users.parent_phone`: FR-3.2 requires storing a student's parent
--    phone, but Section 7's `users` table has no column for it. Added
--    here as nullable, same as `email` — meaningless for non-student
--    people, harmless as null.

alter table users add column parent_phone text;

create table institute_students (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  joined_date date,
  status tutor_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (institute_id, student_id)
);
create index institute_students_institute_idx on institute_students (institute_id);
create index institute_students_student_idx on institute_students (student_id);

alter table institutes add column onboarding_completed_at timestamptz;

create table class_cancellations (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  date date not null,
  recorded_by uuid not null references users(id),
  recorded_at timestamptz not null default now(),
  unique (class_id, date)
);
create index class_cancellations_institute_idx on class_cancellations (institute_id);

alter table institute_students enable row level security;
alter table class_cancellations enable row level security;

create policy institute_students_select on institute_students for select
  using (institute_id = current_institute_id());

create policy institute_students_insert on institute_students for insert
  with check (institute_id = current_institute_id() and current_app_role() in ('owner', 'admin_staff'));

create policy institute_students_update on institute_students for update
  using (institute_id = current_institute_id() and current_app_role() in ('owner', 'admin_staff'));

create policy class_cancellations_select on class_cancellations for select
  using (institute_id = current_institute_id());

create policy class_cancellations_insert on class_cancellations for insert
  with check (
    institute_id = current_institute_id()
    and current_app_role() in ('owner', 'admin_staff')
    and recorded_by = current_app_user_id()
  );

-- Extend users_select (0001_init.sql) to cover freshly-added, not-yet-
-- enrolled students, who otherwise have no institute_tutors/enrollments
-- row to be visible through.
drop policy users_select on users;
create policy users_select on users for select
  using (
    id = current_app_user_id()
    or id in (select user_id from user_roles where institute_id = current_institute_id())
    or id in (select tutor_id from institute_tutors where institute_id = current_institute_id())
    or id in (select student_id from institute_students where institute_id = current_institute_id())
    or id in (select student_id from enrollments where institute_id = current_institute_id())
  );
