-- Classly V1 — Phase A schema + RLS
-- Implements Section 7 of tuitionflow-v1-spec.md, with one deliberate
-- deviation documented below.
--
-- DEVIATION FROM SPEC SECTION 7 — `users` table:
-- The spec's `users` table includes `password_hash`, and FR-3.4 / the
-- "phone-first add" flow implies a single directory of people (owner,
-- admin staff, tutors, students) keyed by phone — but NFR-2 mandates that
-- Supabase Auth (not app code) owns password hashing, and tutor/student
-- portals are explicitly out of scope for v1 (Section 11), meaning tutors
-- and students are added as directory records with NO login account.
-- Those two constraints can't both hold on a `users` table whose `id` is
-- a hard foreign key to `auth.users(id)`, since most `users` rows in v1
-- (tutors, students) will have no matching `auth.users` row at all.
--
-- Resolution: `users.id` is its own uuid (not FK'd to auth.users), and a
-- nullable `auth_user_id` column links a directory row to a Supabase Auth
-- identity only when one exists (owner/admin_staff today; tutor/student
-- when those portals ship later, with zero migration needed — same
-- forward-compatibility principle the spec applies to `payments.method`).
-- `password_hash` is dropped entirely: Supabase Auth is the only place
-- credentials live.

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- Enums
-- ============================================================

create type app_role as enum ('owner', 'admin_staff', 'tutor', 'student');
create type tutor_status as enum ('active', 'inactive');
create type enrollment_status as enum ('active', 'inactive');
create type attendance_status as enum ('present', 'absent', 'late');
create type fee_type as enum ('monthly_flat', 'per_session');
create type tutor_payment_model as enum ('revenue_share', 'fixed', 'per_student', 'per_session');
create type payment_status as enum ('pending', 'partial', 'paid', 'overdue', 'waived');
create type payment_method as enum ('cash', 'bank_transfer', 'other');
create type salary_status as enum ('pending', 'paid');
create type notification_type as enum ('invite', 'receipt', 'attendance_alert');

-- ============================================================
-- Tables
-- ============================================================

-- Directory of every person in the system (owner, admin staff, tutors,
-- students), keyed by phone. Not everyone has a login (see note above).
create table users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  phone text not null unique,
  email text,
  created_at timestamptz not null default now()
);

create table institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  owner_id uuid not null references users(id),
  logo_url text,
  created_at timestamptz not null default now()
);

-- One role per person per institute. v1 is single-institute, but this
-- shape supports a person holding a role at more than one institute later.
create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  institute_id uuid not null references institutes(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, institute_id)
);
create index user_roles_user_id_idx on user_roles (user_id);
create index user_roles_institute_role_idx on user_roles (institute_id, role);

create table institute_tutors (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  tutor_id uuid not null references users(id) on delete cascade,
  joined_date date,
  status tutor_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (institute_id, tutor_id)
);
create index institute_tutors_institute_idx on institute_tutors (institute_id);
create index institute_tutors_tutor_idx on institute_tutors (tutor_id);

create table classes (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  tutor_id uuid not null references users(id),
  subject text not null,
  schedule_days text[] not null default '{}',
  schedule_time time,
  room text,
  max_students integer,
  fee_amount numeric(10, 2) not null,
  fee_type fee_type not null,
  tutor_payment_model tutor_payment_model not null,
  tutor_payment_value numeric(10, 2) not null,
  created_at timestamptz not null default now()
);
create index classes_institute_idx on classes (institute_id);
create index classes_tutor_idx on classes (tutor_id);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  student_id uuid not null references users(id),
  class_id uuid not null references classes(id) on delete cascade,
  status enrollment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  unique (student_id, class_id)
);
create index enrollments_institute_class_idx on enrollments (institute_id, class_id);
create index enrollments_student_idx on enrollments (student_id);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  date date not null,
  status attendance_status not null,
  recorded_by uuid not null references users(id),
  recorded_at timestamptz not null default now(),
  unique (enrollment_id, date)
);
create index attendance_class_date_idx on attendance (class_id, date);
create index attendance_enrollment_date_idx on attendance (enrollment_id, date);

create table payments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  student_id uuid not null references users(id),
  class_id uuid not null references classes(id),
  month date not null,
  amount_due numeric(10, 2) not null,
  amount_paid numeric(10, 2) not null default 0,
  balance numeric(10, 2) generated always as (amount_due - amount_paid) stored,
  status payment_status not null default 'pending',
  method payment_method,
  reference text,
  paid_date date,
  recorded_by uuid references users(id),
  recorded_at timestamptz not null default now(),
  unique (student_id, class_id, month)
);
create index payments_institute_month_idx on payments (institute_id, month);
create index payments_class_month_idx on payments (class_id, month);
create index payments_student_idx on payments (student_id);
create index payments_institute_status_idx on payments (institute_id, status);

create table salary_payments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  tutor_id uuid not null references users(id),
  month date not null,
  amount numeric(10, 2) not null,
  method payment_method,
  status salary_status not null default 'pending',
  paid_date date,
  recorded_by uuid references users(id),
  recorded_at timestamptz not null default now(),
  unique (tutor_id, month)
);
create index salary_payments_institute_month_idx on salary_payments (institute_id, month);
create index salary_payments_tutor_idx on salary_payments (tutor_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  institute_id uuid not null references institutes(id) on delete cascade,
  type notification_type not null,
  message text not null,
  sent_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id);
create index notifications_institute_idx on notifications (institute_id);

-- ============================================================
-- Session helper functions
-- ============================================================
-- SECURITY DEFINER + owned by the migration role (postgres, which has
-- BYPASSRLS on Supabase) so these can read user_roles/users without
-- recursing into the RLS policies defined below.

create or replace function current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from users where auth_user_id = auth.uid()
$$;

create or replace function current_institute_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select institute_id from user_roles where user_id = current_app_user_id() limit 1
$$;

create or replace function current_app_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from user_roles where user_id = current_app_user_id() limit 1
$$;

-- Single round-trip lookup for "who is signed in, at which institute, with
-- which role" — used by the app's session helper and the bare Phase A
-- dashboard. Same SECURITY DEFINER justification as above.
create or replace function get_current_session()
returns table (
  user_id uuid,
  name text,
  phone text,
  institute_id uuid,
  institute_name text,
  role app_role
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.name, u.phone, i.id, i.name, ur.role
  from users u
  join user_roles ur on ur.user_id = u.id
  join institutes i on i.id = ur.institute_id
  where u.auth_user_id = auth.uid()
  limit 1
$$;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table users enable row level security;
alter table institutes enable row level security;
alter table user_roles enable row level security;
alter table institute_tutors enable row level security;
alter table classes enable row level security;
alter table enrollments enable row level security;
alter table attendance enable row level security;
alter table payments enable row level security;
alter table salary_payments enable row level security;
alter table notifications enable row level security;

-- ---- users ----
-- Visible if it's you, or you're owner/admin_staff and this person is
-- linked to your institute via a role, tutor membership, or enrollment.
create policy users_select on users for select
  using (
    id = current_app_user_id()
    or id in (select user_id from user_roles where institute_id = current_institute_id())
    or id in (select tutor_id from institute_tutors where institute_id = current_institute_id())
    or id in (select student_id from enrollments where institute_id = current_institute_id())
  );

create policy users_insert on users for insert
  with check (current_app_role() in ('owner', 'admin_staff'));

create policy users_update on users for update
  using (current_app_role() in ('owner', 'admin_staff'));

-- ---- institutes ----
-- Row creation happens server-side via the service-role client during
-- owner signup (there is no institute/role yet for RLS to key off of).
create policy institutes_select on institutes for select
  using (id = current_institute_id());

create policy institutes_update on institutes for update
  using (id = current_institute_id() and current_app_role() = 'owner');

-- ---- user_roles ----
-- Hard rule (Section 3): managing admin staff is owner-only.
create policy user_roles_select on user_roles for select
  using (
    user_id = current_app_user_id()
    or (institute_id = current_institute_id() and current_app_role() = 'owner')
  );

create policy user_roles_insert on user_roles for insert
  with check (institute_id = current_institute_id() and current_app_role() = 'owner');

create policy user_roles_update on user_roles for update
  using (institute_id = current_institute_id() and current_app_role() = 'owner');

create policy user_roles_delete on user_roles for delete
  using (institute_id = current_institute_id() and current_app_role() = 'owner');

-- ---- institute_tutors ----
create policy institute_tutors_select on institute_tutors for select
  using (institute_id = current_institute_id());

create policy institute_tutors_insert on institute_tutors for insert
  with check (institute_id = current_institute_id() and current_app_role() in ('owner', 'admin_staff'));

create policy institute_tutors_update on institute_tutors for update
  using (institute_id = current_institute_id() and current_app_role() in ('owner', 'admin_staff'));

-- ---- classes ----
create policy classes_select on classes for select
  using (institute_id = current_institute_id());

create policy classes_insert on classes for insert
  with check (institute_id = current_institute_id() and current_app_role() in ('owner', 'admin_staff'));

create policy classes_update on classes for update
  using (institute_id = current_institute_id() and current_app_role() in ('owner', 'admin_staff'));

-- ---- enrollments ----
create policy enrollments_select on enrollments for select
  using (institute_id = current_institute_id());

create policy enrollments_insert on enrollments for insert
  with check (institute_id = current_institute_id() and current_app_role() in ('owner', 'admin_staff'));

create policy enrollments_update on enrollments for update
  using (institute_id = current_institute_id() and current_app_role() in ('owner', 'admin_staff'));

-- ---- attendance ----
create policy attendance_select on attendance for select
  using (institute_id = current_institute_id());

create policy attendance_insert on attendance for insert
  with check (
    institute_id = current_institute_id()
    and current_app_role() in ('owner', 'admin_staff')
    and recorded_by = current_app_user_id()
  );

create policy attendance_update on attendance for update
  using (institute_id = current_institute_id() and current_app_role() in ('owner', 'admin_staff'));

-- ---- payments ----
-- Row-level access (recording/viewing an individual payment) is open to
-- both roles per Section 3. Institute-wide totals are gated in the query
-- layer (requireOwner), not here — RLS can't distinguish "one row" from
-- "a SUM() over all rows" from the same table.
create policy payments_select on payments for select
  using (institute_id = current_institute_id());

create policy payments_insert on payments for insert
  with check (
    institute_id = current_institute_id()
    and current_app_role() in ('owner', 'admin_staff')
    and recorded_by = current_app_user_id()
  );

create policy payments_update on payments for update
  using (institute_id = current_institute_id() and current_app_role() in ('owner', 'admin_staff'));

-- ---- salary_payments ----
-- Hard rule (Section 3): salary figures are owner-only, enforced here so
-- admin_staff gets zero rows even on a direct query, not just a hidden UI.
create policy salary_payments_select on salary_payments for select
  using (institute_id = current_institute_id() and current_app_role() = 'owner');

create policy salary_payments_insert on salary_payments for insert
  with check (
    institute_id = current_institute_id()
    and current_app_role() = 'owner'
    and recorded_by = current_app_user_id()
  );

create policy salary_payments_update on salary_payments for update
  using (institute_id = current_institute_id() and current_app_role() = 'owner');

-- ---- notifications ----
create policy notifications_select on notifications for select
  using (
    user_id = current_app_user_id()
    or (institute_id = current_institute_id() and current_app_role() = 'owner')
  );

create policy notifications_insert on notifications for insert
  with check (institute_id = current_institute_id() and current_app_role() in ('owner', 'admin_staff'));
