"use client";

import { Input, Textarea, cx } from "@/components/ui";
import type { AnswerValue, Question } from "@/lib/survey/questions";

type Props = {
  question: Question;
  value: AnswerValue | undefined;
  error?: string;
  onChange: (value: AnswerValue) => void;
};

/**
 * Renders one question from the config. Every control here is at least 48px
 * tall and tappable without zooming — selects are rendered as buttons rather
 * than a native <select>, because picking from a dropdown one-handed while
 * talking to a chef is slow and error-prone.
 */
export function QuestionField({ question, value, error, onChange }: Props) {
  const describedBy = [
    question.help ? `${question.id}-help` : null,
    error ? `${question.id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="py-4 first:pt-0">
      <label
        htmlFor={question.id}
        className="block text-[15px] leading-snug font-medium text-foreground"
      >
        {question.label}
        {question.required ? <span className="ml-1 text-danger">*</span> : null}
      </label>

      {question.help ? (
        <p id={`${question.id}-help`} className="mt-1 text-[13px] leading-snug text-muted">
          {question.help}
        </p>
      ) : null}

      <div className="mt-2.5">
        <Control
          question={question}
          value={value}
          onChange={onChange}
          invalid={Boolean(error)}
          describedBy={describedBy || undefined}
        />
      </div>

      {error ? (
        <p id={`${question.id}-error`} role="alert" className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Control({
  question,
  value,
  onChange,
  invalid,
  describedBy,
}: Props & { invalid: boolean; describedBy?: string }) {
  switch (question.type) {
    case "short_text":
      return (
        <Input
          id={question.id}
          invalid={invalid}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          inputMode={question.format === "phone" || question.format === "pincode" ? "numeric" : "text"}
          placeholder={question.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "long_text":
      return (
        <Textarea
          id={question.id}
          invalid={invalid}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          placeholder={question.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
      return <NumberControl {...{ question, value, onChange, invalid, describedBy }} />;

    case "yes_no":
      return (
        <ChoiceGroup
          name={question.id}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          selected={typeof value === "string" ? [value] : []}
          onToggle={(v) => onChange(v)}
          columns={2}
          describedBy={describedBy}
        />
      );

    case "single_select":
      return (
        <ChoiceGroup
          name={question.id}
          options={question.options ?? []}
          selected={typeof value === "string" ? [value] : []}
          onToggle={(v) => onChange(value === v ? null : v)}
          describedBy={describedBy}
        />
      );

    case "multi_select": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <ChoiceGroup
          name={question.id}
          multi
          options={question.options ?? []}
          selected={selected}
          onToggle={(v) =>
            onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v])
          }
          describedBy={describedBy}
        />
      );
    }

    case "rating":
      return (
        <RatingControl
          question={question}
          value={typeof value === "number" ? value : null}
          onChange={onChange}
          describedBy={describedBy}
        />
      );
  }
}

// ---------------------------------------------------------------------------

/**
 * Number fields keep their raw text while being typed so that a half-entered
 * "1." or a cleared field behaves normally; the parsed number is what leaves
 * this component.
 */
function NumberControl({
  question,
  value,
  onChange,
  invalid,
  describedBy,
}: Props & { invalid: boolean; describedBy?: string }) {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : "";

  return (
    <div className="relative">
      <Input
        id={question.id}
        type="text"
        invalid={invalid}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        inputMode={question.decimal ? "decimal" : "numeric"}
        placeholder={question.placeholder ?? "0"}
        className={question.unit ? "pr-16" : undefined}
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(question.decimal ? /[^\d.]/g : /[^\d]/g, "");
          if (raw === "") {
            onChange(null);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : null);
        }}
      />
      {question.unit ? (
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-faint">
          {question.unit}
        </span>
      ) : null}
    </div>
  );
}

function ChoiceGroup({
  name,
  options,
  selected,
  onToggle,
  multi = false,
  columns = 1,
  describedBy,
}: {
  name: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  multi?: boolean;
  columns?: 1 | 2;
  describedBy?: string;
}) {
  return (
    <div
      role={multi ? "group" : "radiogroup"}
      aria-labelledby={name}
      aria-describedby={describedBy}
      className={cx("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-1")}
    >
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={isSelected}
            onClick={() => onToggle(option.value)}
            className={cx(
              "flex min-h-12 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[15px] transition-colors",
              isSelected
                ? "border-brand bg-brand-soft font-medium text-foreground"
                : "border-border-strong bg-surface text-foreground hover:bg-surface-2",
            )}
          >
            <span
              aria-hidden
              className={cx(
                "flex size-5 shrink-0 items-center justify-center border-2 transition-colors",
                multi ? "rounded-md" : "rounded-full",
                isSelected ? "border-brand bg-brand text-brand-fg" : "border-border-strong",
              )}
            >
              {isSelected ? (
                <svg viewBox="0 0 12 12" className="size-3 fill-none stroke-current stroke-2">
                  <path d="M2 6.5L4.5 9L10 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </span>
            <span className="leading-snug">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function RatingControl({
  question,
  value,
  onChange,
  describedBy,
}: {
  question: Question;
  value: number | null;
  onChange: (value: AnswerValue) => void;
  describedBy?: string;
}) {
  const scale = question.scale ?? 5;

  return (
    <div role="radiogroup" aria-describedby={describedBy} className="flex gap-2">
      {Array.from({ length: scale }, (_, i) => i + 1).map((n) => {
        const isSelected = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${n} out of ${scale}`}
            onClick={() => onChange(isSelected ? null : n)}
            className={cx(
              "flex h-13 flex-1 items-center justify-center rounded-xl border text-base font-semibold transition-colors",
              isSelected
                ? "border-brand bg-brand text-brand-fg"
                : "border-border-strong bg-surface text-muted hover:bg-surface-2",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
