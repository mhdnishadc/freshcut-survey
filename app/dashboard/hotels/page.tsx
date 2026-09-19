import { HotelTable } from "@/components/dashboard/hotel-table";
import { EmptyState } from "@/components/ui";
import { getResponses } from "@/lib/data";

export const metadata = { title: "Hotels · FreshCut Survey" };
export const dynamic = "force-dynamic";

export default async function HotelsPage() {
  const responses = await getResponses();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Hotels surveyed</h1>
        <p className="mt-1 text-sm text-muted">
          Every interview, searchable and exportable. Tap a hotel to see all its answers.
        </p>
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
