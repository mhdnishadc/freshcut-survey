"use server";

import {
  HOTEL_FIELD_BY_QUESTION_ID,
  KEY_QUESTIONS,
  QUESTIONNAIRE_VERSION,
  QUESTION_BY_ID,
  type AnswerValue,
} from "@/lib/survey/questions";
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

function dedupeKey(name: string, locality: string | null): string {
  return `${name.trim().toLowerCase()}|${(locality ?? "").trim().toLowerCase()}`;
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
    }

    const column = HOTEL_FIELD_BY_QUESTION_ID[questionId];
    if (column) {
      // Hotel columns are scalar; a multi-select could never map to one.
      hotel[column] = Array.isArray(value) ? value.join(", ") : value;
    } else {
      answers[questionId] = value;
    }
  }

  return { hotel, answers };
}

function asNumber(value: AnswerValue | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
  if (!name) return { ok: false, error: "Hotel name is required." };

  const locality = typeof hotel.locality === "string" ? hotel.locality : null;

  if (payload.coords) {
    hotel.latitude = payload.coords.latitude;
    hotel.longitude = payload.coords.longitude;
  }

  // Re-visiting a hotel updates the existing row rather than creating a second
  // one, so contact details stay in one place across repeat interviews.
  const key = dedupeKey(name, locality);
  const { data: existing } = await supabase
    .from("hotels")
    .select("id")
    .eq("dedupe_key", key)
    .maybeSingle();

  let hotelId: string;

  if (existing) {
    const { data, error } = await supabase
      .from("hotels")
      .update(hotel)
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

  const { error: responseError } = await supabase.from("survey_responses").insert({
    hotel_id: hotelId,
    answers,
    interest_level: asNumber(answers[KEY_QUESTIONS.interestLevel]),
    veg_kg_per_day: asNumber(answers[KEY_QUESTIONS.vegKgPerDay]),
    notes: typeof answers.notes === "string" ? answers.notes : null,
    questionnaire_version: QUESTIONNAIRE_VERSION,
    submitted_by: user.id,
  });

  if (responseError) {
    return { ok: false, error: `Could not save the answers: ${responseError.message}` };
  }

  return { ok: true, hotelId, hotelName: name };
}
