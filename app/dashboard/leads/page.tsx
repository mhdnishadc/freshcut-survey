import Link from "next/link";

import { Badge, Card, EmptyState } from "@/components/ui";
import { getResponses, latestPerHotel } from "@/lib/data";
import { num, shortDate, telHref, whatsappHref } from "@/lib/format";
import { KEY_QUESTIONS, optionLabel, QUESTION_BY_ID } from "@/lib/survey/questions";
import type { ResponseWithHotel } from "@/lib/types";

export const metadata = { title: "Leads · FreshCut Survey" };
export const dynamic = "force-dynamic";

/** Question 13's three answers, warmest first. Anything else sorts last. */
const RANK: Record<string, number> = { yes: 3, maybe: 2, no: 1 };

function answerOf(lead: ResponseWithHotel): string | null {
  const value = lead.answers[KEY_QUESTIONS.wouldBuyPrecut];
  return typeof value === "string" ? value : null;
}

/**
 * The call sheet. One row per business (its most recent interview), warmest
 * first, ranked on the only commitment the form actually asks for — question
 * 13, "would you try our products?" — and then on the volume behind it.
 */
export default async function LeadsPage() {
  const all = await getResponses();
  const latest = latestPerHotel(all);

  const ranked = [...latest].sort((a, b) => {
    const byAnswer = (RANK[answerOf(b) ?? ""] ?? 0) - (RANK[answerOf(a) ?? ""] ?? 0);
    if (byAnswer !== 0) return byAnswer;
    return (b.veg_kg_per_day ?? 0) - (a.veg_kg_per_day ?? 0);
  });

  const hot = ranked.filter((r) => answerOf(r) === "yes");
  const warm = ranked.filter((r) => answerOf(r) === "maybe");
  const cold = ranked.filter((r) => {
    const answer = answerOf(r);
    return answer === "no" || answer === null;
  });

  const hotVolume = hot.reduce((acc, r) => acc + (r.veg_kg_per_day ?? 0), 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-1 text-sm text-muted">
          Businesses ranked by whether they said they would try us. Call the top of the list
          first.
        </p>
      </header>

      {ranked.length === 0 ? (
        <EmptyState
          title="No leads yet"
          body="Every completed interview becomes a lead here, warmest first."
        />
      ) : (
        <>
          <Card className="bg-brand-soft">
            <p className="text-[13px] text-muted">Said yes to trying us</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {hot.length} business{hot.length === 1 ? "" : "es"}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              Worth {num(hotVolume, "kg")} a day between them — enough to plan the first route
              around.
            </p>
          </Card>

          <Group title="Yes — call these first" leads={hot} />
          <Group title="Maybe — worth a follow-up" leads={warm} />
          <Group title="No, or did not answer" leads={cold} />
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

  const answer = answerOf(lead);
  const buyQuestion = QUESTION_BY_ID.get(KEY_QUESTIONS.wouldBuyPrecut);

  // The trial brief, straight off question 13's "If YES" block.
  const trialVeg = lead.answers.trial_vegetable;
  const trialQty = lead.answers.trial_quantity_kg;
  const trialQuestion = QUESTION_BY_ID.get("trial_vegetable");

  const share = lead.answers[KEY_QUESTIONS.replaceablePercent];
  const shareQuestion = QUESTION_BY_ID.get(KEY_QUESTIONS.replaceablePercent);

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
            {[lead.hotel.contact_person, lead.hotel.location].filter(Boolean).join(" · ") ||
              "No contact recorded"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {answer && buyQuestion ? (
            <Badge tone={answer === "yes" ? "brand" : answer === "maybe" ? "warning" : "neutral"}>
              {optionLabel(buyQuestion, answer)}
            </Badge>
          ) : (
            <Badge>Not answered</Badge>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
        <span>
          <strong className="text-foreground tabular-nums">{num(lead.veg_kg_per_day)}</strong>{" "}
          kg/day
        </span>
        {typeof share === "string" && shareQuestion ? (
          <span>{optionLabel(shareQuestion, share)} could be pre-cut</span>
        ) : null}
        {typeof trialVeg === "string" && trialQuestion ? (
          <span className="text-brand">
            Trial: {optionLabel(trialQuestion, trialVeg)}
            {typeof trialQty === "number" ? `, ${trialQty} kg` : ""}
          </span>
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
