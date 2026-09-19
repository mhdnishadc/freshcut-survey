import Link from "next/link";
import { redirect } from "next/navigation";

import { SurveyForm } from "@/components/survey/survey-form";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "New interview · FreshCut Survey" };

export default async function SurveyPage() {
  // Checked here as well as in proxy.ts — a page must never rely on the proxy
  // alone for authorization.
  const user = await getUser();
  if (!user) redirect("/login?next=/survey");

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5 sm:px-5">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">New interview</h1>
          <p className="text-[13px] text-muted">Fresh-cut vegetable demand survey</p>
        </div>
        <Link
          href="/dashboard"
          className="shrink-0 rounded-lg px-2.5 py-2 text-sm font-medium text-brand hover:bg-brand-soft"
        >
          Results
        </Link>
      </header>

      <SurveyForm interviewer={user.email ?? "Signed in"} />
    </main>
  );
}
