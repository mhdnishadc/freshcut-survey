import { createClient } from "@/lib/supabase/server";
import type { Hotel, ResponseWithHotel } from "@/lib/types";

/**
 * Every interview with its hotel attached, newest first.
 *
 * The whole dashboard reads from this one query and aggregates in TypeScript.
 * At phase-1 scale (hundreds of interviews) that is far simpler than a dozen
 * SQL views, and it keeps the aggregation driven by the question config. If the
 * table ever reaches tens of thousands of rows, move the counting into Postgres
 * views — the component API will not have to change.
 */
export async function getResponses(): Promise<ResponseWithHotel[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("survey_responses")
    .select("*, hotel:hotels(*)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load survey responses: ${error.message}`);

  // A response always has a hotel (the FK is NOT NULL), but the generated
  // relation type is nullable — drop any orphan rather than crash the page.
  return (data ?? []).filter(
    (row): row is ResponseWithHotel => Boolean((row as { hotel?: Hotel | null }).hotel),
  );
}

export async function getHotel(id: string): Promise<{
  hotel: Hotel;
  responses: ResponseWithHotel[];
} | null> {
  const supabase = await createClient();

  const { data: hotel } = await supabase.from("hotels").select("*").eq("id", id).maybeSingle();
  if (!hotel) return null;

  const { data: responses } = await supabase
    .from("survey_responses")
    .select("*, hotel:hotels(*)")
    .eq("hotel_id", id)
    .order("created_at", { ascending: false });

  return {
    hotel: hotel as Hotel,
    responses: (responses ?? []) as ResponseWithHotel[],
  };
}

/** The newest interview per hotel — what the hotel list and leads page show. */
export function latestPerHotel(responses: ResponseWithHotel[]): ResponseWithHotel[] {
  const seen = new Set<string>();
  const latest: ResponseWithHotel[] = [];
  // `responses` arrives newest-first, so the first sighting is the latest.
  for (const response of responses) {
    if (seen.has(response.hotel_id)) continue;
    seen.add(response.hotel_id);
    latest.push(response);
  }
  return latest;
}
