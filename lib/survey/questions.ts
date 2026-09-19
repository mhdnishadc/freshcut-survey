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

export const QUESTIONNAIRE_VERSION = "2026-09-19.v2";

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

/** Show this question only when another question's answer is one of `in`. */
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
  monthlyVegSpend: "monthly_veg_spend",
  prepStaffCount: "prep_staff_count",
  prepHoursPerDay: "prep_hours_per_day",
  monthlyPrepLabourCost: "monthly_prep_labour_cost",
  wastagePercent: "wastage_percent",
  wouldBuyPrecut: "would_buy_precut",
  pricePremium: "price_premium",
  deliveryWindow: "delivery_window",
  precutWanted: "precut_wanted",
  painPoints: "pain_points",
  interestLevel: "interest_level",
  wantsTrial: "wants_free_trial",
  precutPotential: "precut_potential",
} as const;

/** Question ids that map to typed columns on `hotels` instead of `answers`. */
export const HOTEL_FIELD_BY_QUESTION_ID: Record<string, string> = {
  hotel_name: "name",
  hotel_type: "hotel_type",
  branches: "branches",
  contact_person: "contact_person",
  contact_role: "contact_role",
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
 * The four vegetable tables on the paper form (daily usage, quantity per order,
 * current price, expected pre-cut price) asked the same twelve rows four times
 * over — roughly eighty boxes per interview, most of them left blank. They are
 * merged here into one grid: quantity per order is dropped (it is purchase
 * frequency × daily usage, both of which we ask), and the two price columns sit
 * beside each other, which is exactly how the margin question gets answered.
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
  {
    id: "price_now",
    label: "₹/kg now",
    description: "Price they pay today",
    min: 0,
    max: 2000,
    decimal: true,
  },
  {
    id: "price_precut",
    label: "₹/kg cut",
    description: "Price they would pay pre-cut",
    min: 0,
    max: 2000,
    decimal: true,
  },
];

export const SECTIONS: Section[] = [
  // -------------------------------------------------------------------------
  {
    id: "hotel",
    title: "Who we are talking to",
    description: "Only the name is needed. Skip anything they will not give you.",
    questions: [
      {
        id: "hotel_name",
        label: "Hotel / restaurant name",
        type: "short_text",
        required: true,
        placeholder: "e.g. Malabar Kitchen",
      },
      {
        id: "hotel_type",
        label: "Type of kitchen",
        type: "single_select",
        options: [
          { value: "small", label: "Small restaurant" },
          { value: "medium", label: "Medium restaurant" },
          { value: "big", label: "Big restaurant" },
          { value: "star", label: "Star hotel" },
          { value: "catering_big", label: "Catering — big kitchen" },
          { value: "catering_local", label: "Catering — local" },
          { value: "cloud_kitchen", label: "Cloud kitchen" },
          { value: "canteen", label: "Canteen / mess" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "branches",
        label: "Number of branches",
        type: "number",
        unit: "branches",
        min: 1,
        max: 500,
        help: "A chain answers once and orders for every branch — worth catching.",
      },
      {
        id: "contact_person",
        label: "Person we spoke to",
        type: "short_text",
        placeholder: "Name",
      },
      {
        id: "contact_role",
        label: "Their role",
        type: "single_select",
        options: [
          { value: "owner", label: "Owner" },
          { value: "manager", label: "Manager" },
          { value: "head_chef", label: "Head chef" },
          { value: "purchase", label: "Purchase in-charge" },
          { value: "kitchen_staff", label: "Kitchen staff" },
          { value: "other", label: "Other" },
        ],
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

  // -------------------------------------------------------------------------
  {
    id: "usage",
    title: "Vegetables they use",
    description:
      "The heart of the survey. Fill only the rows they actually buy in bulk — an empty row costs us nothing.",
    questions: [
      {
        id: "veg_table",
        label: "Quantity and price, per vegetable",
        type: "table",
        help: "Leave a box blank if they do not know. Add anything not listed.",
        rows: VEGETABLES,
        columns: VEG_COLUMNS,
        addRowLabel: "Add another vegetable",
      },
      {
        id: "purchase_form",
        label: "How do they buy vegetables today?",
        type: "multi_select",
        options: [
          { value: "whole", label: "Whole / raw / unprocessed" },
          { value: "washed", label: "Washed" },
          { value: "peeled", label: "Peeled" },
          { value: "sliced", label: "Sliced" },
          { value: "chopped", label: "Chopped" },
        ],
      },
      {
        id: "purchase_frequency",
        label: "How often do they buy?",
        type: "single_select",
        options: [
          { value: "daily", label: "Every day" },
          { value: "alternate", label: "Alternate days" },
          { value: "twice_week", label: "2–3 times a week" },
          { value: "weekly", label: "Weekly" },
        ],
      },
      {
        id: "monthly_veg_spend",
        label: "Monthly spend on vegetables",
        type: "number",
        unit: "₹",
        min: 0,
        help: "Their wallet size. A rough figure is fine.",
      },
      {
        id: "seasonal_change",
        label: "Does their vegetable use change much by season?",
        type: "yes_no",
      },
      {
        id: "seasonal_note",
        label: "What changes, and when?",
        type: "long_text",
        showIf: { questionId: "seasonal_change", in: ["yes"] },
        placeholder: "e.g. double volume during Onam and the wedding season",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "today",
    title: "Their supplier, and the cutting work",
    description: "This is what we would be replacing. Push for real numbers.",
    questions: [
      {
        id: "purchase_source",
        label: "Where do they buy from now?",
        type: "multi_select",
        options: [
          { value: "wholesale_market", label: "Wholesale market / mandi" },
          { value: "local_supplier", label: "Local vegetable supplier" },
          { value: "supermarket", label: "Supermarket" },
          { value: "farmer", label: "Direct from farmer" },
          { value: "distributor", label: "Distributor" },
          { value: "online", label: "Online supplier" },
        ],
      },
      {
        id: "supplier_factors",
        label: "What matters most when they pick a supplier?",
        type: "multi_select",
        help: "Tick everything they name. Do not read the list out first.",
        options: [
          { value: "price", label: "Price" },
          { value: "freshness", label: "Freshness" },
          { value: "quality", label: "Quality" },
          { value: "consistent_supply", label: "Consistent supply" },
          { value: "delivery", label: "Delivery service" },
          { value: "credit", label: "Credit facility" },
          { value: "packaging", label: "Packaging" },
          { value: "shelf_life", label: "Shelf life" },
          { value: "hygiene", label: "Hygiene" },
          { value: "grading", label: "Consistent size / grade" },
        ],
      },
      {
        id: "prep_staff_count",
        label: "Staff who peel and cut vegetables",
        type: "number",
        unit: "people",
        min: 0,
        max: 100,
      },
      {
        id: "prep_hours_per_day",
        label: "Total hours spent cutting & washing per day",
        type: "number",
        unit: "hrs",
        min: 0,
        max: 100,
        decimal: true,
        help: "Add up all staff. Two people for three hours each = 6.",
      },
      {
        id: "monthly_prep_labour_cost",
        label: "Monthly wages paid for that prep work",
        type: "number",
        unit: "₹",
        min: 0,
        help: "Their estimate of the wage bill we would be taking off them.",
      },
      {
        id: "wastage_percent",
        label: "Wastage from peeling & trimming",
        type: "number",
        unit: "%",
        min: 0,
        max: 100,
        help: "Out of 10 kg bought, how much gets thrown away?",
      },
      {
        id: "pain_points",
        label: "Biggest problems with how they do it today",
        type: "multi_select",
        help: "Their complaints are our sales pitch. Let them talk first.",
        options: [
          { value: "labour_shortage", label: "Hard to find kitchen staff" },
          { value: "time_consuming", label: "Takes too much time" },
          { value: "wastage", label: "Too much wastage / peel loss" },
          { value: "inconsistent_quality", label: "Inconsistent cut quality" },
          { value: "price_fluctuation", label: "Prices keep changing" },
          { value: "storage_space", label: "Not enough storage space" },
          { value: "hygiene", label: "Hygiene concerns" },
          { value: "absenteeism", label: "Staff absenteeism" },
          { value: "peak_hour_pressure", label: "Cannot keep up at peak hours" },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "precut",
    title: "Would they buy pre-cut?",
    description: "The commercial test. Do not oversell — we need honest answers.",
    questions: [
      {
        id: "buys_precut_now",
        label: "Are they buying any pre-cut vegetables already?",
        type: "yes_no",
      },
      {
        id: "precut_items_now",
        label: "Which ones, and from whom?",
        type: "short_text",
        help: "Our competition. Get the name and, if they will say it, the rate.",
        showIf: { questionId: "buys_precut_now", in: ["yes"] },
      },
      {
        id: "would_buy_precut",
        label: "With reliable quality and delivery, would they buy from us?",
        type: "single_select",
        options: [
          { value: "definitely", label: "Definitely" },
          { value: "probably", label: "Probably" },
          { value: "maybe", label: "Maybe — need to see price & quality" },
          { value: "no", label: "No" },
        ],
      },
      {
        id: "rejection_reason",
        label: "Why not?",
        type: "long_text",
        help: "A clear 'no' with a reason is worth more than a polite 'maybe'.",
        showIf: { questionId: "would_buy_precut", in: ["no"] },
      },
      {
        id: "precut_wanted",
        label: "Which vegetables would they want pre-cut?",
        type: "multi_select",
        help: "This is our starting product list. Tick their real priorities.",
        options: VEGETABLES,
      },
      {
        id: "replaceable_percent",
        label: "Share of their vegetables that could switch to pre-cut",
        type: "number",
        unit: "%",
        min: 0,
        max: 100,
      },
      {
        id: "price_premium",
        label: "How much more than raw price would they pay?",
        type: "single_select",
        help: "This sets our margin. Ask it plainly.",
        options: [
          { value: "none", label: "Nothing — same price or cheaper" },
          { value: "upto_5", label: "Up to 5% more" },
          { value: "5_10", label: "5–10% more" },
          { value: "10_15", label: "10–15% more" },
          { value: "15_20", label: "15–20% more" },
          { value: "20_25", label: "20–25% more" },
          { value: "above_25", label: "Over 25% more" },
        ],
      },
      {
        id: "concerns",
        label: "What worries them about buying pre-cut?",
        type: "multi_select",
        options: [
          { value: "freshness", label: "Will it be fresh?" },
          { value: "hygiene", label: "Hygiene of the cutting unit" },
          { value: "price", label: "Price too high" },
          { value: "shelf_life", label: "Will not last long enough" },
          { value: "trust", label: "Do not know the supplier yet" },
          { value: "quality_control", label: "Losing control over quality" },
          { value: "supply_reliability", label: "What if delivery fails one day?" },
        ],
      },
      {
        id: "wants_free_trial",
        label: "Would they accept a free trial sample?",
        type: "yes_no",
        help: "A yes here is the strongest buying signal on the whole form.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "logistics",
    title: "How they would want it delivered",
    description: "Sets our pack sizes, our cold chain and our shift timings.",
    questions: [
      {
        id: "pack_size",
        label: "Pack size they would prefer",
        type: "single_select",
        options: [
          { value: "500g", label: "500 g" },
          { value: "1kg", label: "1 kg" },
          { value: "2kg", label: "2 kg" },
          { value: "5kg", label: "5 kg" },
          { value: "10kg", label: "10 kg" },
          { value: "as_per_order", label: "Exactly as per that day's order" },
        ],
      },
      {
        id: "packaging_preference",
        label: "Packaging they would prefer",
        type: "single_select",
        options: [
          { value: "plastic_bag", label: "Plastic bag" },
          { value: "vacuum", label: "Vacuum pack" },
          { value: "sealed_tray", label: "Sealed tray" },
          { value: "food_grade_box", label: "Food-grade container" },
        ],
      },
      {
        id: "shelf_life_needed",
        label: "Shelf life they expect",
        type: "single_select",
        help: "Drives our cold-chain spec. Most kitchens say 1–3 days.",
        options: [
          { value: "1", label: "1 day" },
          { value: "2", label: "2 days" },
          { value: "3", label: "3 days" },
          { value: "4_5", label: "4–5 days" },
          { value: "above_5", label: "More than 5 days" },
        ],
      },
      {
        id: "delivery_window",
        label: "When should we deliver?",
        type: "single_select",
        options: [
          { value: "early_morning", label: "Early morning (before 6)" },
          { value: "morning", label: "Morning (6–10)" },
          { value: "afternoon", label: "Afternoon" },
          { value: "evening", label: "Evening / previous night" },
          { value: "flexible", label: "Flexible" },
        ],
      },
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
        id: "payment_preference",
        label: "Payment terms they expect",
        type: "single_select",
        help: "Our working capital depends on this answer.",
        options: [
          { value: "on_delivery", label: "Cash on delivery" },
          { value: "weekly", label: "Weekly settlement" },
          { value: "fortnightly", label: "15-day credit" },
          { value: "monthly", label: "Monthly credit" },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "observation",
    title: "Your read on them",
    description: "Filled in by you, the interviewer — not asked out loud.",
    questions: [
      {
        id: "biggest_problem",
        label: "Biggest problem they face with vegetable purchasing",
        type: "long_text",
        placeholder: "In their own words, if you can",
      },
      {
        id: "wanted_improvement",
        label: "What they most want from a vegetable supplier",
        type: "long_text",
      },
      {
        id: "precut_potential",
        label: "Your rating of their pre-cut potential",
        type: "single_select",
        options: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ],
      },
      {
        id: "interest_level",
        label: "Overall interest (1 = not interested, 5 = ready to order)",
        type: "rating",
        scale: 5,
        help: "Your judgement as the interviewer, not their polite answer.",
      },
      {
        id: "notes",
        label: "Anything else worth remembering",
        type: "long_text",
        placeholder: "Mood of the conversation, who really decides, next step…",
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
 */
export function isVisible(
  question: Question,
  answers: Record<string, AnswerValue | undefined>,
): boolean {
  if (!question.showIf) return true;
  const controlling = answers[question.showIf.questionId];
  if (typeof controlling !== "string") return false;
  return question.showIf.in.includes(controlling);
}
