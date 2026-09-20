import { redirect } from "next/navigation";

import { SurveyForm } from "@/components/survey/survey-form";
import { LinkButton } from "@/components/ui";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "New interview · FreshCut Survey" };

export default async function SurveyPage() {
  // Checked here as well as in proxy.ts — a page must never rely on the proxy
  // alone for authorization.
  const user = await getUser();
  if (!user) redirect("/login?next=/survey");

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5 sm:px-5">
      <header className="mb-5 space-y-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">New interview</h1>
          <p className="text-[13px] text-muted">Fresh-cut vegetable demand survey</p>
        </div>
        {/*
          This used to be a small tinted "Results" word in the corner and the
          field team never found it. It is now a full-width labelled button that
          says what is behind it, and it lands on the hotel list — the interviews
          they saved — not on the charts.
        */}
        <LinkButton href="/dashboard/hotels" variant="brand-soft" full>
          <span aria-hidden>📋</span>
          View collected hotels
        </LinkButton>
      </header>

      <SurveyForm interviewer={user.email ?? "Signed in"} />
    </main>
  );
}
