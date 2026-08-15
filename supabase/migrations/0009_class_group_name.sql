begin;

-- Distinguishes two classes that would otherwise look identical (same
-- subject, grade, medium, tutor) — e.g. two Grade 6 Science groups taught
-- by the same tutor at different times. Free text, optional.
alter table classes add column group_name text;

commit;
