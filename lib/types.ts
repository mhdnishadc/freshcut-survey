import type { AnswerValue } from "./survey/questions";

/** Mirrors `public.hotels` in supabase/migrations/0001_init.sql. */
export type Hotel = {
  id: string;
  name: string;
  hotel_type: string | null;
  locality: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  contact_person: string | null;
  contact_role: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  seating_capacity: number | null;
  meals_per_day: number | null;
  created_at: string;
  updated_at: string;
};

/** Mirrors `public.survey_responses`. */
export type SurveyResponse = {
  id: string;
  hotel_id: string;
  answers: Record<string, AnswerValue>;
  interest_level: number | null;
  veg_kg_per_day: number | null;
  status: "submitted" | "needs_followup" | "converted" | "rejected";
  notes: string | null;
  questionnaire_version: string | null;
  created_at: string;
};

/** A response joined to the hotel it belongs to — what the dashboard reads. */
export type ResponseWithHotel = SurveyResponse & { hotel: Hotel };
