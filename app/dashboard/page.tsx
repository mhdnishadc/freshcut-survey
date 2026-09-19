import Link from "next/link";

import { BarList, ChartCard, SplitBar, Stat } from "@/components/dashboard/charts";
import { TrendChart } from "@/components/dashboard/trend";
import { Card, EmptyState } from "@/components/ui";
import {
  byLocality,
  distribution,
  frequency,
  kpis,
  numberStats,
  overTime,
  volumeByLocality,
} from "@/lib/analytics/aggregate";
import { getResponses } from "@/lib/data";
import { num, percent, rupeesShort } from "@/lib/format";
import { KEY_QUESTIONS } from "@/lib/survey/questions";

export const metadata = { title: "Overview · FreshCut Survey" };

// Survey data changes as interviews land; never serve a cached page.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const responses = await getResponses();

  if (responses.length === 0) {
    return (
      <EmptyState
        title="No interviews yet"
        body="Once your field team saves the first hotel interview, the demand numbers and charts will appear here."
      />
    );
  }

  const k = kpis(responses);
  const hours = numberStats(responses, KEY_QUESTIONS.prepHoursPerDay);
  const wastage = numberStats(responses, KEY_QUESTIONS.wastagePercent);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Survey results</h1>
        <p className="mt-1 text-sm text-muted">
          {k.interviews} interview{k.interviews === 1 ? "" : "s"} across {k.hotels} hotel
          {k.hotels === 1 ? "" : "s"} · {k.interviewsThisWeek} in the last 7 days
        </p>
      </header>

      {/* The one number this whole survey exists to find. */}
      <Card className="bg-brand-soft">
        <p className="text-[13px] text-muted">Vegetables these kitchens cut every day</p>
        <p className="mt-1 text-5xl font-semibold tracking-tight">{num(k.dailyVolumeKg, "kg")}</p>
        <p className="mt-1.5 text-[13px] text-muted">
          Combined daily volume across every hotel surveyed — the market we would be supplying.
        </p>
      </Card>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Would buy pre-cut"
          value={percent(k.yesShare)}
          sub={`${percent(k.warmShare)} said yes or maybe`}
        />
        <Stat
          label="Want a free trial"
          value={percent(k.trialShare)}
          sub="Strongest buying signal on the form"
        />
        <Stat
          label="Their monthly veg spend"
          value={rupeesShort(k.monthlyVegSpend)}
          sub="Combined, across all hotels"
        />
        <Stat
          label="Prep wages we'd displace"
          value={rupeesShort(k.monthlyLabourCost)}
          sub="Combined monthly cutting labour"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="How interested are they?"
          hint="Interviewer's own rating, 1 = not interested, 5 = ready to order."
          footnote={`${k.hotHotels} hotel${k.hotHotels === 1 ? "" : "s"} rated 4 or 5.`}
        >
          <BarList
            items={distribution(responses, KEY_QUESTIONS.interestLevel)}
            ordinal
            format={(item) => `${item.count} · ${Math.round(item.share)}%`}
          />
        </ChartCard>

        <ChartCard
          title="Would they buy fresh-cut vegetables?"
          hint="The commercial question. Darker means warmer."
        >
          <SplitBar items={distribution(responses, KEY_QUESTIONS.wouldBuyPrecut)} />
        </ChartCard>

        <ChartCard
          title="Vegetables most in demand"
          hint="Share of kitchens that buy each one in bulk — this is our starting SKU list."
        >
          <BarList
            items={frequency(responses, KEY_QUESTIONS.topVegetables)}
            limit={10}
            format={(item) => `${Math.round(item.share)}%`}
          />
        </ChartCard>

        <ChartCard
          title="What they would pay above raw price"
          hint="Our margin ceiling, straight from the customer."
        >
          <BarList
            items={distribution(responses, KEY_QUESTIONS.pricePremium)}
            ordinal
            format={(item) => `${item.count} · ${Math.round(item.share)}%`}
          />
        </ChartCard>

        <ChartCard
          title="When they want delivery"
          hint="Sets our production shift and cut-off times."
        >
          <BarList items={distribution(responses, KEY_QUESTIONS.deliveryWindow)} />
        </ChartCard>

        <ChartCard
          title="What goes wrong for them today"
          hint="Ranked by how many kitchens raised it. This is the sales script."
        >
          <BarList
            items={frequency(responses, KEY_QUESTIONS.painPoints)}
            format={(item) => `${Math.round(item.share)}%`}
          />
        </ChartCard>

        <ChartCard
          title="Daily volume by area"
          hint="Kilograms per day per locality — the densest area is the first delivery route."
          footnote="A route only pays for itself above roughly 150 kg a day."
        >
          <BarList
            items={volumeByLocality(responses)}
            limit={8}
            format={(item) => `${num(item.count)} kg`}
          />
        </ChartCard>

        <ChartCard
          title="Hotels covered by area"
          hint="Where the survey has been and where it still has gaps."
        >
          <BarList items={byLocality(responses)} limit={8} />
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Interviews per day" hint="Is the survey keeping pace?">
            <TrendChart points={overTime(responses)} />
          </ChartCard>
        </div>

        <ChartCard title="The labour they spend" hint="Per kitchen, per day.">
          <dl className="space-y-3">
            <Line label="Median hours cutting & washing" value={num(hours?.median ?? null, "hrs")} />
            <Line label="Worst case seen" value={num(hours?.max ?? null, "hrs")} />
            <Line label="Median wastage from peeling" value={percent(wastage?.median ?? null)} />
            <Line
              label="Average interest rating"
              value={k.avgInterest === null ? "—" : `${k.avgInterest.toFixed(1)} / 5`}
            />
          </dl>
        </ChartCard>
      </section>

      <Card>
        <p className="text-[13px] text-muted">
          Looking for who to call first?{" "}
          <Link href="/dashboard/leads" className="font-medium text-brand hover:underline">
            Open the leads list
          </Link>{" "}
          — hotels ranked by interest, with one-tap call and WhatsApp.
        </p>
      </Card>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2.5 last:border-0 last:pb-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="shrink-0 text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
