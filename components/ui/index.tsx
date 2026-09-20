import Link from "next/link";
import type { ComponentProps, ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------

type Variant = "primary" | "secondary" | "brand-soft" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Look = { variant?: Variant; size?: Size; full?: boolean };

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS = {
  primary: "bg-brand text-brand-fg hover:bg-brand-hover",
  secondary: "bg-surface text-foreground border border-border-strong hover:bg-surface-2",
  // A button that reads as an action without competing with the primary one —
  // used for "see what we collected" next to "save this interview".
  "brand-soft": "bg-brand-soft text-brand border border-brand/30 hover:bg-brand hover:text-brand-fg",
  ghost: "text-muted hover:bg-surface-2 hover:text-foreground",
  danger: "bg-danger text-white hover:opacity-90",
} as const;

const BUTTON_SIZES = {
  // sm is for buttons inside a dense desktop table row, never on the survey.
  sm: "min-h-9 px-3 text-[13px]",
  md: "min-h-12 px-4 text-[15px]",
  lg: "min-h-14 px-6 text-base",
} as const;

/**
 * Minimum height is 48px on every variant the field team touches — this is
 * tapped with a thumb while standing in a kitchen, not clicked with a mouse.
 */
export function buttonClass({ variant = "primary", size = "md", full = false }: Look = {}): string {
  return cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], full && "w-full");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Look;

export function Button({ variant, size, full, className, ...props }: ButtonProps) {
  return <button className={cx(buttonClass({ variant, size, full }), className)} {...props} />;
}

/**
 * A navigation that has to look like a button. Staff do not read tinted text as
 * something they can tap, so anything we need them to find is shaped like this.
 */
export function LinkButton({
  variant,
  size,
  full,
  className,
  ...props
}: ComponentProps<typeof Link> & Look) {
  return <Link className={cx(buttonClass({ variant, size, full }), className)} {...props} />;
}

// ---------------------------------------------------------------------------

const fieldBase =
  "w-full rounded-xl border bg-surface px-4 text-foreground placeholder:text-faint " +
  "transition-colors focus:border-brand";

export function Input({
  invalid,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cx(
        fieldBase,
        "min-h-12",
        invalid ? "border-danger" : "border-border-strong",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      rows={3}
      className={cx(
        fieldBase,
        "py-3 leading-relaxed",
        invalid ? "border-danger" : "border-border-strong",
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-card border border-border bg-surface",
        padded && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[15px] font-semibold text-foreground">{children}</h2>
      {hint ? <p className="mt-0.5 text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted border-border",
    brand: "bg-brand-soft text-brand border-transparent",
    warning: "bg-surface-2 text-warning border-border",
    danger: "bg-danger-soft text-danger border-transparent",
  } as const;

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="text-center">
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{body}</p>
    </Card>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {children}
    </p>
  );
}
