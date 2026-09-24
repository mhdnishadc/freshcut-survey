-- FreshCut Survey — schema
-- Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query > Run).
-- Safe to re-run: every statement is guarded, and nothing here drops or deletes.
--
-- This is the only migration. It matches the printed questionnaire in
-- lib/survey/questions.ts: every column below is written by the app, and every
-- answer that is not a column lives in `survey_responses.answers`. Changing the
-- questionnaire therefore needs no migration at all — only adding or removing a
-- promoted column does.
--
-- Replacing an older database: this file creates tables but never alters an
-- existing one, so if `public.hotels` already exists from an earlier schema, it
-- is left exactly as it is. Drop the two tables first, then run this.

-- ---------------------------------------------------------------------------
-- hotels: the durable business entity. One row per business we visit —
-- hotel, restaurant, catering, cloud kitchen or bakery.
-- ---------------------------------------------------------------------------
create table if not exists public.hotels (
  id                uuid primary key default gen_random_uuid(),

  -- Question 1.
  name              text not null,
  location          text,
  hotel_type        text,

  -- Question 13's contact block.
  contact_person    text,
  phone             text,
  whatsapp          text,

  -- Captured with one tap on the survey form, alongside the typed location.
  latitude          double precision,
  longitude         double precision,

  -- Normalised name + location, used to recognise a business we have already
  -- surveyed so a repeat visit updates the same row instead of duplicating it.
  -- Two "Hotel Aliya" in different areas are two different customers; merging
  -- them would corrupt both records. `coalesce` keeps a blank location behaving
  -- like an empty string rather than poisoning the whole key to NULL.
  dedupe_key        text generated always as (
                      lower(trim(name)) || '|' || lower(trim(coalesce(location, '')))
                    ) stored,

  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists hotels_dedupe_key_idx on public.hotels (dedupe_key);
create index if not exists hotels_location_idx   on public.hotels (location);
create index if not exists hotels_created_at_idx on public.hotels (created_at desc);

-- ---------------------------------------------------------------------------
-- survey_responses: one row per completed interview.
-- `answers` is keyed by the question ids in lib/survey/questions.ts, which is
-- what lets the questionnaire be swapped without a migration.
-- ---------------------------------------------------------------------------
create table if not exists public.survey_responses (
  id              uuid primary key default gen_random_uuid(),
  hotel_id        uuid not null references public.hotels (id) on delete cascade,

  answers         jsonb not null default '{}'::jsonb,

  -- Promoted out of `answers` so leads can be sorted and filtered in SQL.
  -- Total kg/day, summed from the kg_day column of the veg_table answer.
  veg_kg_per_day  numeric,

  -- Version of the questionnaire this interview was answered against, so old
  -- responses stay interpretable after the question set changes.
  questionnaire_version text,

  submitted_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists survey_responses_hotel_idx      on public.survey_responses (hotel_id);
create index if not exists survey_responses_created_at_idx on public.survey_responses (created_at desc);
create index if not exists survey_responses_answers_idx    on public.survey_responses using gin (answers);

-- ---------------------------------------------------------------------------
-- keep hotels.updated_at honest
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hotels_set_updated_at on public.hotels;
create trigger hotels_set_updated_at
  before update on public.hotels
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Only signed-in team members can touch survey data. The `anon` role (the key
-- shipped in the browser bundle) is granted nothing at all, so an anonymous
-- visitor cannot read a single business name or phone number.
-- ---------------------------------------------------------------------------
alter table public.hotels           enable row level security;
alter table public.survey_responses enable row level security;

drop policy if exists "team reads hotels"   on public.hotels;
drop policy if exists "team inserts hotels" on public.hotels;
drop policy if exists "team updates hotels" on public.hotels;

create policy "team reads hotels"
  on public.hotels for select
  to authenticated
  using (true);

create policy "team inserts hotels"
  on public.hotels for insert
  to authenticated
  with check (true);

create policy "team updates hotels"
  on public.hotels for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "team reads responses"   on public.survey_responses;
drop policy if exists "team inserts responses" on public.survey_responses;
drop policy if exists "team updates responses" on public.survey_responses;

create policy "team reads responses"
  on public.survey_responses for select
  to authenticated
  using (true);

create policy "team inserts responses"
  on public.survey_responses for insert
  to authenticated
  with check (true);

create policy "team updates responses"
  on public.survey_responses for update
  to authenticated
  using (true)
  with check (true);
