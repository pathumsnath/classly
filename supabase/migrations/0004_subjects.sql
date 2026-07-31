-- Institute-managed subjects list, so creating a class becomes "pick from
-- a list" instead of free-text (which drifted: e.g. "English" typed
-- slightly differently across classes would never be recognized as the
-- same subject for reporting later).
--
-- Backfill: every distinct subject string already in use becomes a real
-- subjects row, and existing classes are repointed at it via subject_id,
-- before the old free-text column is dropped. No data is lost.
--
-- Wrapped in an explicit transaction: backfill + NOT NULL + DROP COLUMN
-- must all succeed together or not at all, since the DROP is destructive
-- and irreversible once committed.

begin;

create table subjects (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  name text not null,
  status tutor_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (institute_id, name)
);
create index subjects_institute_idx on subjects (institute_id);

alter table subjects enable row level security;

create policy subjects_select on subjects for select
  using (institute_id = current_institute_id());

create policy subjects_insert on subjects for insert
  with check (institute_id = current_institute_id() and current_app_role() in ('owner', 'admin_staff'));

create policy subjects_update on subjects for update
  using (institute_id = current_institute_id() and current_app_role() in ('owner', 'admin_staff'));

alter table classes add column subject_id uuid references subjects(id);

insert into subjects (institute_id, name)
select distinct institute_id, subject from classes
on conflict (institute_id, name) do nothing;

update classes
set subject_id = subjects.id
from subjects
where classes.institute_id = subjects.institute_id
  and classes.subject = subjects.name;

alter table classes alter column subject_id set not null;
alter table classes drop column subject;

commit;
