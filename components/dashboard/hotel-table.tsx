"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge, Button, Card, EmptyState, Input } from "@/components/ui";
import { responsesToCsv } from "@/lib/csv";
import { num, relativeDate, telHref, whatsappHref } from "@/lib/format";
import { KEY_QUESTIONS, optionLabel, QUESTION_BY_ID } from "@/lib/survey/questions";
import type { ResponseWithHotel } from "@/lib/types";

type SortKey = "recent" | "interest" | "volume" | "name";

export function HotelTable({ responses }: { responses: ResponseWithHotel[] }) {
  const [query, setQuery] = useState("");
  const [locality, setLocality] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const localities = useMemo(() => {
    const set = new Set(responses.map((r) => r.hotel.locality?.trim()).filter(Boolean) as string[]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [responses]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = responses.filter((response) => {
      if (locality !== "all" && response.hotel.locality?.trim() !== locality) return false;
      if (!needle) return true;
      return [
        response.hotel.name,
        response.hotel.locality,
        response.hotel.contact_person,
        response.hotel.phone,
      ]
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
  }, [responses, query, locality, sort]);

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
          placeholder="Search hotel, area, contact or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-52 flex-1"
          aria-label="Search hotels"
        />
        <select
          value={locality}
          onChange={(e) => setLocality(e.target.value)}
          aria-label="Filter by area"
          className="min-h-12 rounded-xl border border-border-strong bg-surface px-3 text-[15px]"
        >
          <option value="all">All areas</option>
          {localities.map((item) => (
            <option key={item} value={item}>
              {item}
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
        <Button variant="secondary" onClick={downloadCsv} disabled={rows.length === 0}>
          Export CSV
        </Button>
      </div>

      <p className="text-[13px] text-muted">
        {rows.length} of {responses.length} interview{responses.length === 1 ? "" : "s"}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          body="Try a different area or clear the search box."
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
                  <th scope="col" className="px-4 py-3 font-medium">Area</th>
                  <th scope="col" className="px-4 py-3 font-medium">Contact</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">kg/day</th>
                  <th scope="col" className="px-4 py-3 font-medium">Would buy</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Interest</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Surveyed</th>
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
                    <td className="px-4 py-3 text-muted">{response.hotel.locality ?? "—"}</td>
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
            {response.hotel.locality ?? "Area not recorded"}
            {response.hotel.contact_person ? ` · ${response.hotel.contact_person}` : ""}
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

      <div className="mt-3">
        <ContactLinks response={response} />
      </div>
    </Card>
  );
}

function ContactLinks({ response }: { response: ResponseWithHotel }) {
  const tel = telHref(response.hotel.phone);
  const wa = whatsappHref(response.hotel.whatsapp ?? response.hotel.phone);
  if (!tel && !wa) return null;

  return (
    <span className="flex gap-3 text-[13px]">
      {tel ? (
        <a href={tel} className="font-medium text-brand hover:underline">
          Call
        </a>
      ) : null}
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand hover:underline"
        >
          WhatsApp
        </a>
      ) : null}
    </span>
  );
}

function BuyBadge({ response }: { response: ResponseWithHotel }) {
  const value = response.answers[KEY_QUESTIONS.wouldBuyPrecut];
  if (typeof value !== "string") return <span className="text-faint">—</span>;

  const tone = value === "yes" ? "brand" : value === "maybe" ? "warning" : "neutral";
  return (
    <Badge tone={tone}>{labelOf(KEY_QUESTIONS.wouldBuyPrecut, value)}</Badge>
  );
}

function labelOf(questionId: string, value: string): string {
  const question = QUESTION_BY_ID.get(questionId);
  return question ? optionLabel(question, value) : value;
}
