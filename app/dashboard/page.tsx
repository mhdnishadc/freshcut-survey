import Link from "next/link";

import { BarList, ChartCard, SplitBar, Stat } from "@/components/dashboard/charts";
import { TrendChart } from "@/components/dashboard/trend";
import { Card, EmptyState } from "@/components/ui";
import { VegetableTable } from "@/components/dashboard/vegetable-table";
import {
  distribution,
  frequency,
  kpis,
  overTime,
  vegetableDemand,
  volumeByVegetable,
} from "@/lib/analytics/aggregate";
import { getResponses } from "@/lib/data";
import { num, percent } from "@/lib/format";
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
        body="Once your field team saves the first interview, the demand numbers and charts will appear here."
      />
    );
  }

  const k = kpis(responses);
  const demand = vegetableDemand(responses);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Survey results</h1>
        <p className="mt-1 text-sm text-muted">
          {k.interviews} interview{k.interviews === 1 ? "" : "s"} across {k.hotels} business
          {k.hotels === 1 ? "" : "es"} · {k.interviewsThisWeek} in the last 7 days
        </p>
      </header>

      {/* The one number this whole survey exists to find. */}
      <Card className="bg-brand-soft">
        <p className="text-[13px] text-muted">Vegetables these kitchens cut every day</p>
        <p className="mt-1 text-5xl font-semibold tracking-tight">{num(k.dailyVolumeKg, "kg")}</p>
        <p className="mt-1.5 text-[13px] text-muted">
          Combined daily volume across every business surveyed — the market we would be supplying.
        </p>
      </Card>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Would try us"
          value={percent(k.yesShare)}
          sub={`${percent(k.warmShare)} said yes or maybe`}
        />
        <Stat
          label="Ready for a trial"
          value={`${k.hotHotels}`}
          sub={k.hotHotels === 1 ? "business said a plain yes" : "businesses said a plain yes"}
        />
        <Stat
          label="Their daily volume"
          value={num(k.hotVolumeKg, "kg")}
          sub="Just the yeses — the first delivery route"
        />
        <Stat
          label="Interviews this week"
          value={`${k.interviewsThisWeek}`}
          sub={`${k.interviews} in total`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Would they try our products?"
          hint="Question 13 — the commercial question. Darker means warmer."
        >
          <SplitBar items={distribution(responses, KEY_QUESTIONS.wouldBuyPrecut)} />
        </ChartCard>

        <ChartCard
          title="Which vegetables they want pre-cut"
          hint="Share of kitchens asking for each one — this is our starting SKU list."
        >
          <BarList
            items={frequency(responses, KEY_QUESTIONS.precutWanted)}
            limit={10}
            format={(item) => `${Math.round(item.share)}%`}
          />
        </ChartCard>

        <ChartCard
          title="Why they would buy pre-cut"
          hint="Question 10 — the main reason, in their own order. This is the advertising line."
        >
          <BarList
            items={distribution(responses, KEY_QUESTIONS.precutMainReason)}
            format={(item) => `${item.count} · ${Math.round(item.share)}%`}
          />
        </ChartCard>

        <ChartCard
          title="What goes wrong with their supplier today"
          hint="Question 6, ranked by how many kitchens raised it. This is the sales script."
        >
          <BarList
            items={frequency(responses, KEY_QUESTIONS.supplierProblems)}
            format={(item) => `${Math.round(item.share)}%`}
          />
        </ChartCard>

        <ChartCard
          title="How much could switch to pre-cut"
          hint="Question 11 — multiply this by their daily volume to size the opportunity."
        >
          <BarList
            items={distribution(responses, KEY_QUESTIONS.replaceablePercent)}
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
      </section>

      <ChartCard
        title="Daily volume by vegetable"
        hint="Kilograms a day across every kitchen surveyed — build the cutting line in this order."
      >
        <BarList
          items={volumeByVegetable(responses)}
          limit={12}
          format={(item) => `${num(item.count)} kg`}
        />
      </ChartCard>

      <ChartCard
        title="The order book, vegetable by vegetable"
        hint="What they get through, and how many of them asked for it pre-cut."
        footnote="Build the first cutting line down this list, top to bottom."
      >
        <VegetableTable rows={demand} />
      </ChartCard>

      <ChartCard title="Interviews per day" hint="Is the survey keeping pace?">
        <TrendChart points={overTime(responses)} />
      </ChartCard>

      <Card>
        <p className="text-[13px] text-muted">
          Looking for who to call first?{" "}
          <Link href="/dashboard/leads" className="font-medium text-brand hover:underline">
            Open the leads list
          </Link>{" "}
          — businesses ranked by their answer to question 13, with one-tap call and WhatsApp.
        </p>
      </Card>
    </div>
  );
}
