begin;

-- Tracks which classes already got their "fee settlement" reminder SMS for
-- a given billing period, so the daily cron (see
-- /api/cron/fee-reminders) doesn't send the owner a duplicate if it runs
-- more than once on the reminder day. period_key is the same dual-purpose
-- key as payments.cycle_started_at: a class's calendar month for
-- ordinary billing, or the specific cycle_started_at for session-cycle
-- billing.
create table fee_reminder_sends (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  period_key date not null,
  sent_at timestamptz not null default now(),
  unique (class_id, period_key)
);
create index fee_reminder_sends_institute_idx on fee_reminder_sends (institute_id);

alter table fee_reminder_sends enable row level security;

-- Owner-only, same stance as the other cron-written bookkeeping tables
-- (salary_payments, tutor_advances) — no client insert/update path exists,
-- only the cron's service-role client writes here.
create policy fee_reminder_sends_select on fee_reminder_sends for select
  using (institute_id = current_institute_id() and current_app_role() = 'owner');

commit;
