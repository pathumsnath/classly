begin;

-- Per-tutor override of institutes.revenue_share_commission_percent. Null =
-- use the institute default; set = every revenue_share class this tutor
-- teaches uses this rate instead (e.g. an owner who also tutors and keeps
-- 100% of their own classes' fees, i.e. a 0% override).
alter table institute_tutors
  add column commission_override_percent numeric(5, 2)
  check (commission_override_percent is null or (commission_override_percent >= 0 and commission_override_percent <= 100));

commit;
