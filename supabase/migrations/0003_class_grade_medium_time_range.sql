-- Adds grade, medium, and a start/end time range to classes, per an
-- explicit feature request (grade + subject + medium + day + time
-- period are all needed when creating a class).
--
-- grade/medium are nullable (not NOT NULL): the institute already has
-- real classes created before this migration, and backfilling them with
-- an arbitrary guessed value would be misleading. New classes are
-- required to set both at the app layer (create-class-form.tsx /
-- classes/actions.ts validation) — existing classes just show blank
-- until edited.

create type grade_level as enum (
  'grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6', 'grade_7',
  'grade_8', 'grade_9', 'grade_10', 'grade_11', 'grade_12', 'grade_13', 'ol', 'al'
);

create type class_medium as enum ('sinhala', 'english', 'tamil');

alter table classes add column grade grade_level;
alter table classes add column medium class_medium;

alter table classes rename column schedule_time to schedule_start_time;
alter table classes add column schedule_end_time time;
