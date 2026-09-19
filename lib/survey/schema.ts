import { z } from "zod";

import {
  ALL_QUESTIONS,
  EMPTY_TABLE,
  asTableValue,
  isVisible,
  type AnswerValue,
  type Question,
} from "./questions";

/** The shape react-hook-form carries: one entry per question id. */
export type SurveyValues = Record<string, AnswerValue | undefined>;

const PHONE = /^[0-9]{10}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmpty(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(asTableValue(value).cells).length === 0;
  return Number.isNaN(value);
}

/** Digits only, so "98765 43210" and "+91-9876543210" both validate. */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function checkNumber(
  n: number,
  bounds: { min?: number; max?: number; decimal?: boolean },
  add: (message: string) => void,
): void {
  if (!Number.isFinite(n)) {
    add("Enter a number");
    return;
  }
  if (!bounds.decimal && !Number.isInteger(n)) add("Whole numbers only");
  if (bounds.min !== undefined && n < bounds.min) add(`Cannot be less than ${bounds.min}`);
  if (bounds.max !== undefined && n > bounds.max) {
    add(`That looks too high — the maximum is ${bounds.max}`);
  }
}

/**
 * Checks one answer. A blank answer is only ever an error on `hotel_name`;
 * everything else is validated for *correctness* and nothing else, so an
 * interview can be saved at any point with as little as a name filled in.
 */
function checkOne(
  question: Question,
  value: AnswerValue | undefined,
  add: (message: string) => void,
): void {
  if (isEmpty(value)) {
    if (question.required) add("This answer is required");
    return;
  }

  switch (question.type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      checkNumber(n, question, add);
      return;
    }

    case "rating": {
      const n = typeof value === "number" ? value : Number(value);
      const scale = question.scale ?? 5;
      if (!Number.isInteger(n) || n < 1 || n > scale) add(`Pick a rating from 1 to ${scale}`);
      return;
    }

    case "single_select":
    case "yes_no": {
      const allowed =
        question.type === "yes_no"
          ? ["yes", "no"]
          : (question.options ?? []).map((o) => o.value);
      if (typeof value !== "string" || !allowed.includes(value)) add("Pick one of the options");
      return;
    }

    case "multi_select": {
      if (!Array.isArray(value)) {
        add("Pick at least one option");
        return;
      }
      const allowed = new Set((question.options ?? []).map((o) => o.value));
      if (value.some((v) => !allowed.has(v))) add("Unknown option selected");
      return;
    }

    case "table": {
      const table = asTableValue(value);
      const columns = new Map((question.columns ?? []).map((c) => [c.id, c]));
      const knownRows = new Set([
        ...(question.rows ?? []).map((r) => r.value),
        ...table.extraRows.map((r) => r.key),
      ]);

      for (const [rowKey, row] of Object.entries(table.cells)) {
        if (!knownRows.has(rowKey)) {
          add("This table has a row we do not recognise");
          return;
        }
        for (const [columnId, n] of Object.entries(row)) {
          const column = columns.get(columnId);
          if (!column) {
            add("This table has a column we do not recognise");
            return;
          }
          if (n === null) continue;
          checkNumber(n, column, (message) =>
            // Row names carry the error, because the grid is too narrow to
            // show a message under the cell that caused it.
            add(`${labelOfRow(question, table, rowKey)}, ${column.label}: ${message}`),
          );
        }
      }
      return;
    }

    case "short_text":
    case "long_text": {
      if (typeof value !== "string") {
        add("Enter some text");
        return;
      }
      const text = value.trim();
      if (question.format === "phone" && !PHONE.test(normalisePhone(text))) {
        add("Enter a 10-digit phone number");
      }
      if (question.format === "email" && !EMAIL.test(text)) add("Enter a valid email address");
      if (text.length > 2000) add("Too long — keep it under 2000 characters");
      return;
    }
  }
}

function labelOfRow(
  question: Question,
  table: { extraRows: { key: string; label: string }[] },
  rowKey: string,
): string {
  return (
    question.rows?.find((r) => r.value === rowKey)?.label ??
    table.extraRows.find((r) => r.key === rowKey)?.label ??
    rowKey
  );
}

/**
 * Validation is generated from the question config rather than written out by
 * hand, so a new question is validated the moment it is added. Conditional
 * questions are only enforced while they are actually on screen — switching
 * "would you buy pre-cut" to "no" must not block the form on a hidden
 * follow-up.
 */
export const surveySchema = z
  .record(
    z.string(),
    z
      .union([z.string(), z.number(), z.array(z.string()), z.record(z.string(), z.unknown()), z.null()])
      .optional(),
  )
  .superRefine((values, ctx) => {
    const answers = values as SurveyValues;
    for (const question of ALL_QUESTIONS) {
      if (!isVisible(question, answers)) continue;
      checkOne(question, answers[question.id], (message) =>
        ctx.addIssue({ code: "custom", path: [question.id], message }),
      );
    }
  });

/**
 * Field-level errors for the given questions, keyed by question id. Used by the
 * form to flag bad answers as the interviewer moves between sections; the
 * server re-validates everything with `surveySchema` above, so this is
 * convenience, never the gate.
 */
export function collectErrors(
  values: SurveyValues,
  questions: Question[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const question of questions) {
    if (!isVisible(question, values)) continue;
    checkOne(question, values[question.id], (message) => {
      errors[question.id] ??= message;
    });
  }
  return errors;
}

/** Empty answers for every question — the form needs a stable shape. */
export function emptyValues(): SurveyValues {
  const values: SurveyValues = {};
  for (const question of ALL_QUESTIONS) {
    values[question.id] =
      question.type === "multi_select"
        ? []
        : question.type === "table"
          ? { ...EMPTY_TABLE, cells: {}, extraRows: [] }
          : null;
  }
  return values;
}

/**
 * Strip answers belonging to questions that are currently hidden. Without this,
 * an interviewer who picks "yes", fills the follow-ups, then switches to "no"
 * would leave stale answers behind in the stored record.
 */
export function pruneHidden(values: SurveyValues): SurveyValues {
  const pruned: SurveyValues = {};
  for (const question of ALL_QUESTIONS) {
    if (isVisible(question, values)) pruned[question.id] = values[question.id];
  }
  return pruned;
}
