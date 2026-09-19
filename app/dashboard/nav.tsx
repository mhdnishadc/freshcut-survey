"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/components/ui";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/hotels", label: "Hotels" },
  { href: "/dashboard/leads", label: "Leads" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="-mb-px flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          // "/dashboard" must not light up for every nested route.
          const active = tab.href === "/dashboard" ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                active
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
