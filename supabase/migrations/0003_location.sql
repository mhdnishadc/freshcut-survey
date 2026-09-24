-- FreshCut Survey — questionnaire v3
--
-- Run in the Supabase SQL editor after 0002_drop_location.sql. Safe to re-run.
--
-- The printed form asks for Location again (question 1), so this partly undoes
-- 0002. One column comes back, not the four that were dropped: a single free
-- text "area, town or landmark" is what an interviewer can actually get in the
-- three seconds a chef will give them. Address, city and pincode stay gone.
--
-- Because the survey knows where a business is again, a business is recognised
-- by name AND location once more — two "Hotel Aliya" in different areas are two
-- different customers, and merging them would corrupt both records.
--
-- ---------------------------------------------------------------------------
-- WARNING, if you already have interviews: this rebuilds `dedupe_key`, so rows
-- that currently share a name will now be told apart by location. Any existing
-- row has location NULL (the column is new), which normalises to '' — so the
-- unique index sees exactly the same collisions as before and cannot newly
-- fail. Nothing is merged or split retroactively; only interviews saved from
-- here on are separated by area.
-- ---------------------------------------------------------------------------

-- Dropping the generated column also drops the unique index built on it.
alter table public.hotels drop column if exists dedupe_key;

alter table public.hotels add column if not exists location text;

-- Name + location, normalised. `coalesce` keeps a blank location working like
-- an empty string rather than poisoning the whole key to NULL.
alter table public.hotels
  add column if not exists dedupe_key text
  generated always as (
    lower(trim(name)) || '|' || lower(trim(coalesce(location, '')))
  ) stored;

create unique index if not exists hotels_dedupe_key_idx on public.hotels (dedupe_key);

-- Mirrors hotels_locality_idx from 0001: the hotel list filters and sorts by
-- area for delivery-route planning.
create index if not exists hotels_location_idx on public.hotels (location);

comment on column public.hotels.location is
  'Free text area/town/landmark, from question 1. Part of dedupe_key.';
