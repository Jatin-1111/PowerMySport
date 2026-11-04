"use client";

import type { ChildHistoryView, ChildShareListItem } from "@powermysport/shared-types";
import { ShareDialog } from "@/modules/my-child/components/ShareDialog";
import { useChildShares } from "@/modules/my-child/hooks/useChildShares";
import { formatEntryDate } from "@/modules/my-child/utils/format";
import { offeredSections } from "@/modules/my-child/utils/shareChoices";
import { Button } from "@/modules/shared/ui/Button";
import { ConfirmDialog } from "@/modules/shared/ui/ConfirmDialog";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { useState } from "react";

const describeStatus = (share: ChildShareListItem): string =>
  share.status === "active"
    ? `Active until ${formatEntryDate(share.expiresAt, "day")}`
    : share.status === "expired"
      ? `Expired on ${formatEntryDate(share.expiresAt, "day")}`
      : `Stopped${share.revokedAt ? ` on ${formatEntryDate(share.revokedAt, "day")}` : ""}`;

const describeOpens = (share: ChildShareListItem): string =>
  share.openCount === 0
    ? "Not opened yet"
    : `Opened ${share.openCount} ${share.openCount === 1 ? "time" : "times"}${
        share.lastOpenedAt ? `, last on ${formatEntryDate(share.lastOpenedAt, "day")}` : ""
      }`;

/**
 * Making links for coaches, and the list of the ones already made.
 *
 * "Share with a coach" is the one orange action in My Child, because it is what the rest of the
 * page is for. A link cannot be shown again after it is made (the server keeps only a hash), so
 * the list shows who each is for, how long it lasts and how often it has been opened, with a way
 * to stop it. A parent who has lost a link makes a new one.
 */
export function ShareCard({ childId, history }: { childId: string; history: ChildHistoryView }) {
  const { shares, isLoading, isError, revoke } = useChildShares(childId);
  const [making, setMaking] = useState(false);
  const [stopping, setStopping] = useState<ChildShareListItem | null>(null);
  const hasContent = offeredSections(history).length > 0;

  return (
    <div className="border-hairline rounded-xl border p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-editorial text-ink text-xl font-light">Share with a coach</h3>
          <p className="text-ink-body mt-1 text-pretty text-sm">
            Make a link for a university coach. You choose what they see, and you can stop it at any
            time.
          </p>
        </div>
        <Button className="min-h-11" onClick={() => setMaking(true)} disabled={!hasContent}>
          Share with a coach
        </Button>
      </div>

      {!hasContent && (
        <p className="text-ink-body mt-3 text-sm">
          Add a result, school details or a video first. There is nothing to share yet.
        </p>
      )}

      {isLoading && <Skeleton className="mt-4 h-12 w-full" />}

      {isError && (
        <p role="alert" className="text-ink-body mt-4 text-sm">
          Your links could not be loaded. Reload the page to try again.
        </p>
      )}

      {shares.length > 0 && (
        <ul className="divide-hairline mt-4 divide-y" aria-label="Your links">
          {shares.map((share) => (
            <li
              key={share.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
            >
              <div className="min-w-0">
                <p className="text-ink truncate font-medium">{share.recipientLabel}</p>
                <p className="text-ink-body text-sm">
                  {describeStatus(share)}. {describeOpens(share)}.
                </p>
              </div>
              {share.status === "active" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onClick={() => setStopping(share)}
                  aria-label={`Stop sharing with ${share.recipientLabel}`}
                >
                  Stop sharing
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ShareDialog
        isOpen={making}
        onClose={() => setMaking(false)}
        childId={childId}
        history={history}
      />

      <ConfirmDialog
        isOpen={stopping !== null}
        onClose={() => setStopping(null)}
        onConfirm={() => {
          if (stopping) revoke.mutate(stopping.id);
        }}
        title="Stop sharing"
        message={
          stopping
            ? `Stop sharing with ${stopping.recipientLabel}? The link stops working straight away.`
            : ""
        }
        confirmLabel="Stop sharing"
        variant="danger"
        loading={revoke.isPending}
      />
    </div>
  );
}
