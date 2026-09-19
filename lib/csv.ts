import { ANSWER_QUESTIONS, optionLabel } from "@/lib/survey/questions";
import type { ResponseWithHotel } from "@/lib/types";

/** RFC-4180 quoting: wrap in quotes and double any quote inside. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // A leading =, +, - or @ makes Excel treat the cell as a formula. Contact
  // names and notes are typed by hand, so neutralise it.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

const HOTEL_COLUMNS = [
  ["Hotel", (r: ResponseWithHotel) => r.hotel.name],
  ["Type", (r: ResponseWithHotel) => r.hotel.hotel_type],
  ["Locality", (r: ResponseWithHotel) => r.hotel.locality],
  ["City", (r: ResponseWithHotel) => r.hotel.city],
  ["Pincode", (r: ResponseWithHotel) => r.hotel.pincode],
  ["Address", (r: ResponseWithHotel) => r.hotel.address],
  ["Contact", (r: ResponseWithHotel) => r.hotel.contact_person],
  ["Role", (r: ResponseWithHotel) => r.hotel.contact_role],
  ["Phone", (r: ResponseWithHotel) => r.hotel.phone],
  ["WhatsApp", (r: ResponseWithHotel) => r.hotel.whatsapp],
  ["Seats", (r: ResponseWithHotel) => r.hotel.seating_capacity],
  ["Meals/day", (r: ResponseWithHotel) => r.hotel.meals_per_day],
  ["Latitude", (r: ResponseWithHotel) => r.hotel.latitude],
  ["Longitude", (r: ResponseWithHotel) => r.hotel.longitude],
  ["Interviewed on", (r: ResponseWithHotel) => r.created_at.slice(0, 10)],
] as const;

/**
 * Every interview as one CSV row, with one column per question. Columns follow
 * the question config, so a new question appears in the export automatically.
 */
export function responsesToCsv(responses: ResponseWithHotel[]): string {
  const header = [
    ...HOTEL_COLUMNS.map(([label]) => label),
    ...ANSWER_QUESTIONS.map((q) => q.label),
  ];

  const rows = responses.map((response) => [
    ...HOTEL_COLUMNS.map(([, read]) => read(response)),
    ...ANSWER_QUESTIONS.map((question) => {
      const value = response.answers[question.id];
      if (value === null || value === undefined) return "";
      if (Array.isArray(value)) return value.map((v) => optionLabel(question, v)).join("; ");
      if (typeof value === "number") return value;
      if (question.type === "yes_no") return value === "yes" ? "Yes" : "No";
      return question.options ? optionLabel(question, value) : value;
    }),
  ]);

  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}
