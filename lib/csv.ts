import {
  ANSWER_QUESTIONS,
  asTableValue,
  isTableValue,
  optionLabel,
  type Question,
} from "@/lib/survey/questions";
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
  ["Branches", (r: ResponseWithHotel) => r.hotel.branches],
  ["Contact", (r: ResponseWithHotel) => r.hotel.contact_person],
  ["Role", (r: ResponseWithHotel) => r.hotel.contact_role],
  ["Phone", (r: ResponseWithHotel) => r.hotel.phone],
  ["WhatsApp", (r: ResponseWithHotel) => r.hotel.whatsapp],
  ["Total kg/day", (r: ResponseWithHotel) => r.veg_kg_per_day],
  ["Latitude", (r: ResponseWithHotel) => r.hotel.latitude],
  ["Longitude", (r: ResponseWithHotel) => r.hotel.longitude],
  ["Interviewed on", (r: ResponseWithHotel) => r.created_at.slice(0, 10)],
] as const;

/**
 * A table question becomes one flat column per row × column ("Onion kg/day",
 * "Onion ₹/kg now"…), because a spreadsheet cannot filter or pivot on a nested
 * object. Only the questionnaire's fixed rows are given columns; vegetables an
 * interviewer typed in themselves would make the header differ between exports,
 * so they are collected into one trailing "…(other)" column instead.
 */
function tableColumns(question: Question): { header: string; rowKey: string; columnId: string }[] {
  return (question.rows ?? []).flatMap((row) =>
    (question.columns ?? []).map((column) => ({
      header: `${row.label} ${column.label}`,
      rowKey: row.value,
      columnId: column.id,
    })),
  );
}

/**
 * Every interview as one CSV row, with one column per question. Columns follow
 * the question config, so a new question appears in the export automatically.
 */
export function responsesToCsv(responses: ResponseWithHotel[]): string {
  const header: string[] = [...HOTEL_COLUMNS.map(([label]) => label)];
  // Built alongside the header so the two can never fall out of step.
  const readers: ((r: ResponseWithHotel) => unknown)[] = HOTEL_COLUMNS.map(
    ([, read]) => read as (r: ResponseWithHotel) => unknown,
  );

  for (const question of ANSWER_QUESTIONS) {
    if (question.type === "table") {
      for (const { header: label, rowKey, columnId } of tableColumns(question)) {
        header.push(label);
        readers.push((r) => asTableValue(r.answers[question.id]).cells[rowKey]?.[columnId] ?? "");
      }
      header.push(`${question.label} (other)`);
      readers.push((r) => {
        const table = asTableValue(r.answers[question.id]);
        return table.extraRows
          .map((extra) => {
            const cells = table.cells[extra.key] ?? {};
            const parts = (question.columns ?? [])
              .filter((c) => typeof cells[c.id] === "number")
              .map((c) => `${cells[c.id]} ${c.label}`);
            return parts.length ? `${extra.label}: ${parts.join(", ")}` : null;
          })
          .filter(Boolean)
          .join("; ");
      });
      continue;
    }

    header.push(question.label);
    readers.push((r) => {
      const value = r.answers[question.id];
      if (value === null || value === undefined || isTableValue(value)) return "";
      if (Array.isArray(value)) return value.map((v) => optionLabel(question, v)).join("; ");
      if (typeof value === "number") return value;
      if (question.type === "yes_no") return value === "yes" ? "Yes" : "No";
      return question.options ? optionLabel(question, value) : value;
    });
  }

  const rows = responses.map((response) => readers.map((read) => read(response)));

  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}
