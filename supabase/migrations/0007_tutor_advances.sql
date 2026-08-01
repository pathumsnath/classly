begin;

create table tutor_advances (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  tutor_id uuid not null references users(id),
  month date not null,
  amount numeric(10, 2) not null check (amount > 0),
  reason text not null,
  recorded_by uuid not null references users(id),
  recorded_at timestamptz not null default now()
);
create index tutor_advances_institute_month_idx on tutor_advances (institute_id, month);
create index tutor_advances_tutor_idx on tutor_advances (tutor_id);

alter table tutor_advances enable row level security;

-- Same owner-only stance as salary_payments (Section 3: salary figures
-- are owner-only), plus the same tutor-self-view carve-out 0006 added for
-- salary_payments — a tutor can see advances taken against their own pay.
create policy tutor_advances_select on tutor_advances for select
  using (
    institute_id = current_institute_id()
    and (current_app_role() = 'owner' or tutor_id = current_app_user_id())
  );

create policy tutor_advances_insert on tutor_advances for insert
  with check (
    institute_id = current_institute_id()
    and current_app_role() = 'owner'
    and recorded_by = current_app_user_id()
  );

create policy tutor_advances_delete on tutor_advances for delete
  using (institute_id = current_institute_id() and current_app_role() = 'owner');

commit;
