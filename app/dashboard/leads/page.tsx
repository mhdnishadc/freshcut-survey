import Link from "next/link";

import { Badge, Card, EmptyState } from "@/components/ui";
import { getResponses, latestPerHotel } from "@/lib/data";
import { num, rupeesShort, shortDate, telHref, whatsappHref } from "@/lib/format";
import { KEY_QUESTIONS, optionLabel, QUESTION_BY_ID } from "@/lib/survey/questions";
import type { ResponseWithHotel } from "@/lib/types";

export const metadata = { title: "Leads · FreshCut Survey" };
export const dynamic = "force-dynamic";

/**
 * The call sheet. One row per hotel (its most recent interview), warmest first,
 * with the two numbers that decide who to call — how interested they were and
 * how much volume they represent.
 */
export default async function LeadsPage() {
  const all = await getResponses();
  const latest = latestPerHotel(all);

  const ranked = [...latest].sort((a, b) => {
    const interest = (b.interest_level ?? 0) - (a.interest_level ?? 0);
    if (interest !== 0) return interest;
    return (b.veg_kg_per_day ?? 0) - (a.veg_kg_per_day ?? 0);
  });

  const hot = ranked.filter((r) => (r.interest_level ?? 0) >= 4);
  const warm = ranked.filter((r) => (r.interest_level ?? 0) === 3);
  const cold = ranked.filter((r) => (r.interest_level ?? 0) <= 2);

  const hotVolume = hot.reduce((acc, r) => acc + (r.veg_kg_per_day ?? 0), 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-1 text-sm text-muted">
          Hotels ranked by how interested they were. Call the top of the list first.
        </p>
      </header>

      {ranked.length === 0 ? (
        <EmptyState
          title="No leads yet"
          body="Every completed interview becomes a lead here, sorted by interest."
        />
      ) : (
        <>
          <Card className="bg-brand-soft">
            <p className="text-[13px] text-muted">Ready to order (interest 4–5)</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {hot.length} hotel{hot.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              Worth {num(hotVolume, "kg")} a day between them — enough to plan the first route
              around.
            </p>
          </Card>

          <Group title="Hot — call these first" leads={hot} />
          <Group title="Worth a follow-up" leads={warm} />
          <Group title="Not interested for now" leads={cold} />
        </>
      )}
    </div>
  );
}

function Group({ title, leads }: { title: string; leads: ResponseWithHotel[] }) {
  if (leads.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-[15px] font-semibold">
        {title} <span className="font-normal text-faint">({leads.length})</span>
      </h2>
      <div className="space-y-2">
        {leads.map((lead) => (
          <LeadRow key={lead.id} lead={lead} />
        ))}
      </div>
    </section>
  );
}

function LeadRow({ lead }: { lead: ResponseWithHotel }) {
  const tel = telHref(lead.hotel.phone);
  const wa = whatsappHref(lead.hotel.whatsapp ?? lead.hotel.phone);
  const premium = lead.answers[KEY_QUESTIONS.pricePremium];
  const premiumQuestion = QUESTION_BY_ID.get(KEY_QUESTIONS.pricePremium);
  const trial = lead.answers[KEY_QUESTIONS.wantsTrial] === "yes";
  const spend = lead.answers[KEY_QUESTIONS.monthlyVegSpend];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/dashboard/hotels/${lead.hotel_id}`}
            className="font-medium hover:text-brand hover:underline"
          >
            {lead.hotel.name}
          </Link>
          <p className="text-[13px] text-muted">
            {lead.hotel.contact_person ?? "No contact recorded"}
            {lead.hotel.contact_role
              ? ` (${optionLabel(QUESTION_BY_ID.get("contact_role")!, lead.hotel.contact_role)})`
              : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {trial ? <Badge tone="brand">Wants a trial</Badge> : null}
          <Badge>Interest {lead.interest_level ?? "—"}/5</Badge>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
        <span>
          <strong className="text-foreground tabular-nums">{num(lead.veg_kg_per_day)}</strong>{" "}
          kg/day
        </span>
        {typeof spend === "number" ? <span>{rupeesShort(spend)}/month</span> : null}
        {typeof premium === "string" && premiumQuestion ? (
          <span>Pays {optionLabel(premiumQuestion, premium).toLowerCase()}</span>
        ) : null}
        <span className="text-faint">Surveyed {shortDate(lead.created_at)}</span>
      </div>

      {tel || wa ? (
        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          {tel ? (
            <a
              href={tel}
              className="rounded-lg bg-brand px-3.5 py-2.5 text-sm font-medium text-brand-fg hover:bg-brand-hover"
            >
              Call {lead.hotel.phone}
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
        </div>
      ) : null}
    </Card>
  );
}
