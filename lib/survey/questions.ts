/**
 * THE QUESTIONNAIRE.
 *
 * This single file drives everything: the form fields, the validation rules and
 * the dashboard charts. To change the survey, edit the sections below — no
 * database migration and no component changes are needed.
 *
 * Rules of the road:
 *  - `id` is the storage key inside `survey_responses.answers`. Once interviews
 *    exist, changing an id orphans the old answers. Add a new question instead.
 *  - Ids listed in `HOTEL_FIELD_BY_QUESTION_ID` are written to real columns on
 *    `hotels` rather than into the JSON blob.
 *  - Bump `QUESTIONNAIRE_VERSION` whenever you change questions, so responses
 *    stay interpretable after the fact.
 *
 * ONLY `hotel_name` IS REQUIRED. Every other answer may be left blank: a chef
 * mid-service will answer four questions and walk away, and a partial interview
 * is worth far more than an abandoned one. Validation therefore only ever
 * rejects answers that are *wrong* (a 3-digit phone, 900 kg of coriander), never
 * answers that are *missing*.
 */

export const QUESTIONNAIRE_VERSION = "2026-09-24.v4";

export type QuestionType =
  | "short_text"
  | "long_text"
  | "number"
  | "single_select"
  | "multi_select"
  | "yes_no"
  | "rating"
  | "table";

/** One row of a `table` question: column id → the number typed in that cell. */
export type TableCells = Record<string, number | null>;

/**
 * A `table` answer. `cells` is keyed by row value (or by an extra row's key);
 * `extraRows` carries the vegetables the interviewer added on the spot, which
 * is how the questionnaire's OTHER1–OTHER8 slots are handled without shipping
 * eight blank rows to every interview.
 */
export type TableValue = {
  cells: Record<string, TableCells>;
  extraRows: { key: string; label: string }[];
};

export type AnswerValue = string | number | string[] | TableValue | null;

export type Option = { value: string; label: string };

export type TableColumn = {
  id: string;
  /** Column heading. Kept to ~10 characters — this is a phone screen. */
  label: string;
  /** Spoken form, used in the review screen and the CSV header. */
  description: string;
  min?: number;
  max?: number;
  decimal?: boolean;
};

/**
 * Show this question only when another question's answer is one of `in`. The
 * controlling question may be a multi_select, in which case the follow-up
 * appears as soon as one of `in` is ticked — that is how every "Other: ____"
 * box on the paper form is wired up.
 */
export type ShowIf = { questionId: string; in: string[] };

export type Question = {
  id: string;
  label: string;
  type: QuestionType;
  /** Only ever set on `hotel_name`. See the note at the top of this file. */
  required?: boolean;
  /** Shown under the label — use it to tell the interviewer how to ask. */
  help?: string;
  placeholder?: string;
  /** Rendered inside number inputs, e.g. "kg", "hrs", "₹". */
  unit?: string;
  min?: number;
  max?: number;
  /** Number inputs only: allow decimals. */
  decimal?: boolean;
  /** Extra text validation, applied only when the field is non-empty. */
  format?: "phone" | "email";
  options?: Option[];
  /**
   * multi_select only: the most options that may be ticked. The paper form asks
   * for a "TOP 3", and an uncapped list reliably comes back with seven ticks,
   * which tells us nothing about priority.
   */
  maxSelect?: number;
  /** Rating questions only. Defaults to 5. */
  scale?: number;
  /** Table questions only. */
  rows?: Option[];
  columns?: TableColumn[];
  addRowLabel?: string;
  showIf?: ShowIf;
  /** How the dashboard should summarise this question. Defaults per type. */
  chart?: "bar" | "donut" | "stat" | "none";
};

export type Section = {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
};

/**
 * Question ids the dashboard computes headline numbers from. Kept here so that
 * renaming a question surfaces as a type error rather than a silent zero.
 */
export const KEY_QUESTIONS = {
  vegTable: "veg_table",
  wouldBuyPrecut: "would_buy_precut",
  deliveryWindow: "delivery_window",
  precutWanted: "precut_wanted",
  precutMainReason: "precut_main_reason",
  supplierProblems: "supplier_problems",
  replaceablePercent: "replaceable_percent",
} as const;

/** Question ids that map to typed columns on `hotels` instead of `answers`. */
export const HOTEL_FIELD_BY_QUESTION_ID: Record<string, string> = {
  hotel_name: "name",
  location: "location",
  hotel_type: "hotel_type",
  contact_person: "contact_person",
  phone: "phone",
  whatsapp: "whatsapp",
};

/**
 * The vegetable list, straight from the printed questionnaire. It is used twice
 * — as the rows of the usage/price table and as the options of "which would
 * they want pre-cut" — so the two can never drift apart.
 */
export const VEGETABLES: Option[] = [
  { value: "onion", label: "Onion" },
  { value: "tomato", label: "Tomato" },
  { value: "potato", label: "Potato" },
  { value: "carrot", label: "Carrot" },
  { value: "cabbage", label: "Cabbage" },
  { value: "capsicum", label: "Capsicum" },
  { value: "cucumber", label: "Cucumber" },
  { value: "lettuce", label: "Lettuce" },
  { value: "coriander", label: "Coriander" },
  { value: "green_chilli", label: "Green chilli" },
  { value: "garlic", label: "Garlic" },
  { value: "ginger", label: "Ginger" },
];

/**
 * Question 2 asks one thing per vegetable — how much they get through in a day —
 * so the grid has one column. The price columns this table used to carry are
 * gone with the rest of the off-form questions.
 */
const VEG_COLUMNS: TableColumn[] = [
  {
    id: "kg_day",
    label: "kg/day",
    description: "Used per day",
    min: 0,
    max: 5000,
    decimal: true,
  },
];

export const SECTIONS: Section[] = [
  // -------------------------------------------------------------------------
  // Question 1. The contact block belongs to question 13 and sits on the last
  // step, where the paper form puts it — asking a stranger for their number is
  // the last thing you do, not the first.
  {
    id: "hotel",
    title: "Business details",
    description: "Only the name is needed. Skip anything they will not give you.",
    questions: [
      {
        // The id stays `hotel_name` — it is the storage key and the `hotels.name`
        // column. Only what the interviewer reads has changed, because we survey
        // bakeries and cloud kitchens too, not just hotels.
        id: "hotel_name",
        label: "Business name",
        type: "short_text",
        required: true,
        placeholder: "e.g. Malabar Kitchen",
      },
      {
        id: "location",
        label: "Location",
        type: "short_text",
        placeholder: "Area, town or landmark",
        help: "Where the kitchen is. The GPS button below stores exact coordinates.",
      },
      {
        id: "hotel_type",
        label: "Type of business",
        type: "single_select",
        options: [
          { value: "hotel", label: "Hotel" },
          { value: "restaurant", label: "Restaurant" },
          { value: "catering", label: "Catering" },
          { value: "cloud_kitchen", label: "Cloud kitchen" },
          { value: "bakery", label: "Bakery" },
          { value: "other", label: "Other" },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Questions 2, 3 and 7.
  {
    id: "usage",
    title: "Vegetables they buy",
    description:
      "Fill only the rows they actually buy in bulk — an empty row costs us nothing.",
    questions: [
      {
        id: "veg_table",
        label: "Which vegetables do they buy regularly, and how much?",
        type: "table",
        help: "Leave a box blank if they do not know. Add anything not listed.",
        rows: VEGETABLES,
        columns: VEG_COLUMNS,
        addRowLabel: "Add another vegetable",
      },
      {
        id: "purchase_frequency",
        label: "How often do they buy vegetables?",
        type: "single_select",
        options: [
          { value: "daily", label: "Daily" },
          { value: "twice_week", label: "2–3 times a week" },
          { value: "weekly", label: "Weekly" },
        ],
      },
      {
        id: "purchase_form",
        label: "In what form do they buy vegetables today?",
        type: "multi_select",
        // The paper form lists "Combination" as a sixth box. Here it is not a
        // separate option — ticking two boxes already says "combination", and an
        // option that overlaps the others just splits the same answer two ways.
        help: "Tick every form they buy. More than one is normal.",
        options: [
          { value: "whole", label: "Whole / raw" },
          { value: "washed", label: "Washed" },
          { value: "peeled", label: "Peeled" },
          { value: "sliced", label: "Sliced" },
          { value: "chopped", label: "Chopped" },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Questions 4, 5 and 6.
  {
    id: "today",
    title: "Their supplier today",
    description: "This is who we would be replacing.",
    questions: [
      {
        id: "purchase_source",
        label: "Where do they buy vegetables now?",
        type: "multi_select",
        options: [
          { value: "wholesale_market", label: "Wholesale market" },
          { value: "local_supplier", label: "Local supplier" },
          { value: "distributor", label: "Distributor" },
          { value: "farmer", label: "Directly from farmer" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "supplier_factors",
        label: "Their TOP 3 priorities when choosing a supplier",
        type: "multi_select",
        maxSelect: 3,
        help: "Let them name three. Do not read the list out first.",
        options: [
          { value: "price", label: "Price" },
          { value: "freshness", label: "Freshness" },
          { value: "quality", label: "Quality" },
          { value: "consistent_supply", label: "Reliable supply" },
          { value: "delivery", label: "On-time delivery" },
          { value: "hygiene", label: "Hygiene" },
          { value: "shelf_life", label: "Shelf life" },
          { value: "grading", label: "Consistent grade" },
        ],
      },
      {
        id: "supplier_problems",
        label: "Biggest problem with their current supplier",
        type: "multi_select",
        help: "Their complaint is our opening. Let them talk first.",
        options: [
          { value: "price", label: "Price" },
          { value: "quality_freshness", label: "Quality / freshness" },
          { value: "supply", label: "Supply" },
          { value: "delivery", label: "Delivery" },
          { value: "wastage", label: "Wastage" },
          { value: "hygiene", label: "Hygiene" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "supplier_problems_other",
        label: "What other problem?",
        type: "short_text",
        showIf: { questionId: "supplier_problems", in: ["other"] },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Questions 8 to 11.
  {
    id: "precut",
    title: "Pre-cut vegetables",
    description: "The commercial test. Do not oversell — we need honest answers.",
    questions: [
      {
        id: "buys_precut_now",
        label: "Do they buy pre-cut / ready-to-use vegetables already?",
        type: "yes_no",
      },
      {
        id: "precut_items_now",
        label: "Which ones?",
        type: "short_text",
        help: "Our competition. Get the supplier's name too, if they will say it.",
        showIf: { questionId: "buys_precut_now", in: ["yes"] },
      },
      {
        id: "precut_wanted",
        label: "Which pre-cut vegetables would they be interested in?",
        type: "multi_select",
        help: "This is our starting product list. Tick their real priorities.",
        options: [...VEGETABLES, { value: "other", label: "Other" }],
      },
      {
        id: "precut_wanted_other",
        label: "Which other vegetable?",
        type: "short_text",
        showIf: { questionId: "precut_wanted", in: ["other"] },
      },
      {
        id: "precut_main_reason",
        label: "MAIN reason they would buy pre-cut",
        type: "single_select",
        help: "One answer — the reason they say first. This is our advertising line.",
        options: [
          { value: "save_labour", label: "Save labour" },
          { value: "save_time", label: "Save time" },
          { value: "reduce_wastage", label: "Reduce wastage" },
          { value: "hygiene", label: "Hygiene" },
          { value: "consistent_cutting", label: "Consistent cutting" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "precut_main_reason_other",
        label: "What other reason?",
        type: "short_text",
        showIf: { questionId: "precut_main_reason", in: ["other"] },
      },
      {
        // Asked as bands, not a typed number: nobody knows their percentage to
        // the point, and a band is one tap instead of a keyboard.
        id: "replaceable_percent",
        label: "Roughly what share of their vegetables could be pre-cut?",
        type: "single_select",
        options: [
          { value: "under_25", label: "Less than 25%" },
          { value: "25_50", label: "25–50%" },
          { value: "50_75", label: "50–75%" },
          { value: "above_75", label: "More than 75%" },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Question 12.
  {
    id: "logistics",
    title: "Service options they would prefer",
    description: "Sets our pack sizes, our cold chain and our shift timings.",
    questions: [
      {
        id: "delivery_frequency",
        label: "How often would they want delivery?",
        type: "single_select",
        options: [
          { value: "daily", label: "Daily" },
          { value: "thrice_week", label: "3 times a week" },
          { value: "twice_week", label: "2 times a week" },
          { value: "weekly", label: "Weekly" },
        ],
      },
      {
        id: "delivery_window",
        label: "What delivery time would they want?",
        type: "single_select",
        options: [
          { value: "early_morning", label: "Early morning" },
          { value: "morning", label: "Morning" },
          { value: "afternoon", label: "Afternoon" },
          { value: "evening", label: "Evening" },
        ],
      },
      {
        id: "pack_size",
        label: "What pack size would they want?",
        type: "single_select",
        options: [
          { value: "500g", label: "500 g" },
          { value: "1kg", label: "1 kg" },
          { value: "2kg", label: "2 kg" },
          { value: "5kg", label: "5 kg" },
          { value: "10kg", label: "10 kg" },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Question 13 — the closing ask, the brief for the first delivery, and the
  // contact details. Last step on purpose: by now they have talked to you for
  // ten minutes, which is when a phone number is easiest to get.
  {
    id: "trial",
    title: "Close and contact",
    description:
      "Ask it straight: good quality, hygiene, competitive pricing and reliable delivery. Then take their number.",
    questions: [
      {
        id: "would_buy_precut",
        label: "Would they try our products?",
        type: "single_select",
        help: "The one answer this whole interview exists to get.",
        options: [
          { value: "yes", label: "Yes" },
          { value: "maybe", label: "Maybe" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "trial_vegetable",
        label: "Preferred vegetable for the trial",
        type: "single_select",
        showIf: { questionId: "would_buy_precut", in: ["yes"] },
        options: [...VEGETABLES, { value: "other", label: "Other" }],
      },
      {
        id: "trial_quantity_kg",
        label: "Approximate trial quantity",
        type: "number",
        unit: "kg",
        min: 0,
        max: 500,
        decimal: true,
        showIf: { questionId: "would_buy_precut", in: ["yes"] },
      },
      {
        // Deliberately NOT gated behind a "yes". A maybe with a phone number is
        // a lead we can call back; a maybe without one is nothing at all.
        id: "contact_person",
        label: "Contact person",
        type: "short_text",
        placeholder: "Name",
      },
      {
        id: "phone",
        label: "Phone number",
        type: "short_text",
        format: "phone",
        help: "10 digits. Without this we cannot follow up, so push for it.",
        placeholder: "9876543210",
      },
      {
        id: "whatsapp",
        label: "WhatsApp number",
        type: "short_text",
        format: "phone",
        help: "Leave blank if it is the same as the phone number.",
        placeholder: "9876543210",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Derived lookups — computed once at module load.
// ---------------------------------------------------------------------------

export const ALL_QUESTIONS: Question[] = SECTIONS.flatMap((s) => s.questions);

export const QUESTION_BY_ID = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));

/** Questions stored inside `survey_responses.answers` (i.e. not hotel columns). */
export const ANSWER_QUESTIONS: Question[] = ALL_QUESTIONS.filter(
  (q) => !(q.id in HOTEL_FIELD_BY_QUESTION_ID),
);

export function optionLabel(question: Question, value: string): string {
  return question.options?.find((o) => o.value === value)?.label ?? value;
}

// ---------------------------------------------------------------------------
// table helpers
// ---------------------------------------------------------------------------

export const EMPTY_TABLE: TableValue = { cells: {}, extraRows: [] };

/**
 * Narrows an answer to a table value. Answers arrive from localStorage and from
 * Postgres JSONB, so neither the shape nor the types can be assumed.
 */
export function isTableValue(value: AnswerValue | undefined): value is TableValue {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "cells" in value &&
    typeof (value as TableValue).cells === "object"
  );
}

export function asTableValue(value: AnswerValue | undefined): TableValue {
  if (!isTableValue(value)) return EMPTY_TABLE;
  return {
    cells: value.cells ?? {},
    extraRows: Array.isArray(value.extraRows) ? value.extraRows : [],
  };
}

/** Configured rows first, then whatever the interviewer typed in. */
export function tableRows(question: Question, value: AnswerValue | undefined): Option[] {
  const extra = asTableValue(value).extraRows.map((r) => ({ value: r.key, label: r.label }));
  return [...(question.rows ?? []), ...extra];
}

/** A row's display name, falling back to the stored key for deleted extras. */
export function tableRowLabel(
  question: Question,
  table: TableValue,
  rowKey: string,
): string {
  return (
    question.rows?.find((r) => r.value === rowKey)?.label ??
    table.extraRows.find((r) => r.key === rowKey)?.label ??
    rowKey
  );
}

/** True when at least one cell in the table holds a number. */
export function tableHasContent(value: AnswerValue | undefined): boolean {
  const table = asTableValue(value);
  return Object.values(table.cells).some((row) =>
    Object.values(row).some((n) => typeof n === "number" && Number.isFinite(n)),
  );
}

/** Drops empty cells and orphan rows, so blank interviews store `{}` not noise. */
export function compactTable(value: AnswerValue | undefined): TableValue {
  const table = asTableValue(value);
  const cells: Record<string, TableCells> = {};

  for (const [rowKey, row] of Object.entries(table.cells)) {
    const kept: TableCells = {};
    for (const [columnId, n] of Object.entries(row)) {
      if (typeof n === "number" && Number.isFinite(n)) kept[columnId] = n;
    }
    if (Object.keys(kept).length > 0) cells[rowKey] = kept;
  }

  return {
    cells,
    extraRows: table.extraRows.filter((r) => r.key in cells),
  };
}

/**
 * Whether a question should be shown, given the answers so far. A question with
 * no `showIf` is always visible; otherwise the controlling answer must match.
 *
 * A multi_select controls its follow-ups by intersection: tick "Other" anywhere
 * in the list and the "which other?" box opens, untick it and the box (and its
 * answer, via `pruneHidden`) goes away again.
 */
export function isVisible(
  question: Question,
  answers: Record<string, AnswerValue | undefined>,
): boolean {
  const { showIf } = question;
  if (!showIf) return true;
  const controlling = answers[showIf.questionId];
  if (Array.isArray(controlling)) return controlling.some((v) => showIf.in.includes(v));
  if (typeof controlling !== "string") return false;
  return showIf.in.includes(controlling);
}
