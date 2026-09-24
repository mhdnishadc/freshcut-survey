import { num } from "@/lib/format";
import type { VegetableDemand } from "@/lib/analytics/aggregate";

/**
 * The survey's answer sheet: one row per vegetable, ordered by daily volume.
 *
 * This is the table the founders read before deciding what the first processing
 * line cuts. It is a real <table> because every column is a different quantity —
 * a bar chart could carry one of them, not three — and it scrolls inside its own
 * container so the page never scrolls sideways on a phone.
 */
export function VegetableTable({ rows }: { rows: VegetableDemand[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-faint">
        No vegetable quantities recorded yet.
      </p>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="w-full min-w-xl text-left text-sm">
        <thead className="border-b border-border text-[13px] text-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Vegetable</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">kg/day</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Kitchens</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Want it pre-cut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="px-4 py-2.5 text-left font-medium">
                {row.label}
              </th>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                {row.kgPerDay > 0 ? num(row.kgPerDay) : "—"}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted">{row.kitchens}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {row.wantPrecut > 0 ? (
                  <span className="font-medium text-brand">
                    {row.wantPrecut} of {row.kitchens}
                  </span>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
