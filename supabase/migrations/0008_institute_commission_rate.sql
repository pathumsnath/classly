begin;

-- Single institute-wide commission rate for every revenue_share class,
-- overriding each class's own tutor_payment_value for that model
-- (fixed/per_student/per_session classes are unaffected — they still use
-- their own tutor_payment_value). Changing this immediately changes every
-- revenue_share tutor's salary calculation going forward.
alter table institutes
  add column revenue_share_commission_percent numeric(5, 2) not null default 25
  check (revenue_share_commission_percent >= 0 and revenue_share_commission_percent <= 100);

commit;
