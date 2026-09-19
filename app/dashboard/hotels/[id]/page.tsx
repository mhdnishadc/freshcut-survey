import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, Card, CardTitle } from "@/components/ui";
import { getHotel } from "@/lib/data";
import { num, shortDate, telHref, whatsappHref } from "@/lib/format";
import {
  HOTEL_FIELD_BY_QUESTION_ID,
  QUESTION_BY_ID,
  SECTIONS,
  asTableValue,
  isTableValue,
  isVisible,
  optionLabel,
  tableRowLabel,
  type AnswerValue,
  type Question,
} from "@/lib/survey/questions";

export const dynamic = "force-dynamic";

export default async function HotelDetailPage(props: PageProps<"/dashboard/hotels/[id]">) {
  const { id } = await props.params;
  const record = await getHotel(id);
  if (!record) notFound();

  const { hotel, responses } = record;
  const latest = responses[0];

  const tel = telHref(hotel.phone);
  const wa = whatsappHref(hotel.whatsapp ?? hotel.phone);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard/hotels" className="text-[13px] text-muted hover:text-foreground">
          ← All hotels
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{hotel.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {hotel.hotel_type
            ? optionLabel(QUESTION_BY_ID.get("hotel_type")!, hotel.hotel_type)
            : "Kitchen type not recorded"}
          {responses.length > 1 ? ` · ${responses.length} interviews` : ""}
        </p>
      </div>

      <Card>
        <CardTitle>Contact</CardTitle>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Person" value={hotel.contact_person} />
          <Field label="Role" value={hotel.contact_role} />
          <Field label="Phone" value={hotel.phone} />
          <Field label="WhatsApp" value={hotel.whatsapp} />
          <Field label="Branches" value={hotel.branches} />
        </dl>

        {(tel || wa || (hotel.latitude && hotel.longitude)) && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {tel ? (
              <a
                href={tel}
                className="rounded-lg bg-brand px-3.5 py-2.5 text-sm font-medium text-brand-fg hover:bg-brand-hover"
              >
                Call
              </a>
            ) : null}
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border-strong px-3.5 py-2.5 text-sm font-medium hover:bg-surface-2"
              >
                WhatsApp
              </a>
            ) : null}
            {hotel.latitude && hotel.longitude ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${hotel.latitude},${hotel.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border-strong px-3.5 py-2.5 text-sm font-medium hover:bg-surface-2"
              >
                Open in Maps
              </a>
            ) : null}
          </div>
        )}
      </Card>

      {latest ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">Interest {latest.interest_level ?? "—"}/5</Badge>
            <Badge>{num(latest.veg_kg_per_day, "kg/day")}</Badge>
            <span className="text-[13px] text-faint">
              Interviewed {shortDate(latest.created_at)}
            </span>
          </div>

          {SECTIONS.map((section) => {
            const questions = section.questions.filter(
              (q) => !(q.id in HOTEL_FIELD_BY_QUESTION_ID) && isVisible(q, latest.answers),
            );
            if (questions.length === 0) return null;

            return (
              <Card key={section.id}>
                <CardTitle>{section.title}</CardTitle>
                <dl className="space-y-3">
                  {questions.map((question) => (
                    <div
                      key={question.id}
                      className="grid gap-1 border-b border-border pb-3 last:border-0 last:pb-0 sm:grid-cols-[1fr_1.2fr] sm:gap-4"
                    >
                      <dt className="text-[13px] text-muted">{question.label}</dt>
                      <dd className="text-sm">
                        <Answer question={question} value={latest.answers[question.id]} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            );
          })}

          {responses.length > 1 ? (
            <Card>
              <CardTitle hint="This hotel has been interviewed more than once.">
                Earlier interviews
              </CardTitle>
              <ul className="space-y-1.5 text-[13px]">
                {responses.slice(1).map((response) => (
                  <li key={response.id} className="flex justify-between gap-3 text-muted">
                    <span>{shortDate(response.created_at)}</span>
                    <span className="tabular-nums">
                      Interest {response.interest_level ?? "—"}/5 ·{" "}
                      {num(response.veg_kg_per_day, "kg/day")}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <p className="text-sm text-muted">This hotel has no recorded interview yet.</p>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Field({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <dt className="text-[12px] text-faint">{label}</dt>
      <dd className="text-sm">{value === null || value === "" ? "—" : value}</dd>
    </div>
  );
}

function Answer({ question, value }: { question: Question; value: AnswerValue | undefined }) {
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-faint">Not answered</span>;
  }

  if (isTableValue(value)) {
    const table = asTableValue(value);
    const entries = Object.entries(table.cells);
    if (entries.length === 0) return <span className="text-faint">Not answered</span>;

    return (
      <ul className="space-y-1">
        {entries.map(([rowKey, cells]) => (
          <li key={rowKey} className="flex flex-wrap justify-between gap-x-3 tabular-nums">
            <span className="font-medium">{tableRowLabel(question, table, rowKey)}</span>
            <span className="text-muted">
              {(question.columns ?? [])
                .filter((c) => typeof cells[c.id] === "number")
                .map((c) => `${cells[c.id]} ${c.label}`)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <Badge key={v} tone="brand">
            {optionLabel(question, v)}
          </Badge>
        ))}
      </span>
    );
  }

  if (typeof value === "number") {
    return (
      <span className="font-medium tabular-nums">
        {value}
        {question.unit ? ` ${question.unit}` : ""}
        {question.type === "rating" ? ` / ${question.scale ?? 5}` : ""}
      </span>
    );
  }

  if (question.type === "yes_no") return <span className="font-medium">{value === "yes" ? "Yes" : "No"}</span>;
  if (question.options) return <span className="font-medium">{optionLabel(question, value)}</span>;
  return <span className="whitespace-pre-wrap">{value}</span>;
}
