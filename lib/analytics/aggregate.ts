import {
  ANSWER_QUESTIONS,
  KEY_QUESTIONS,
  QUESTION_BY_ID,
  asTableValue,
  optionLabel,
  tableRowLabel,
  type AnswerValue,
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
    // Read off the promoted column rather than the JSON, so it stays correct
    // even for interviews saved before the table question existed.
    dailyVolumeKg: responses.reduce((acc, r) => acc + (r.veg_kg_per_day ?? 0), 0),
    monthlyVegSpend: total(responses, KEY_QUESTIONS.monthlyVegSpend),
    monthlyLabourCost: total(responses, KEY_QUESTIONS.monthlyPrepLabourCost),
    // "Warm" now spans the four-point scale the printed form used.
    yesShare: share(buy, (v) => v === "definitely"),
    warmShare: share(buy, (v) => v === "definitely" || v === "probably" || v === "maybe"),
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
// the vegetable table
// ---------------------------------------------------------------------------

/** Every number in one column of one table answer, added up. */
export function tableColumnTotal(value: AnswerValue | undefined, columnId: string): number | null {
  const cells = Object.values(asTableValue(value).cells);
  const numbers = cells
    .map((row) => row[columnId])
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  return numbers.length === 0 ? null : numbers.reduce((a, b) => a + b, 0);
}

export type VegetableDemand = {
  key: string;
  label: string;
  /** How many kitchens reported using this vegetable at all. */
  kitchens: number;
  /** Combined kilograms per day across those kitchens — the order book. */
  kgPerDay: number;
  /** Median of what they pay for it raw today. */
  priceNow: number | null;
  /** Median of what they say they would pay for it pre-cut. */
  pricePrecut: number | null;
  /** The gap between the two, as a percentage of the raw price. */
  premiumPercent: number | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * The single most valuable output of this survey: for each vegetable, how much
 * of it the surveyed kitchens get through, what they pay now, and what they say
 * they would pay pre-cut. Ordered by daily volume, because that is the order in
 * which the processing line should be built.
 */
export function vegetableDemand(
  responses: ResponseWithHotel[],
  questionId: string = KEY_QUESTIONS.vegTable,
): VegetableDemand[] {
  const question = QUESTION_BY_ID.get(questionId);
  if (!question) return [];

  const rows = new Map<
    string,
    { label: string; kitchens: number; kg: number; now: number[]; precut: number[] }
  >();

  for (const response of responses) {
    const table = asTableValue(response.answers[questionId]);
    for (const [rowKey, cells] of Object.entries(table.cells)) {
      const entry = rows.get(rowKey) ?? {
        label: tableRowLabel(question, table, rowKey),
        kitchens: 0,
        kg: 0,
        now: [],
        precut: [],
      };

      entry.kitchens += 1;
      if (typeof cells.kg_day === "number") entry.kg += cells.kg_day;
      if (typeof cells.price_now === "number") entry.now.push(cells.price_now);
      if (typeof cells.price_precut === "number") entry.precut.push(cells.price_precut);

      rows.set(rowKey, entry);
    }
  }

  return [...rows.entries()]
    .map(([key, entry]) => {
      const priceNow = median(entry.now);
      const pricePrecut = median(entry.precut);
      return {
        key,
        label: entry.label,
        kitchens: entry.kitchens,
        kgPerDay: entry.kg,
        priceNow,
        pricePrecut,
        premiumPercent:
          priceNow && pricePrecut && priceNow > 0
            ? ((pricePrecut - priceNow) / priceNow) * 100
            : null,
      };
    })
    .sort((a, b) => b.kgPerDay - a.kgPerDay || b.kitchens - a.kitchens);
}

/** Vegetable demand shaped for `BarList` — kilograms per day, biggest first. */
export function volumeByVegetable(responses: ResponseWithHotel[]): Slice[] {
  const demand = vegetableDemand(responses).filter((d) => d.kgPerDay > 0);
  const grand = demand.reduce((acc, d) => acc + d.kgPerDay, 0);

  return demand.map((d) => ({
    value: d.key,
    label: d.label,
    count: d.kgPerDay,
    share: grand === 0 ? 0 : (d.kgPerDay / grand) * 100,
  }));
}

// ---------------------------------------------------------------------------
// over time
// ---------------------------------------------------------------------------

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
  | { question: Question; kind: "table"; rows: VegetableDemand[] }
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

      case "table": {
        const rows = vegetableDemand(responses, question.id);
        return rows.length
          ? { question, kind: "table" as const, rows }
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
