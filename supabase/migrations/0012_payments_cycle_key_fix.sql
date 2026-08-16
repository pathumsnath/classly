begin;

-- 0011's partial unique indexes don't actually work with how the app
-- upserts: Postgres can only use a partial index as an ON CONFLICT
-- arbiter if the conflict clause repeats its WHERE predicate, which
-- Supabase's upsert() has no way to express — every upsert against them
-- fails with 42P10 ("no unique or exclusion constraint matching").
--
-- Replace with one plain constraint: cycle_started_at is now populated
-- for every row, not just cycle-billed ones. For a calendar-billed fee
-- it's simply set equal to `month` — a non-null stand-in dedup key, not
-- a real cycle — so a single ordinary unique index covers both billing
-- models without needing a predicate at all.
drop index payments_calendar_fee_unique;
drop index payments_cycle_fee_unique;

update payments set cycle_started_at = month where cycle_started_at is null;

alter table payments alter column cycle_started_at set not null;
alter table payments add constraint payments_student_class_cycle_key unique (student_id, class_id, cycle_started_at);

commit;
