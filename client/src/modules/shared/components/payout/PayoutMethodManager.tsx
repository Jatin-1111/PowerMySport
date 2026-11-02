"use client";

import { toast } from "@/lib/toast";
import { ProfileFacts } from "@/modules/shared/components/settings/ProfileSection";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { StatusTag } from "@/modules/shared/ui/StatusTag";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import type { IPayoutMethod } from "@/types";
import { useEffect, useRef, useState } from "react";
import {
  draftFrom,
  draftPayload,
  emptyDraft,
  methodFacts,
  methodLabel,
  PayoutFields,
  validateDraft,
  type PayoutDraft,
} from "./PayoutFields";

interface PayoutMethodManagerProps {
  /** Who owns this payout method UI */
  ownerType: "Coach" | "VENUE";
  /** Load the existing payout method from backend */
  onLoad: () => Promise<IPayoutMethod | null>;
  /** Save (upsert) the payout method */
  onSave: (payload: Omit<IPayoutMethod, "addedAt" | "updatedAt">) => Promise<IPayoutMethod>;
  /** Delete the payout method */
  onDelete: () => Promise<void>;
}

/**
 * One payout method for an account: what is saved, or the form to add or
 * change it. Removing asks twice, because the second press is the only
 * confirmation: the first turns the button into "Confirm remove" for four
 * seconds. There is no card around it; the page it sits on supplies the frame.
 */
export function PayoutMethodManager({ onLoad, onSave, onDelete }: PayoutMethodManagerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [current, setCurrent] = useState<IPayoutMethod | null>(null);
  const [draft, setDraft] = useState<PayoutDraft>(emptyDraft);

  const confirmDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    onLoad()
      .then((method) => {
        if (!mounted) return;
        setCurrent(method);
        if (method) setDraft(draftFrom(method));
      })
      .catch(() => {
        if (mounted) toast.error("Failed to load payout method");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [onLoad]);

  useEffect(
    () => () => {
      if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
    },
    []
  );

  const stopEditing = (saved: IPayoutMethod | null) => {
    setDraft(saved ? draftFrom(saved) : emptyDraft());
    setEditing(false);
    setConfirmDelete(false);
  };

  const handleSave = async () => {
    const problem = validateDraft(draft);
    if (problem) {
      toast.error(problem);
      return;
    }

    setSaving(true);
    try {
      const saved = await onSave(draftPayload(draft));
      setCurrent(saved);
      stopEditing(saved);
      toast.success("Payout method saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save payout method");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      confirmDeleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
    setDeleting(true);
    try {
      await onDelete();
      setCurrent(null);
      stopEditing(null);
      toast.success("Payout method removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove payout method");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Loading your payout method</span>
        <Skeleton aria-hidden="true" className="h-6 w-40" />
        <Skeleton aria-hidden="true" className="h-32 w-full" />
      </div>
    );
  }

  return (
    <section aria-labelledby="payout-method-heading">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 id="payout-method-heading" className="text-ink text-base font-semibold">
          Payout method
        </h2>
        <StatusTag tone={current ? "live" : "pending"}>
          {current ? "Saved" : "Not set up"}
        </StatusTag>
      </div>

      {editing ? (
        <form
          className="mt-5 space-y-8"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <PayoutFields draft={draft} onChange={setDraft} disabled={saving} />
          <div className="border-hairline flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-6">
            <Button type="submit" disabled={saving} className="min-h-11">
              {saving ? "Saving" : current ? "Save changes" : "Save payout method"}
            </Button>
            <button
              type="button"
              onClick={() => stopEditing(current)}
              disabled={saving}
              className={`${TEXT_LINK} ring-offset-paper min-h-11 text-sm disabled:opacity-50`}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : current ? (
        <div className="mt-5">
          <p className="text-ink-body mb-3 text-sm">{methodLabel(current.type)}</p>
          <ProfileFacts rows={methodFacts(current)} />
          {current.updatedAt && (
            <p className="text-ink-body mt-3 text-sm">
              Last updated{" "}
              {new Date(current.updatedAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Button
              variant="secondary"
              className="min-h-11"
              onClick={() => {
                setDraft(draftFrom(current));
                setEditing(true);
              }}
            >
              Change method
            </Button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className={`${TEXT_LINK} ring-offset-paper min-h-11 text-sm disabled:opacity-50 ${
                confirmDelete ? "text-red-800 decoration-red-800" : ""
              }`}
            >
              {deleting ? "Removing" : confirmDelete ? "Press again to remove" : "Remove"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-ink-body max-w-[52ch] text-pretty">
            You have not added a payout method yet. Add a bank account or UPI ID so earnings from
            bookings can reach you.
          </p>
          <div className="mt-5">
            <Button
              className="min-h-11"
              onClick={() => {
                setDraft(emptyDraft());
                setEditing(true);
              }}
            >
              Add a payout method
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
