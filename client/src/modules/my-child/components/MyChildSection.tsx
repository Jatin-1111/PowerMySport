"use client";

import type { ChildEventKind, ChildTimelineRow } from "@powermysport/shared-types";
import { AcademicsCard } from "@/modules/my-child/components/AcademicsCard";
import { EntryDialog, type EntryDialogTarget } from "@/modules/my-child/components/EntryDialog";
import { HistoryTimeline } from "@/modules/my-child/components/HistoryTimeline";
import { ShareCard } from "@/modules/my-child/components/ShareCard";
import { VideosCard } from "@/modules/my-child/components/VideosCard";
import { useChildHistory } from "@/modules/my-child/hooks/useChildHistory";
import { headerLine } from "@/modules/my-child/utils/format";
import { Button } from "@/modules/shared/ui/Button";
import { ConfirmDialog } from "@/modules/shared/ui/ConfirmDialog";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { StatTile } from "@/modules/shared/ui/StatTile";
import { useState } from "react";

const SPORT_KINDS: ChildEventKind[] = [
  "tournament_result",
  "coaching_period",
  "award",
  "fitness_test",
];
const ACADEMIC_KINDS: ChildEventKind[] = ["academic_result", "test_score"];

interface OpenDialog {
  target: EntryDialogTarget;
  kinds: ChildEventKind[];
}

/**
 * The child's sporting journey: the header, three tiles, academics, videos, sharing and the timeline.
 *
 * It is one component so the child page spends a single line on it (that page is past its size
 * limit and may not grow). Everything on it comes from one read of `/child-history`, and every
 * write re-reads it, so the tiles and the timeline cannot disagree.
 *
 * A tile appears only when it has a real number behind it. A child with nothing recorded sees no
 * tiles, not three zeros.
 */
export function MyChildSection({ childId }: { childId: string }) {
  const {
    history,
    isLoading,
    isError,
    refetch,
    addEntry,
    updateEntry,
    deleteEntry,
    saveAcademics,
    recordVideoConsent,
    deleteVideo,
  } = useChildHistory(childId);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [removing, setRemoving] = useState<ChildTimelineRow | null>(null);

  const stats = history?.stats;
  const tiles = [
    stats?.yearsInSport ? { label: "Years in sport", value: stats.yearsInSport } : null,
    stats?.tournaments ? { label: "Tournaments", value: stats.tournaments } : null,
    stats?.awards ? { label: "Awards", value: stats.awards } : null,
  ].filter((tile): tile is { label: string; value: number } => tile !== null);

  const open = (target: EntryDialogTarget, kinds: ChildEventKind[] = SPORT_KINDS) =>
    setDialog({ target, kinds });

  return (
    <section aria-labelledby="my-child" className="border-hairline border-t pt-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="my-child" className="font-editorial text-ink text-3xl font-light">
            My Child
          </h2>
          {history && headerLine(history.child) && (
            <p className="text-ink-body mt-1">{headerLine(history.child)}</p>
          )}
        </div>
        <Button
          variant="secondary"
          className="min-h-11"
          onClick={() => open({ mode: "add" })}
          disabled={!history}
        >
          Add entry
        </Button>
      </div>

      {isLoading && (
        <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading the journey">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {isError && (
        <div role="alert" className="border-hairline mt-8 rounded-xl border px-5 py-6">
          <p className="text-ink font-medium">The journey could not be loaded.</p>
          <p className="text-ink-body mt-1 text-sm">Check your connection and try again.</p>
          <Button variant="outline" size="sm" className="mt-4 min-h-11" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {history && (
        <div className="mt-10 space-y-12">
          {tiles.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              {tiles.map((tile) => (
                <StatTile key={tile.label} label={tile.label} value={tile.value} />
              ))}
            </div>
          )}

          <ShareCard childId={childId} history={history} />

          <AcademicsCard
            academics={history.academics}
            saving={saveAcademics.isPending}
            onSave={(changes) => saveAcademics.mutateAsync(changes)}
            onAddResult={() => open({ mode: "add" }, ACADEMIC_KINDS)}
          />

          <VideosCard
            childId={childId}
            videos={history.videos}
            consentGiven={history.videoConsent}
            onAgree={() => recordVideoConsent.mutateAsync()}
            onRemove={(videoId) => deleteVideo.mutate(videoId)}
            removing={deleteVideo.isPending}
          />

          {history.timeline.length === 0 ? (
            <div className="border-hairline max-w-lg rounded-xl border border-dashed px-5 py-6">
              <p className="text-ink font-medium">No results yet</p>
              <p className="text-ink-body mt-1 text-pretty text-sm">
                Add your first result. Tournaments you mark as played in the planner appear here on
                their own.
              </p>
            </div>
          ) : (
            <HistoryTimeline
              rows={history.timeline}
              onEdit={(row) =>
                open(
                  { mode: "edit", row },
                  ACADEMIC_KINDS.includes(row.kind as ChildEventKind) ? ACADEMIC_KINDS : SPORT_KINDS
                )
              }
              onDelete={setRemoving}
              onAddResult={(row) => open({ mode: "result", row })}
            />
          )}
        </div>
      )}

      <EntryDialog
        isOpen={dialog !== null}
        onClose={() => setDialog(null)}
        target={dialog?.target ?? { mode: "add" }}
        kinds={dialog?.kinds ?? SPORT_KINDS}
        saving={addEntry.isPending || updateEntry.isPending}
        onAdd={(entry) => addEntry.mutateAsync(entry)}
        onSave={(entryId, changes) => updateEntry.mutateAsync({ entryId, changes })}
      />

      <ConfirmDialog
        isOpen={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) deleteEntry.mutate(removing.id, { onSettled: () => setRemoving(null) });
        }}
        title="Remove this entry"
        message={removing ? `Remove "${removing.title}" from the journey?` : ""}
        confirmLabel="Remove"
        variant="danger"
        loading={deleteEntry.isPending}
      />
    </section>
  );
}
