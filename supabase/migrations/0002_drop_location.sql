-- FreshCut Survey — questionnaire v2
--
-- Run in the Supabase SQL editor after 0001_init.sql. Safe to re-run.
--
-- Two changes, both following the shortened questionnaire:
--
--  1. The survey no longer asks where a hotel is. Area, address, city and
--     pincode are dropped; `latitude`/`longitude` stay, because the form still
--     offers a one-tap GPS capture that costs the interviewer nothing.
--
--  2. Because `locality` is gone, a hotel is now recognised by name alone.
--     `dedupe_key` is a generated column, so it has to be dropped and rebuilt
--     rather than altered in place.
--
-- ---------------------------------------------------------------------------
-- WARNING, if you already have interviews: two hotels that share a name but
-- differed by area will collide on the unique index below and the migration
-- will fail. Find them first —
--
--   select lower(trim(name)), count(*)
--   from public.hotels group by 1 having count(*) > 1;
--
-- — and rename one of each pair (e.g. "Aliya (Kaloor)") before running this.
-- ---------------------------------------------------------------------------

-- Dropping the generated column also drops the unique index built on it.
alter table public.hotels drop column if exists dedupe_key;

drop index if exists public.hotels_locality_idx;

alter table public.hotels drop column if exists locality;
alter table public.hotels drop column if exists address;
alter table public.hotels drop column if exists city;
alter table public.hotels drop column if exists pincode;

-- Seating capacity and meals per day were guesses the interviewer had to make
-- on the spot; the vegetable table now carries the volume they were proxies for.
alter table public.hotels drop column if exists seating_capacity;
alter table public.hotels drop column if exists meals_per_day;

-- A chain answers once and orders for every branch — worth recording.
alter table public.hotels add column if not exists branches integer;

alter table public.hotels
  add column if not exists dedupe_key text
  generated always as (lower(trim(name))) stored;

create unique index if not exists hotels_dedupe_key_idx on public.hotels (dedupe_key);

-- `survey_responses.veg_kg_per_day` is unchanged, but is now written as the sum
-- of the vegetable table's kg/day column rather than read from its own question.
comment on column public.survey_responses.veg_kg_per_day is
  'Total kg/day, summed from the kg_day column of the veg_table answer.';
