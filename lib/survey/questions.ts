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
 */

export const QUESTIONNAIRE_VERSION = "2026-09-19.draft-1";

export type QuestionType =
  | "short_text"
  | "long_text"
  | "number"
  | "single_select"
  | "multi_select"
  | "yes_no"
  | "rating";

export type AnswerValue = string | number | string[] | null;

export type Option = { value: string; label: string };

/** Show this question only when another question's answer is one of `in`. */
export type ShowIf = { questionId: string; in: string[] };

export type Question = {
  id: string;
  label: string;
  type: QuestionType;
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
  format?: "phone" | "pincode" | "email";
  options?: Option[];
  /** Rating questions only. Defaults to 5. */
  scale?: number;
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
  vegKgPerDay: "veg_kg_per_day",
  monthlyVegSpend: "monthly_veg_spend",
  prepStaffCount: "prep_staff_count",
  prepHoursPerDay: "prep_hours_per_day",
  monthlyPrepLabourCost: "monthly_prep_labour_cost",
  wastagePercent: "wastage_percent",
  wouldBuyPrecut: "would_buy_precut",
  pricePremium: "price_premium",
  deliveryWindow: "delivery_window",
  topVegetables: "top_vegetables",
  painPoints: "pain_points",
  interestLevel: "interest_level",
  wantsTrial: "wants_free_trial",
} as const;

/** Question ids that map to typed columns on `hotels` instead of `answers`. */
export const HOTEL_FIELD_BY_QUESTION_ID: Record<string, string> = {
  hotel_name: "name",
  hotel_type: "hotel_type",
  locality: "locality",
  address: "address",
  city: "city",
  pincode: "pincode",
  contact_person: "contact_person",
  contact_role: "contact_role",
  phone: "phone",
  whatsapp: "whatsapp",
  seating_capacity: "seating_capacity",
  meals_per_day: "meals_per_day",
};

const YES_MAYBE_NO: Option[] = [
  { value: "yes", label: "Yes, interested" },
  { value: "maybe", label: "Maybe — need to see price & quality" },
  { value: "no", label: "No" },
];

export const SECTIONS: Section[] = [
  // -------------------------------------------------------------------------
  {
    id: "hotel",
    title: "Hotel details",
    description: "Who are we talking to, and where?",
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
        required: true,
        options: [
          { value: "restaurant", label: "Restaurant" },
          { value: "hotel", label: "Hotel with restaurant" },
          { value: "cloud_kitchen", label: "Cloud kitchen" },
          { value: "catering", label: "Catering service" },
          { value: "canteen", label: "Canteen / mess" },
          { value: "bakery", label: "Bakery / café" },
          { value: "other", label: "Other" },
        ],
      },
      {
        id: "locality",
        label: "Area / locality",
        type: "short_text",
        required: true,
        help: "Used to plan delivery routes — keep the spelling consistent.",
        placeholder: "e.g. Kaloor",
      },
      { id: "address", label: "Address", type: "long_text", placeholder: "Landmark is enough" },
      { id: "city", label: "City", type: "short_text" },
      {
        id: "pincode",
        label: "Pincode",
        type: "short_text",
        format: "pincode",
        placeholder: "6 digits",
      },
      {
        id: "contact_person",
        label: "Person we spoke to",
        type: "short_text",
        required: true,
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
        required: true,
        format: "phone",
        help: "10 digits. This is how we follow up, so double-check it.",
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
      {
        id: "seating_capacity",
        label: "Seating capacity",
        type: "number",
        unit: "seats",
        min: 0,
        max: 5000,
      },
      {
        id: "meals_per_day",
        label: "Meals served per day (approx.)",
        type: "number",
        unit: "meals",
        min: 0,
        max: 20000,
        help: "Their rough estimate across breakfast, lunch and dinner.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "current_practice",
    title: "How they handle vegetables today",
    description: "This is what we would be replacing. Push for real numbers.",
    questions: [
      {
        id: "who_cuts",
        label: "Who cuts and washes the vegetables now?",
        type: "single_select",
        required: true,
        options: [
          { value: "in_house", label: "Own kitchen staff" },
          { value: "dedicated_staff", label: "Staff hired only for prep work" },
          { value: "outsourced", label: "Already buying pre-cut from someone" },
          { value: "mixed", label: "Partly in-house, partly bought pre-cut" },
        ],
      },
      {
        id: "existing_supplier",
        label: "Who supplies their pre-cut vegetables?",
        type: "short_text",
        help: "Our competition. Get the name and, if they will say it, the rate.",
        showIf: { questionId: "who_cuts", in: ["outsourced", "mixed"] },
      },
      {
        id: "prep_staff_count",
        label: "How many staff work on vegetable prep each day?",
        type: "number",
        required: true,
        unit: "people",
        min: 0,
        max: 100,
      },
      {
        id: "prep_hours_per_day",
        label: "Total hours spent on cutting & washing per day",
        type: "number",
        required: true,
        unit: "hrs",
        min: 0,
        max: 100,
        decimal: true,
        help: "Add up all staff. Two people for three hours each = 6.",
      },
      {
        id: "monthly_prep_labour_cost",
        label: "Monthly salary paid for that prep work",
        type: "number",
        unit: "₹",
        min: 0,
        help: "Their estimate of the wage cost we would be saving them.",
      },
      {
        id: "purchase_source",
        label: "Where do they buy vegetables now?",
        type: "single_select",
        options: [
          { value: "local_market", label: "Local market themselves" },
          { value: "wholesale_mandi", label: "Wholesale market / mandi" },
          { value: "supplier_delivers", label: "A supplier delivers to them" },
          { value: "multiple", label: "Mix of sources" },
        ],
      },
      {
        id: "purchase_frequency",
        label: "How often do they buy?",
        type: "single_select",
        options: [
          { value: "daily", label: "Every day" },
          { value: "alternate", label: "Alternate days" },
          { value: "twice_week", label: "Twice a week" },
          { value: "weekly", label: "Weekly" },
        ],
      },
      {
        id: "veg_kg_per_day",
        label: "Vegetables used per day (approx.)",
        type: "number",
        required: true,
        unit: "kg",
        min: 0,
        max: 5000,
        decimal: true,
        help: "The single most important number on this form — this is our order volume.",
      },
      {
        id: "monthly_veg_spend",
        label: "Monthly spend on vegetables",
        type: "number",
        unit: "₹",
        min: 0,
        help: "Their wallet size. Rough figure is fine.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "pain_points",
    title: "What goes wrong today",
    description: "Their complaints are our sales pitch. Let them talk.",
    questions: [
      {
        id: "pain_points",
        label: "Biggest problems with the current process",
        type: "multi_select",
        required: true,
        help: "Tick everything they mention. Do not read the list out loud first.",
        options: [
          { value: "labour_shortage", label: "Hard to find kitchen staff" },
          { value: "time_consuming", label: "Takes too much time" },
          { value: "wastage", label: "Too much wastage / peel loss" },
          { value: "inconsistent_quality", label: "Inconsistent cut quality" },
          { value: "price_fluctuation", label: "Prices keep changing" },
          { value: "storage_space", label: "Not enough storage space" },
          { value: "hygiene", label: "Hygiene concerns" },
          { value: "absenteeism", label: "Staff absenteeism" },
          { value: "peak_hour_pressure", label: "Can't keep up at peak hours" },
        ],
      },
      {
        id: "wastage_percent",
        label: "Estimated wastage from peeling & trimming",
        type: "number",
        unit: "%",
        min: 0,
        max: 100,
        help: "Out of 10 kg bought, how much gets thrown away?",
      },
      {
        id: "staff_difficulty",
        label: "How hard is it to keep prep staff? (1 = easy, 5 = very hard)",
        type: "rating",
        scale: 5,
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "product",
    title: "What they would order",
    description: "Defines our SKU list and our processing line.",
    questions: [
      {
        id: "top_vegetables",
        label: "Vegetables they use most",
        type: "multi_select",
        required: true,
        help: "Tick the ones they actually buy in bulk, not everything they use.",
        options: [
          { value: "onion", label: "Onion" },
          { value: "tomato", label: "Tomato" },
          { value: "potato", label: "Potato" },
          { value: "carrot", label: "Carrot" },
          { value: "beans", label: "Beans" },
          { value: "cabbage", label: "Cabbage" },
          { value: "cauliflower", label: "Cauliflower" },
          { value: "capsicum", label: "Capsicum" },
          { value: "beetroot", label: "Beetroot" },
          { value: "pumpkin", label: "Pumpkin" },
          { value: "drumstick", label: "Drumstick" },
          { value: "ginger", label: "Ginger" },
          { value: "garlic", label: "Garlic" },
          { value: "green_chilli", label: "Green chilli" },
          { value: "coriander", label: "Coriander leaves" },
          { value: "curry_leaf", label: "Curry leaves" },
        ],
      },
      {
        id: "cut_types",
        label: "Cuts they need",
        type: "multi_select",
        options: [
          { value: "diced", label: "Diced / cubed" },
          { value: "sliced", label: "Sliced" },
          { value: "julienne", label: "Julienne / long strips" },
          { value: "fine_chopped", label: "Finely chopped" },
          { value: "peeled_whole", label: "Peeled but whole" },
          { value: "grated", label: "Grated" },
          { value: "paste", label: "Paste (ginger/garlic)" },
        ],
      },
      {
        id: "packaging_preference",
        label: "Packing they would prefer",
        type: "single_select",
        options: [
          { value: "bulk_5kg", label: "Bulk 5 kg packs" },
          { value: "pack_1kg", label: "1 kg packs" },
          { value: "vacuum", label: "Vacuum sealed" },
          { value: "as_per_order", label: "Exactly as per that day's order" },
        ],
      },
      {
        id: "shelf_life_needed",
        label: "How many days must it stay fresh?",
        type: "number",
        unit: "days",
        min: 0,
        max: 30,
        help: "Drives our cold chain spec. Most kitchens say 1–3.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "offer",
    title: "Would they buy from us?",
    description: "The commercial test. Do not oversell — we need honest answers.",
    questions: [
      {
        id: "would_buy_precut",
        label: "Would they buy fresh-cut, washed, ready-to-cook vegetables?",
        type: "single_select",
        required: true,
        options: YES_MAYBE_NO,
      },
      {
        id: "rejection_reason",
        label: "Why not?",
        type: "long_text",
        help: "A clear 'no' with a reason is worth more than a polite 'maybe'.",
        showIf: { questionId: "would_buy_precut", in: ["no"] },
      },
      {
        id: "price_premium",
        label: "How much more than raw market price would they pay?",
        type: "single_select",
        required: true,
        help: "This sets our margin. Ask it plainly.",
        showIf: { questionId: "would_buy_precut", in: ["yes", "maybe"] },
        options: [
          { value: "none", label: "Nothing — same price or cheaper" },
          { value: "upto_5", label: "Up to 5% more" },
          { value: "5_10", label: "5–10% more" },
          { value: "10_15", label: "10–15% more" },
          { value: "15_20", label: "15–20% more" },
          { value: "above_20", label: "Over 20% more" },
        ],
      },
      {
        id: "delivery_window",
        label: "When should we deliver?",
        type: "single_select",
        required: true,
        help: "Drives our production shift timings.",
        showIf: { questionId: "would_buy_precut", in: ["yes", "maybe"] },
        options: [
          { value: "before_6am", label: "Before 6 AM" },
          { value: "6_8am", label: "6 – 8 AM" },
          { value: "8_10am", label: "8 – 10 AM" },
          { value: "evening", label: "Previous evening" },
          { value: "twice_daily", label: "Twice a day" },
        ],
      },
      {
        id: "order_frequency",
        label: "How often would they order?",
        type: "single_select",
        showIf: { questionId: "would_buy_precut", in: ["yes", "maybe"] },
        options: [
          { value: "daily", label: "Daily" },
          { value: "alternate", label: "Alternate days" },
          { value: "twice_week", label: "Twice a week" },
          { value: "weekly", label: "Weekly" },
          { value: "as_needed", label: "Only when needed" },
        ],
      },
      {
        id: "payment_preference",
        label: "Payment terms they expect",
        type: "single_select",
        help: "Our working capital depends on this answer.",
        showIf: { questionId: "would_buy_precut", in: ["yes", "maybe"] },
        options: [
          { value: "on_delivery", label: "Cash on delivery" },
          { value: "weekly", label: "Weekly settlement" },
          { value: "fortnightly", label: "15-day credit" },
          { value: "monthly", label: "Monthly credit" },
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
          { value: "shelf_life", label: "Won't last long enough" },
          { value: "trust", label: "Don't know the supplier yet" },
          { value: "quality_control", label: "Losing control over quality" },
          { value: "supply_reliability", label: "What if delivery fails one day?" },
        ],
      },
      {
        id: "wants_free_trial",
        label: "Would they accept a free trial sample?",
        type: "yes_no",
        required: true,
        help: "A yes here is the strongest buying signal on the whole form.",
      },
      {
        id: "interest_level",
        label: "Overall interest (1 = not interested, 5 = ready to order)",
        type: "rating",
        required: true,
        scale: 5,
        help: "Your judgement as the interviewer, not their polite answer.",
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "wrap_up",
    title: "Wrap up",
    questions: [
      {
        id: "best_contact_time",
        label: "Best time to call them back",
        type: "single_select",
        options: [
          { value: "morning", label: "Morning (8–11)" },
          { value: "afternoon", label: "Afternoon (2–5)" },
          { value: "evening", label: "Evening (5–8)" },
          { value: "late_night", label: "After closing (10+)" },
        ],
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
