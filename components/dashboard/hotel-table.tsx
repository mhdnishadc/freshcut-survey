"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge, Button, Card, EmptyState, Input, LinkButton, buttonClass, cx } from "@/components/ui";
import { responsesToCsv } from "@/lib/csv";
import { num, relativeDate, telHref, whatsappHref } from "@/lib/format";
import { KEY_QUESTIONS, optionLabel, QUESTION_BY_ID } from "@/lib/survey/questions";
import type { ResponseWithHotel } from "@/lib/types";

type SortKey = "recent" | "interest" | "volume" | "name";

export function HotelTable({ responses }: { responses: ResponseWithHotel[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const kinds = useMemo(() => {
    const set = new Set(responses.map((r) => r.hotel.hotel_type).filter(Boolean) as string[]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [responses]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = responses.filter((response) => {
      if (kind !== "all" && response.hotel.hotel_type !== kind) return false;
      if (!needle) return true;
      return [response.hotel.name, response.hotel.contact_person, response.hotel.phone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });

    // Sorted copy — never mutate the props array.
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "interest":
          return (b.interest_level ?? -1) - (a.interest_level ?? -1);
        case "volume":
          return (b.veg_kg_per_day ?? -1) - (a.veg_kg_per_day ?? -1);
        case "name":
          return a.hotel.name.localeCompare(b.hotel.name);
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
  }, [responses, query, kind, sort]);

  function downloadCsv() {
    const csv = responsesToCsv(rows);
    // The BOM makes Excel open UTF-8 (₹, Malayalam names) correctly.
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `freshcut-survey-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Filters sit in one row above the data, never between charts. */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          placeholder="Search hotel, contact or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-52 flex-1"
          aria-label="Search hotels"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label="Filter by kitchen type"
          className="min-h-12 rounded-xl border border-border-strong bg-surface px-3 text-[15px]"
        >
          <option value="all">All kitchen types</option>
          {kinds.map((item) => (
            <option key={item} value={item}>
              {labelOf("hotel_type", item)}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort by"
          className="min-h-12 rounded-xl border border-border-strong bg-surface px-3 text-[15px]"
        >
          <option value="recent">Most recent</option>
          <option value="interest">Most interested</option>
          <option value="volume">Biggest volume</option>
          <option value="name">Name A–Z</option>
        </select>
        {/* Full width on a phone, where it was previously squeezed to a stub. */}
        <Button
          variant="secondary"
          onClick={downloadCsv}
          disabled={rows.length === 0}
          className="w-full sm:w-auto"
        >
          <span aria-hidden>⬇</span>
          Export {rows.length === responses.length ? "all" : rows.length} to CSV
        </Button>
      </div>

      <p className="text-[13px] text-muted">
        Showing {rows.length} of {responses.length} interview{responses.length === 1 ? "" : "s"} ·
        tap a hotel to see everything that was collected
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          body="Try a different kitchen type or clear the search box."
        />
      ) : (
        <>
          {/* Cards on a phone, a real table from md up. */}
          <div className="space-y-2 md:hidden">
            {rows.map((response) => (
              <HotelCard key={response.id} response={response} />
            ))}
          </div>

          <Card padded={false} className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-[13px] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Hotel</th>
                  <th scope="col" className="px-4 py-3 font-medium">Contact</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">kg/day</th>
                  <th scope="col" className="px-4 py-3 font-medium">Would buy</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Interest</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Surveyed</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Collected information</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((response) => (
                  <tr key={response.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/hotels/${response.hotel_id}`}
                        className="font-medium hover:text-brand hover:underline"
                      >
                        {response.hotel.name}
                      </Link>
                      {response.hotel.hotel_type ? (
                        <p className="text-[12px] text-faint">
                          {labelOf("hotel_type", response.hotel.hotel_type)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p>{response.hotel.contact_person ?? "—"}</p>
                      <ContactLinks response={response} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {num(response.veg_kg_per_day)}
                    </td>
                    <td className="px-4 py-3">
                      <BuyBadge response={response} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {response.interest_level ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] whitespace-nowrap text-muted">
                      {relativeDate(response.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <LinkButton
                        href={`/dashboard/hotels/${response.hotel_id}`}
                        variant="secondary"
                        size="sm"
                        className="whitespace-nowrap"
                        aria-label={`View collected information for ${response.hotel.name}`}
                      >
                        View info
                      </LinkButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function HotelCard({ response }: { response: ResponseWithHotel }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/dashboard/hotels/${response.hotel_id}`}
            className="font-medium hover:text-brand hover:underline"
          >
            {response.hotel.name}
          </Link>
          <p className="text-[13px] text-muted">
            {response.hotel.contact_person ??
              (response.hotel.hotel_type
                ? labelOf("hotel_type", response.hotel.hotel_type)
                : "No contact recorded")}
          </p>
        </div>
        <BuyBadge response={response} />
      </div>

      <div className="mt-3 flex items-center gap-4 text-[13px] text-muted">
        <span>
          <strong className="text-foreground tabular-nums">{num(response.veg_kg_per_day)}</strong>{" "}
          kg/day
        </span>
        <span>
          Interest{" "}
          <strong className="text-foreground tabular-nums">
            {response.interest_level ?? "—"}
          </strong>
        </span>
        <span className="ml-auto text-faint">{relativeDate(response.created_at)}</span>
      </div>

      {/*
        On a phone the hotel name alone was the only way in and nobody read it
        as tappable, so the card ends in a labelled button that says what it
        opens. Call and WhatsApp sit beside it as buttons too, not tinted words.
      */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <LinkButton
          href={`/dashboard/hotels/${response.hotel_id}`}
          variant="brand-soft"
          // min-w-40 makes it claim its own line on a narrow phone instead of
          // shrinking to an unreadable stub beside Call and WhatsApp.
          className="min-h-11 min-w-40 flex-1 text-sm"
          aria-label={`View collected information for ${response.hotel.name}`}
        >
          View collected info
        </LinkButton>
        <ContactLinks response={response} as="button" />
      </div>
    </Card>
  );
}

function ContactLinks({
  response,
  as = "text",
}: {
  response: ResponseWithHotel;
  as?: "text" | "button";
}) {
  const tel = telHref(response.hotel.phone);
  const wa = whatsappHref(response.hotel.whatsapp ?? response.hotel.phone);
  if (!tel && !wa) return null;

  const linkClass =
    as === "button"
      ? cx(buttonClass({ variant: "secondary", size: "sm" }), "min-h-11 text-sm")
      : "font-medium text-brand hover:underline";

  return (
    <span className={as === "button" ? "flex gap-2" : "flex gap-3 text-[13px]"}>
      {tel ? (
        <a href={tel} className={linkClass}>
          Call
        </a>
      ) : null}
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={linkClass}>
          WhatsApp
        </a>
      ) : null}
    </span>
  );
}

function BuyBadge({ response }: { response: ResponseWithHotel }) {
  const value = response.answers[KEY_QUESTIONS.wouldBuyPrecut];
  if (typeof value !== "string") return <span className="text-faint">—</span>;

  const tone =
    value === "definitely" || value === "probably"
      ? "brand"
      : value === "maybe"
        ? "warning"
        : "neutral";
  return (
    <Badge tone={tone}>{labelOf(KEY_QUESTIONS.wouldBuyPrecut, value)}</Badge>
  );
}

function labelOf(questionId: string, value: string): string {
  const question = QUESTION_BY_ID.get(questionId);
  return question ? optionLabel(question, value) : value;
}
