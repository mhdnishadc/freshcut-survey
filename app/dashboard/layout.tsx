import Link from "next/link";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/supabase/server";

import { DashboardNav } from "./nav";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await getUser();
  if (!user) redirect("/login?next=/dashboard");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <span aria-hidden>🥬</span>
            <span>FreshCut</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/survey"
              className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover"
            >
              New interview
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <DashboardNav />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
