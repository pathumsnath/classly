begin;

-- Session-cycle billing's fee-per-cycle uniqueness can't be expressed by
-- calendar month alone — a cycle isn't a fixed number of weeks, so two
-- consecutive cycles for the same class can land in the same month
-- bucket (and did, in practice: a cycle closing on Aug 11 rolls into one
-- starting Aug 12, both "August"). Tag a cycle-billed fee with its own
-- cycle's exact start date so it can be deduplicated and compared for
-- overdue purposes precisely; stays null for calendar-billed fees, which
-- keep using month exactly as before.
alter table payments add column cycle_started_at date;

alter table payments drop constraint payments_student_id_class_id_month_key;
create unique index payments_calendar_fee_unique on payments (student_id, class_id, month) where cycle_started_at is null;
create unique index payments_cycle_fee_unique on payments (student_id, class_id, cycle_started_at) where cycle_started_at is not null;

commit;
