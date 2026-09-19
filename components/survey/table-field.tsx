"use client";

import { useState } from "react";

import { Button, Input, cx } from "@/components/ui";
import {
  asTableValue,
  type AnswerValue,
  type Question,
  type TableValue,
} from "@/lib/survey/questions";

/**
 * The vegetable grid.
 *
 * On paper this was four separate tables of twelve rows each. On a phone, a
 * real <table> with three number inputs per row is unusable one-handed, so the
 * grid is rendered as one card per vegetable: the name on its own line, the
 * three numbers side by side underneath. Nothing scrolls sideways.
 *
 * Rows the interviewer never touches stay collapsed to a single tappable line,
 * which is what keeps twelve vegetables from becoming a wall of empty boxes.
 */
export function TableField({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const table = asTableValue(value);
  const columns = question.columns ?? [];
  const configuredRows = question.rows ?? [];
  const rows = [
    ...configuredRows,
    ...table.extraRows.map((r) => ({ value: r.key, label: r.label })),
  ];

  const [newRow, setNewRow] = useState("");
  // Rows opened by tapping, on top of the ones that already hold numbers.
  const [opened, setOpened] = useState<string[]>([]);

  function write(next: TableValue) {
    onChange(next);
  }

  function setCell(rowKey: string, columnId: string, n: number | null) {
    const row = { ...(table.cells[rowKey] ?? {}), [columnId]: n };
    // Dropping a fully-cleared row keeps the stored answer honest: a row that
    // exists means the kitchen uses that vegetable.
    const isBlank = Object.values(row).every((v) => v === null || v === undefined);
    const cells = { ...table.cells };
    if (isBlank) delete cells[rowKey];
    else cells[rowKey] = row;
    write({ ...table, cells });
  }

  function addRow() {
    const label = newRow.trim();
    if (!label) return;

    // Typing a vegetable that is already on the list opens that row rather than
    // creating a near-duplicate the dashboard would then count separately.
    const existing = configuredRows.find(
      (r) => r.label.toLowerCase() === label.toLowerCase(),
    );
    const key = existing?.value ?? `other:${label.toLowerCase().replace(/\s+/g, "_")}`;

    if (!existing && !table.extraRows.some((r) => r.key === key)) {
      write({ ...table, extraRows: [...table.extraRows, { key, label }] });
    }

    setOpened((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setNewRow("");
  }

  function removeRow(rowKey: string) {
    const cells = { ...table.cells };
    delete cells[rowKey];
    write({ cells, extraRows: table.extraRows.filter((r) => r.key !== rowKey) });
    setOpened((prev) => prev.filter((k) => k !== rowKey));
  }

  /** Empties a listed vegetable's row and folds it back down to one line. */
  function clearRow(rowKey: string) {
    const cells = { ...table.cells };
    delete cells[rowKey];
    write({ ...table, cells });
    setOpened((prev) => prev.filter((k) => k !== rowKey));
  }

  const filledCount = Object.keys(table.cells).length;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-muted">
          {columns.map((c) => c.description).join(" · ")}
        </p>
        <p className="shrink-0 text-[13px] font-medium tabular-nums text-muted">
          {filledCount} filled
        </p>
      </div>

      <ul className="space-y-1.5">
        {rows.map((row) => {
          const cells = table.cells[row.value];
          const isOpen = Boolean(cells) || opened.includes(row.value);
          const isExtra = !configuredRows.some((r) => r.value === row.value);

          if (!isOpen) {
            return (
              <li key={row.value}>
                <button
                  type="button"
                  onClick={() => setOpened((prev) => [...prev, row.value])}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border-strong bg-surface px-3.5 text-left text-[15px] hover:bg-surface-2"
                >
                  <span>{row.label}</span>
                  <span aria-hidden className="text-lg leading-none text-faint">
                    +
                  </span>
                </button>
              </li>
            );
          }

          return (
            <li
              key={row.value}
              className="rounded-xl border border-brand bg-brand-soft/40 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[15px] font-medium">{row.label}</span>
                <button
                  type="button"
                  onClick={() => (isExtra ? removeRow(row.value) : clearRow(row.value))}
                  className="min-h-8 px-1 text-[13px] text-muted hover:text-danger"
                >
                  {isExtra ? "Remove" : "Clear"}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {columns.map((column) => {
                  const current = cells?.[column.id];
                  const text =
                    typeof current === "number" && Number.isFinite(current)
                      ? String(current)
                      : "";
                  return (
                    <label key={column.id} className="block">
                      <span className="mb-1 block text-[12px] text-muted">{column.label}</span>
                      <Input
                        aria-label={`${row.label} — ${column.description}`}
                        inputMode={column.decimal ? "decimal" : "numeric"}
                        placeholder="—"
                        className="px-2.5 text-center"
                        value={text}
                        onChange={(e) => {
                          const raw = e.target.value.replace(
                            column.decimal ? /[^\d.]/g : /[^\d]/g,
                            "",
                          );
                          if (raw === "") {
                            setCell(row.value, column.id, null);
                            return;
                          }
                          const parsed = Number(raw);
                          setCell(row.value, column.id, Number.isFinite(parsed) ? parsed : null);
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      <div className={cx("flex gap-2 pt-1")}>
        <Input
          value={newRow}
          placeholder={question.addRowLabel ?? "Add a row"}
          aria-label={question.addRowLabel ?? "Add a row"}
          onChange={(e) => setNewRow(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // Enter inside a survey step must add the row, never submit.
            e.preventDefault();
            addRow();
          }}
        />
        <Button variant="secondary" onClick={addRow} disabled={newRow.trim() === ""}>
          Add
        </Button>
      </div>
    </div>
  );
}
