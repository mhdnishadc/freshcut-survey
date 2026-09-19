/** Display helpers. Everything is Indian-locale: ₹, lakh/crore, dd Mon yyyy. */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

export function rupees(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return INR.format(value);
}

/** Compact rupees for stat tiles: ₹1.2L, ₹3.4Cr. */
export function rupeesShort(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1e7) return `₹${NUM.format(value / 1e7)}Cr`;
  if (Math.abs(value) >= 1e5) return `₹${NUM.format(value / 1e5)}L`;
  if (Math.abs(value) >= 1e3) return `₹${NUM.format(value / 1e3)}K`;
  return INR.format(value);
}

export function num(value: number | null | undefined, unit?: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return unit ? `${NUM.format(value)} ${unit}` : NUM.format(value);
}

export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return shortDate(iso);
}

/** Turns a stored option value back into something readable if no label exists. */
export function humanise(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Digits only, last 10 — what we store and what `tel:` / wa.me links need. */
export function phoneDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export function telHref(raw: string | null | undefined): string | null {
  const digits = phoneDigits(raw);
  return digits ? `tel:+91${digits}` : null;
}

export function whatsappHref(raw: string | null | undefined): string | null {
  const digits = phoneDigits(raw);
  return digits ? `https://wa.me/91${digits}` : null;
}
