begin;

-- Some tutors don't run a class on a strict calendar-month cadence — a
-- "month" for them is whatever 4 (or however many) sessions they actually
-- hold, cancellations and reschedules included. Opt-in per class: both
-- columns null (the default) keeps the existing calendar-month cron
-- billing exactly as it was. Setting billing_cycle_sessions switches that
-- one class onto session-count billing instead — see
-- src/lib/attendance/actions.ts (the trigger, on attendance submit) and
-- src/lib/fees/generate.ts (generateMonthlyFees skips these classes; the
-- cycle trigger calls generateFeesForClass instead).
alter table classes
  add column billing_cycle_sessions integer,
  add column cycle_started_at date;

alter table classes
  add constraint classes_billing_cycle_sessions_check
    check (billing_cycle_sessions is null or billing_cycle_sessions > 0);

commit;
