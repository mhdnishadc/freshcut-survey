import {
  ANSWER_QUESTIONS,
  KEY_QUESTIONS,
  QUESTION_BY_ID,
  optionLabel,
  type Question,
} from "@/lib/survey/questions";
import type { ResponseWithHotel } from "@/lib/types";

/**
 * Turns raw interviews into the numbers the founders actually decide on.
 *
 * Everything here is driven by the question config, so swapping the
 * questionnaire changes the dashboard without touching this file — except for
 * the headline KPIs, which deliberately reference KEY_QUESTIONS by name.
 */

export type Slice = { value: string; label: string; count: number; share: number };

export type NumberStats = {
  n: number;
  sum: number;
  avg: number;
  median: number;
  min: number;
  max: number;
};

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------

function numbersFor(responses: ResponseWithHotel[], questionId: string): number[] {
  return responses
    .map((r) => r.answers[questionId])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

export function numberStats(
  responses: ResponseWithHotel[],
  questionId: string,
): NumberStats | null {
  const values = numbersFor(responses, questionId).sort((a, b) => a - b);
  if (values.length === 0) return null;

  const sum = values.reduce((acc, v) => acc + v, 0);
  const mid = Math.floor(values.length / 2);

  return {
    n: values.length,
    sum,
    avg: sum / values.length,
    median: values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid],
    min: values[0],
    max: values[values.length - 1],
  };
}

/** Sum of a numeric answer across every interview — our addressable volume. */
export function total(responses: ResponseWithHotel[], questionId: string): number {
  return numbersFor(responses, questionId).reduce((acc, v) => acc + v, 0);
}

/**
 * Counts per option for a select, yes/no or rating question. Options with no
 * answers are kept at zero so the chart's categories stay stable between
 * refreshes rather than jumping around as data arrives.
 */
export function distribution(responses: ResponseWithHotel[], questionId: string): Slice[] {
  const question = QUESTION_BY_ID.get(questionId);
  if (!question) return [];

  const counts = new Map<string, number>();
  for (const option of optionValues(question)) counts.set(option, 0);

  let answered = 0;
  for (const response of responses) {
    const value = response.answers[questionId];
    const key = typeof value === "number" ? String(value) : typeof value === "string" ? value : null;
    if (key === null || key === "") continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    answered += 1;
  }

  return [...counts.entries()].map(([value, count]) => ({
    value,
    label: labelFor(question, value),
    count,
    share: answered === 0 ? 0 : (count / answered) * 100,
  }));
}

/**
 * How often each option of a multi-select was picked, most popular first.
 * Share is out of interviews, not out of ticks, so "68% of kitchens use onion"
 * reads correctly even though each kitchen ticks several vegetables.
 */
export function frequency(responses: ResponseWithHotel[], questionId: string): Slice[] {
  const question = QUESTION_BY_ID.get(questionId);
  if (!question) return [];

  const counts = new Map<string, number>();
  let answered = 0;

  for (const response of responses) {
    const value = response.answers[questionId];
    if (!Array.isArray(value) || value.length === 0) continue;
    answered += 1;
    for (const v of value) counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: labelFor(question, value),
      count,
      share: answered === 0 ? 0 : (count / answered) * 100,
    }))
    .sort((a, b) => b.count - a.count);
}

function optionValues(question: Question): string[] {
  if (question.type === "yes_no") return ["yes", "no"];
  if (question.type === "rating") {
    return Array.from({ length: question.scale ?? 5 }, (_, i) => String(i + 1));
  }
  return (question.options ?? []).map((o) => o.value);
}

function labelFor(question: Question, value: string): string {
  if (question.type === "yes_no") return value === "yes" ? "Yes" : "No";
  if (question.type === "rating") return value;
  return optionLabel(question, value);
}

// ---------------------------------------------------------------------------
// headline numbers
// ---------------------------------------------------------------------------

export type Kpis = {
  hotels: number;
  interviews: number;
  interviewsThisWeek: number;
  /** kg of vegetables per day across every hotel surveyed — our market size. */
  dailyVolumeKg: number;
  monthlyVegSpend: number;
  monthlyLabourCost: number;
  /** Share of interviews answering "yes" to buying pre-cut. */
  yesShare: number;
  /** Share answering yes or maybe. */
  warmShare: number;
  trialShare: number;
  hotHotels: number;
  avgInterest: number | null;
};

export function kpis(responses: ResponseWithHotel[]): Kpis {
  const weekAgo = Date.now() - 7 * 86_400_000;

  const buy = responses
    .map((r) => r.answers[KEY_QUESTIONS.wouldBuyPrecut])
    .filter((v): v is string => typeof v === "string");

  const trial = responses
    .map((r) => r.answers[KEY_QUESTIONS.wantsTrial])
    .filter((v): v is string => typeof v === "string");

  const interest = responses
    .map((r) => r.interest_level)
    .filter((v): v is number => typeof v === "number");

  return {
    hotels: new Set(responses.map((r) => r.hotel_id)).size,
    interviews: responses.length,
    interviewsThisWeek: responses.filter((r) => new Date(r.created_at).getTime() >= weekAgo).length,
    dailyVolumeKg: total(responses, KEY_QUESTIONS.vegKgPerDay),
    monthlyVegSpend: total(responses, KEY_QUESTIONS.monthlyVegSpend),
    monthlyLabourCost: total(responses, KEY_QUESTIONS.monthlyPrepLabourCost),
    yesShare: share(buy, (v) => v === "yes"),
    warmShare: share(buy, (v) => v === "yes" || v === "maybe"),
    trialShare: share(trial, (v) => v === "yes"),
    hotHotels: interest.filter((v) => v >= 4).length,
    avgInterest: interest.length ? interest.reduce((a, b) => a + b, 0) / interest.length : null,
  };
}

function share(values: string[], predicate: (v: string) => boolean): number {
  if (values.length === 0) return 0;
  return (values.filter(predicate).length / values.length) * 100;
}

// ---------------------------------------------------------------------------
// cuts by hotel attributes
// ---------------------------------------------------------------------------

/** Interviews per locality, biggest first — where the delivery route starts. */
export function byLocality(responses: ResponseWithHotel[]): Slice[] {
  const counts = new Map<string, number>();
  for (const response of responses) {
    const key = response.hotel.locality?.trim() || "Not recorded";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const totalCount = responses.length;
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: value,
      count,
      share: totalCount === 0 ? 0 : (count / totalCount) * 100,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Daily kg demand grouped by locality — how much a single route would carry. */
export function volumeByLocality(responses: ResponseWithHotel[]): Slice[] {
  const sums = new Map<string, number>();
  for (const response of responses) {
    const kg = response.answers[KEY_QUESTIONS.vegKgPerDay];
    if (typeof kg !== "number" || !Number.isFinite(kg)) continue;
    const key = response.hotel.locality?.trim() || "Not recorded";
    sums.set(key, (sums.get(key) ?? 0) + kg);
  }

  const grand = [...sums.values()].reduce((a, b) => a + b, 0);
  return [...sums.entries()]
    .map(([value, count]) => ({
      value,
      label: value,
      count,
      share: grand === 0 ? 0 : (count / grand) * 100,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Interviews per day, oldest first — is the survey effort keeping pace? */
export function overTime(responses: ResponseWithHotel[]): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const response of responses) {
    const day = response.created_at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// generic, config-driven summary of every remaining question
// ---------------------------------------------------------------------------

export type QuestionSummary =
  | { question: Question; kind: "slices"; slices: Slice[] }
  | { question: Question; kind: "stats"; stats: NumberStats }
  | { question: Question; kind: "text"; samples: { hotel: string; text: string }[] }
  | { question: Question; kind: "empty" };

/**
 * Summarises every question in the config. This is what makes a new
 * questionnaire show up on the dashboard automatically — nothing here names a
 * specific question.
 */
export function summariseAll(responses: ResponseWithHotel[]): QuestionSummary[] {
  return ANSWER_QUESTIONS.filter((q) => q.chart !== "none").map((question) => {
    switch (question.type) {
      case "number": {
        const stats = numberStats(responses, question.id);
        return stats
          ? { question, kind: "stats" as const, stats }
          : { question, kind: "empty" as const };
      }

      case "multi_select": {
        const slices = frequency(responses, question.id);
        return slices.length
          ? { question, kind: "slices" as const, slices }
          : { question, kind: "empty" as const };
      }

      case "single_select":
      case "yes_no":
      case "rating": {
        const slices = distribution(responses, question.id);
        return slices.some((s) => s.count > 0)
          ? { question, kind: "slices" as const, slices }
          : { question, kind: "empty" as const };
      }

      case "short_text":
      case "long_text": {
        const samples = responses
          .map((r) => ({ hotel: r.hotel.name, text: r.answers[question.id] }))
          .filter((s): s is { hotel: string; text: string } => typeof s.text === "string" && s.text.trim() !== "");
        return samples.length
          ? { question, kind: "text" as const, samples }
          : { question, kind: "empty" as const };
      }
    }
  });
}
