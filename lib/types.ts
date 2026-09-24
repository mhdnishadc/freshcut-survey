import type { AnswerValue } from "./survey/questions";

/** Mirrors `public.hotels` in supabase/migrations/0001_init.sql. */
export type Hotel = {
  id: string;
  name: string;
  /** Free text area/town/landmark. The other half of `dedupe_key`. */
  location: string | null;
  hotel_type: string | null;
  contact_person: string | null;
  phone: string | null;
  whatsapp: string | null;
  /** Captured with one tap on the survey form, alongside the typed location. */
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
};

/** Mirrors `public.survey_responses`. */
export type SurveyResponse = {
  id: string;
  hotel_id: string;
  answers: Record<string, AnswerValue>;
  /** Summed from the kg_day column of the veg_table answer. */
  veg_kg_per_day: number | null;
  questionnaire_version: string | null;
  created_at: string;
};

/** A response joined to the hotel it belongs to — what the dashboard reads. */
export type ResponseWithHotel = SurveyResponse & { hotel: Hotel };
