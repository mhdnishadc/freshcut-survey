import { HotelTable } from "@/components/dashboard/hotel-table";
import { EmptyState, LinkButton } from "@/components/ui";
import { getResponses } from "@/lib/data";

export const metadata = { title: "Hotels · FreshCut Survey" };
export const dynamic = "force-dynamic";

export default async function HotelsPage() {
  const responses = await getResponses();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Collected hotels</h1>
          <p className="mt-1 text-sm text-muted">
            Every interview your team has saved. Open one to read everything that was collected.
          </p>
        </div>
        <LinkButton href="/survey" variant="secondary" className="shrink-0">
          ← Back to survey
        </LinkButton>
      </header>

      {responses.length === 0 ? (
        <EmptyState
          title="No interviews yet"
          body="Hotels appear here as soon as your field team saves the first interview."
        />
      ) : (
        <HotelTable responses={responses} />
      )}
    </div>
  );
}
