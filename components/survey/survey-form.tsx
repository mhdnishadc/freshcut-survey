"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Badge, Button, Card, ErrorNote, cx } from "@/components/ui";
import { submitSurvey } from "@/app/survey/actions";
import {
  SECTIONS,
  asTableValue,
  isTableValue,
  isVisible,
  optionLabel,
  tableHasContent,
  tableRowLabel,
  type AnswerValue,
} from "@/lib/survey/questions";
import { collectErrors, emptyValues, pruneHidden, type SurveyValues } from "@/lib/survey/schema";
import {
  clearDraft,
  dequeue,
  draftHasContent,
  enqueue,
  getServerStorageSnapshot,
  getStorageSnapshot,
  saveDraft,
  subscribeToStorage,
} from "@/lib/survey/draft";

import { QuestionField } from "./question-field";

type Coords = { latitude: number; longitude: number } | null;
type Stage = "form" | "review" | "done";

export function SurveyForm({ interviewer }: { interviewer: string }) {
  const [values, setValues] = useState<SurveyValues>(emptyValues);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("form");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords>(null);
  const [busy, setBusy] = useState(false);
  const [savedName, setSavedName] = useState("");
  // True once the interviewer has typed something, which retires the
  // "unfinished interview" offer and lets autosave overwrite the old draft.
  const [started, setStarted] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);
  const section = SECTIONS[sectionIndex];

  const visibleQuestions = useMemo(
    () => section.questions.filter((q) => isVisible(q, values)),
    [section, values],
  );

  // localStorage read as an external store, so the server render has a defined
  // empty snapshot and there is no hydration mismatch.
  const stored = useSyncExternalStore(
    subscribeToStorage,
    getStorageSnapshot,
    getServerStorageSnapshot,
  );
  const queuedCount = stored.queue.length;
  const restorable =
    !started && stage === "form" && stored.draft && draftHasContent(stored.draft)
      ? stored.draft
      : null;

  // Autosave on every change, so a dropped call or a dead battery costs
  // nothing. Held back until the interviewer actually starts, so an untouched
  // form cannot wipe a draft they have not been offered yet.
  useEffect(() => {
    if (stage === "done" || !started) return;
    saveDraft(values, sectionIndex);
  }, [values, sectionIndex, stage, started]);

  const setAnswer = useCallback((questionId: string, value: AnswerValue) => {
    setStarted(true);
    setValues((prev) => ({ ...prev, [questionId]: value }));
    setErrors((prev) => {
      if (!(questionId in prev)) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }, []);

  function scrollToTop() {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // -- navigation ----------------------------------------------------------

  /**
   * Moving on never blocks on a blank answer — only on an answer that is
   * actually wrong (a 6-digit phone number, 4000 kg of garlic). A half-finished
   * interview saved is worth more to us than a complete one abandoned, so the
   * only thing that can ever stop this form is a value we could not store.
   */
  function goNext() {
    const sectionErrors = collectErrors(values, section.questions);
    if (Object.keys(sectionErrors).length > 0) {
      setErrors(sectionErrors);
      setFormError("Fix the highlighted answers — the rest can stay blank.");
      scrollToTop();
      return;
    }

    setErrors({});
    setFormError(null);

    if (sectionIndex < SECTIONS.length - 1) {
      setSectionIndex((i) => i + 1);
    } else {
      setStage("review");
    }
    scrollToTop();
  }

  function goBack() {
    setFormError(null);
    if (stage === "review") {
      setStage("form");
    } else if (sectionIndex > 0) {
      setSectionIndex((i) => i - 1);
    }
    scrollToTop();
  }

  function jumpToSection(index: number) {
    setStage("form");
    setSectionIndex(index);
    setErrors({});
    setFormError(null);
    scrollToTop();
  }

  // -- GPS -----------------------------------------------------------------

  function captureLocation() {
    if (!("geolocation" in navigator)) {
      setFormError("This phone does not support location capture.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => setFormError("Could not read the location. Check location permission."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  // -- submit --------------------------------------------------------------

  async function onSubmit() {
    const allErrors = collectErrors(values, SECTIONS.flatMap((s) => s.questions));
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      // Send them to the first section that actually has a problem.
      const firstBad = SECTIONS.findIndex((s) => s.questions.some((q) => q.id in allErrors));
      setStage("form");
      setSectionIndex(Math.max(0, firstBad));
      setFormError("One answer cannot be saved as it stands. It is highlighted below.");
      scrollToTop();
      return;
    }

    setBusy(true);
    setFormError(null);

    const payload = pruneHidden(values);
    const name = typeof payload.hotel_name === "string" ? payload.hotel_name : "this hotel";

    try {
      const result = await submitSurvey({ values: payload, coords });

      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        setFormError(result.error);
        setBusy(false);
        return;
      }

      finish(result.hotelName);
    } catch {
      // Network died mid-submit. Keep the interview rather than lose it, and
      // let the interviewer walk to the next hotel.
      enqueue(payload, coords);
      finish(name);
    }
  }

  function finish(name: string) {
    clearDraft();
    setSavedName(name);
    setStage("done");
    setBusy(false);
    scrollToTop();
  }

  function startNext() {
    setValues(emptyValues());
    setSectionIndex(0);
    setErrors({});
    setFormError(null);
    setCoords(null);
    setStage("form");
    setStarted(false);
    clearDraft();
    scrollToTop();
  }

  // -- offline queue flush -------------------------------------------------

  // Writes only to localStorage, which notifies the store above — no setState
  // here, so this is safe to fire straight from an effect.
  const flushQueue = useCallback(async () => {
    for (const item of getStorageSnapshot().queue) {
      try {
        const result = await submitSurvey({ values: item.values, coords: item.coords });
        // A payload the server rejects will never succeed on retry — drop it
        // rather than retrying forever.
        if (result.ok || result.fieldErrors) dequeue(item.id);
      } catch {
        break; // Still offline; try again on the next reconnect.
      }
    }
  }, []);

  useEffect(() => {
    void flushQueue();
    window.addEventListener("online", flushQueue);
    return () => window.removeEventListener("online", flushQueue);
  }, [flushQueue]);

  // -- render --------------------------------------------------------------

  if (stage === "done") {
    return (
      <div ref={topRef} className="space-y-4">
        <Card className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-brand-soft text-3xl">
            ✓
          </div>
          <h2 className="text-lg font-semibold">Interview saved</h2>
          <p className="mt-1 text-sm text-muted">
            {savedName} has been recorded{queuedCount > 0 ? " and will upload when you reconnect" : ""}.
          </p>
          <div className="mt-5 space-y-2">
            <Button size="lg" full onClick={startNext}>
              Start next hotel
            </Button>
            <Link href="/dashboard" className="block">
              <Button variant="secondary" size="lg" full>
                See the results
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div ref={topRef} className="space-y-4">
      {restorable ? (
        <Card className="border-brand bg-brand-soft">
          <p className="text-sm font-medium">Unfinished interview found</p>
          <p className="mt-0.5 text-[13px] text-muted">
            Saved {new Date(restorable.savedAt).toLocaleString("en-IN")}.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() => {
                setValues({ ...emptyValues(), ...restorable.values });
                setSectionIndex(Math.min(restorable.sectionIndex, SECTIONS.length - 1));
                setStarted(true);
              }}
            >
              Continue it
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                clearDraft();
                setStarted(true);
              }}
            >
              Discard
            </Button>
          </div>
        </Card>
      ) : null}

      {queuedCount > 0 ? (
        <Card className="border-warning">
          <p className="text-[13px] text-foreground">
            <strong>{queuedCount}</strong> interview{queuedCount === 1 ? "" : "s"} waiting to
            upload. They will go up automatically once you have signal.
          </p>
        </Card>
      ) : null}

      <Progress
        current={stage === "review" ? SECTIONS.length : sectionIndex}
        total={SECTIONS.length}
        interviewer={interviewer}
      />

      {stage === "review" ? (
        <ReviewStage values={values} coords={coords} onEdit={jumpToSection} />
      ) : (
        <Card>
          <div className="mb-1">
            <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
            {section.description ? (
              <p className="mt-1 text-[13px] text-muted">{section.description}</p>
            ) : null}
          </div>

          <div className="divide-y divide-border">
            {visibleQuestions.map((question) => (
              <QuestionField
                key={question.id}
                question={question}
                value={values[question.id]}
                error={errors[question.id]}
                onChange={(value) => setAnswer(question.id, value)}
              />
            ))}
          </div>

          {section.id === "hotel" ? (
            <div className="mt-4 border-t border-border pt-4">
              <Button variant="secondary" full onClick={captureLocation}>
                {coords ? "📍 Location captured — tap to redo" : "📍 Capture GPS location"}
              </Button>
              <p className="mt-1.5 text-[12px] text-faint">
                Optional, but it makes delivery-route planning much easier later.
              </p>
            </div>
          ) : null}
        </Card>
      )}

      {formError ? <ErrorNote>{formError}</ErrorNote> : null}

      <div className="flex gap-2 pb-8">
        {sectionIndex > 0 || stage === "review" ? (
          <Button variant="secondary" size="lg" onClick={goBack} disabled={busy}>
            Back
          </Button>
        ) : null}

        {stage === "review" ? (
          <Button size="lg" full onClick={onSubmit} disabled={busy}>
            {busy ? "Saving…" : "Submit interview"}
          </Button>
        ) : (
          <Button size="lg" full onClick={goNext}>
            {sectionIndex === SECTIONS.length - 1 ? "Review answers" : "Next"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Progress({
  current,
  total,
  interviewer,
}: {
  current: number;
  total: number;
  interviewer: string;
}) {
  const done = Math.min(current, total);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-muted">
          {done === total ? "Review" : `Step ${done + 1} of ${total}`}
        </p>
        <p className="truncate text-[12px] text-faint">{interviewer}</p>
      </div>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={cx(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= done - 1 || done === total ? "bg-brand" : i === done ? "bg-brand/50" : "bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function ReviewStage({
  values,
  coords,
  onEdit,
}: {
  values: SurveyValues;
  coords: Coords;
  onEdit: (index: number) => void;
}) {
  return (
    <div className="space-y-3">
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Check before saving</h2>
        <p className="mt-1 text-[13px] text-muted">
          Tap any section to go back and fix an answer.
        </p>
        {coords ? (
          <p className="mt-2 text-[12px] text-faint">
            📍 {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
          </p>
        ) : null}
      </Card>

      {/*
        Only answered questions are listed. With everything but the hotel name
        optional, a full listing would be mostly em-dashes, and the interviewer
        would have to hunt for what they actually recorded.
      */}
      {SECTIONS.map((section, index) => {
        const visible = section.questions.filter((q) => isVisible(q, values));
        const answered = visible.filter((q) => hasAnswer(values[q.id]));
        const skipped = visible.length - answered.length;

        return (
          <Card key={section.id}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-semibold">{section.title}</h3>
              <Button variant="ghost" onClick={() => onEdit(index)} className="min-h-9 px-2 text-sm">
                Edit
              </Button>
            </div>

            {answered.length === 0 ? (
              <p className="text-[13px] text-faint">Nothing recorded — that is fine.</p>
            ) : (
              <dl className="space-y-2.5">
                {answered.map((question) => (
                  <div key={question.id} className="grid grid-cols-[1fr_auto] items-baseline gap-3">
                    <dt className="text-[13px] text-muted">{question.label}</dt>
                    <dd className="text-right text-[13px] font-medium">
                      {renderAnswer(values[question.id], question)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {skipped > 0 && answered.length > 0 ? (
              <p className="mt-2.5 text-[12px] text-faint">{skipped} left blank</p>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

function hasAnswer(value: AnswerValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return tableHasContent(value);
  return Number.isFinite(value);
}

function renderAnswer(
  value: AnswerValue | undefined,
  question: (typeof SECTIONS)[number]["questions"][number],
) {
  if (!hasAnswer(value)) return <span className="text-faint">—</span>;

  if (isTableValue(value)) {
    const table = asTableValue(value);
    const columns = question.columns ?? [];
    return (
      <span className="flex flex-col items-end gap-0.5">
        {Object.entries(table.cells).map(([rowKey, cells]) => (
          <span key={rowKey} className="tabular-nums">
            {tableRowLabel(question, table, rowKey)}
            {": "}
            <span className="text-muted">
              {columns
                .filter((c) => typeof cells[c.id] === "number")
                .map((c) => `${cells[c.id]} ${c.label}`)
                .join(" · ")}
            </span>
          </span>
        ))}
      </span>
    );
  }

  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap justify-end gap-1">
        {value.map((v) => (
          <Badge key={v} tone="brand">
            {optionLabel(question, v)}
          </Badge>
        ))}
      </span>
    );
  }

  if (typeof value === "number") {
    return (
      <>
        {value}
        {question.unit ? ` ${question.unit}` : ""}
      </>
    );
  }

  // Everything else has been handled above, so only text remains.
  if (typeof value !== "string") return <span className="text-faint">—</span>;

  if (question.type === "yes_no") return value === "yes" ? "Yes" : "No";
  if (question.options) return optionLabel(question, value);
  return value;
}
