"use server";

import {
  HOTEL_FIELD_BY_QUESTION_ID,
  KEY_QUESTIONS,
  QUESTIONNAIRE_VERSION,
  QUESTION_BY_ID,
  compactTable,
  isTableValue,
  type AnswerValue,
} from "@/lib/survey/questions";
import { tableColumnTotal } from "@/lib/analytics/aggregate";
import { normalisePhone, pruneHidden, surveySchema, type SurveyValues } from "@/lib/survey/schema";
import { createClient } from "@/lib/supabase/server";

export type SubmitPayload = {
  values: SurveyValues;
  coords: { latitude: number; longitude: number } | null;
};

export type SubmitResult =
  | { ok: true; hotelId: string; hotelName: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type HotelRow = Record<string, string | number | null>;

/** Postgres unique-violation — two interviewers saved the same hotel at once. */
const UNIQUE_VIOLATION = "23505";

/**
 * Businesses are matched on name + location, mirroring the generated
 * `dedupe_key` column in the database (see 0003_location.sql). Both halves are
 * normalised the same way Postgres does, and a blank location becomes "" rather
 * than null, so the two definitions cannot drift apart.
 *
 * The cost of this is that a revisit which leaves Location blank does not
 * recognise a business that was first recorded with one. That is the deliberate
 * trade: a duplicate row is visible and fixable, whereas two different kitchens
 * silently merged into one record corrupts both.
 */
function dedupeKey(name: string, location: string | null): string {
  return `${name.trim().toLowerCase()}|${(location ?? "").trim().toLowerCase()}`;
}

/**
 * Splits the flat answer record into the typed `hotels` columns and the JSONB
 * blob, following HOTEL_FIELD_BY_QUESTION_ID. Empty strings become null so the
 * database never stores "" where "unknown" is meant.
 */
function split(values: SurveyValues): { hotel: HotelRow; answers: Record<string, AnswerValue> } {
  const hotel: HotelRow = {};
  const answers: Record<string, AnswerValue> = {};

  for (const [questionId, raw] of Object.entries(values)) {
    const question = QUESTION_BY_ID.get(questionId);
    if (!question || raw === undefined) continue;

    let value: AnswerValue = raw;
    if (typeof value === "string") {
      const trimmed = value.trim();
      value = trimmed === "" ? null : question.format === "phone" ? normalisePhone(trimmed) : trimmed;
    } else if (isTableValue(value)) {
      // Blank cells and rows the interviewer opened but never filled are
      // dropped here, so a skipped table stores `{}` rather than twelve nulls.
      value = compactTable(value);
    }

    const column = HOTEL_FIELD_BY_QUESTION_ID[questionId];
    if (column) {
      // Hotel columns are scalar. A multi-select flattens to a list; a table
      // has no scalar form at all and is never mapped to one.
      if (isTableValue(value)) continue;
      hotel[column] = Array.isArray(value) ? value.join(", ") : value;
    } else {
      answers[questionId] = value;
    }
  }

  return { hotel, answers };
}

/**
 * Stores one completed interview.
 *
 * Re-validates everything server-side: the proxy does not cover Server Actions
 * reliably, and a client can post anything at all.
 */
export async function submitSurvey(payload: SubmitPayload): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Your session expired. Sign in again to save this." };

  const cleaned = pruneHidden(payload.values);
  const parsed = surveySchema.safeParse(cleaned);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key) fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Some answers need fixing.", fieldErrors };
  }

  const { hotel, answers } = split(cleaned);
  const name = typeof hotel.name === "string" ? hotel.name : null;
  // The one thing the form will not let through blank, because a business row
  // cannot exist without it.
  if (!name) return { ok: false, error: "Business name is required." };

  if (payload.coords) {
    hotel.latitude = payload.coords.latitude;
    hotel.longitude = payload.coords.longitude;
  }

  // Re-visiting a business updates the existing row rather than creating a
  // second one, so contact details stay in one place across repeat interviews.
  const key = dedupeKey(name, typeof hotel.location === "string" ? hotel.location : null);
  const { data: existing } = await supabase
    .from("hotels")
    .select("id")
    .eq("dedupe_key", key)
    .maybeSingle();

  let hotelId: string;

  if (existing) {
    // Only write what this interview actually recorded. Every field but the
    // name is optional, so patching in the nulls would let a rushed second
    // visit wipe the phone number the first visit worked to get.
    const patch = Object.fromEntries(
      Object.entries(hotel).filter(([, value]) => value !== null),
    );
    const { data, error } = await supabase
      .from("hotels")
      .update(patch)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) return { ok: false, error: `Could not update the hotel: ${error.message}` };
    hotelId = data.id;
  } else {
    const { data, error } = await supabase
      .from("hotels")
      .insert({ ...hotel, created_by: user.id })
      .select("id")
      .single();

    if (error?.code === UNIQUE_VIOLATION) {
      // Someone else inserted the same hotel between our select and insert.
      const { data: raced } = await supabase
        .from("hotels")
        .select("id")
        .eq("dedupe_key", key)
        .single();
      if (!raced) return { ok: false, error: "Could not save the hotel. Try again." };
      hotelId = raced.id;
    } else if (error) {
      return { ok: false, error: `Could not save the hotel: ${error.message}` };
    } else {
      hotelId = data.id;
    }
  }

  // Daily volume is no longer asked as its own question — it is the kg/day
  // column of the vegetable table added up. Promoting it to a real column keeps
  // the leads list sortable in SQL.
  const kgPerDay = tableColumnTotal(answers[KEY_QUESTIONS.vegTable], "kg_day");

  // `interest_level` and `notes` are left unset: the questionnaire no longer
  // asks the interviewer for either. The columns stay in the schema so old rows
  // remain readable, but nothing writes them now.
  const { error: responseError } = await supabase.from("survey_responses").insert({
    hotel_id: hotelId,
    answers,
    veg_kg_per_day: kgPerDay,
    questionnaire_version: QUESTIONNAIRE_VERSION,
    submitted_by: user.id,
  });

  if (responseError) {
    return { ok: false, error: `Could not save the answers: ${responseError.message}` };
  }

  return { ok: true, hotelId, hotelName: name };
}
