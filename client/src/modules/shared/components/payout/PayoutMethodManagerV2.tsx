"use client";

import { toast } from "@/lib/toast";
import { ProfileFacts } from "@/modules/shared/components/settings/ProfileSection";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { StatusTag } from "@/modules/shared/ui/StatusTag";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { useConfirm } from "@/modules/shared/ui/useConfirm";
import { plural } from "@/modules/shared/utils/figures";
import type { IPayoutMethod } from "@/types";
import { useEffect, useState } from "react";
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
  ownerType: "Coach" | "VENUE" | "Expert";
  /** Load all payout methods from backend */
  onLoad: () => Promise<IPayoutMethod[]>;
  /** Add a new payout method */
  onAdd: (payload: Omit<IPayoutMethod, "id" | "addedAt" | "updatedAt">) => Promise<IPayoutMethod>;
  /** Update existing payout method */
  onUpdate: (
    methodId: string,
    payload: Omit<IPayoutMethod, "id" | "addedAt" | "updatedAt">
  ) => Promise<IPayoutMethod>;
  /** Delete payout method */
  onDelete: (methodId: string) => Promise<void>;
  /** Set method as default */
  onSetDefault: (methodId: string) => Promise<void>;
}

/** The small text button used for a row's secondary actions. */
const ROW_ACTION = `${TEXT_LINK} ring-offset-paper min-h-11 text-sm disabled:opacity-50`;

/**
 * Several payout methods, one of them primary. Each method is a ruled row with
 * its own actions; adding or editing opens the form in place of the list so
 * there is one thing to do at a time. Removing goes through the confirm dialog.
 */
export function PayoutMethodManager({
  onLoad,
  onAdd,
  onUpdate,
  onDelete,
  onSetDefault,
}: PayoutMethodManagerProps) {
  const [confirm, confirmDialog] = useConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [methods, setMethods] = useState<IPayoutMethod[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingMethod, setEditingMethod] = useState<IPayoutMethod | null>(null);
  const [draft, setDraft] = useState<PayoutDraft>(emptyDraft);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    onLoad()
      .then((loaded) => {
        if (mounted) setMethods(loaded);
      })
      .catch(() => {
        if (mounted) toast.error("Failed to load payout methods");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [onLoad]);

  const closeForm = () => {
    setDraft(emptyDraft());
    setEditingMethod(null);
    setIsAdding(false);
  };

  const handleSave = async () => {
    const problem = validateDraft(draft);
    if (problem) {
      toast.error(problem);
      return;
    }

    const payload: Omit<IPayoutMethod, "id" | "addedAt" | "updatedAt"> = {
      ...draftPayload(draft),
      isDefault: editingMethod?.isDefault ?? methods.length === 0,
    };

    setSaving(true);
    try {
      if (editingMethod) {
        const saved = await onUpdate(editingMethod.id!, payload);
        setMethods((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
        toast.success("Payout method updated");
      } else {
        const saved = await onAdd(payload);
        setMethods((prev) => [...prev, saved]);
        toast.success("Payout method added");
      }
      closeForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save payout method");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (methodId: string) => {
    const confirmed = await confirm({
      title: "Remove this payout method?",
      message: "Payouts will no longer be sent to it.",
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!confirmed) return;

    setProcessingId(methodId);
    try {
      await onDelete(methodId);
      setMethods((prev) => prev.filter((m) => m.id !== methodId));
      toast.success("Payout method removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove payout method");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    setProcessingId(methodId);
    try {
      await onSetDefault(methodId);
      setMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === methodId })));
      toast.success("Primary payout method updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set default method");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Loading your payout methods</span>
        <Skeleton aria-hidden="true" className="h-6 w-40" />
        <Skeleton aria-hidden="true" className="h-32 w-full" />
      </div>
    );
  }

  const formOpen = isAdding || editingMethod !== null;

  return (
    <section aria-labelledby="payout-methods-heading">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 id="payout-methods-heading" className="text-ink text-base font-semibold">
          {formOpen
            ? editingMethod
              ? "Change payout method"
              : "Add a payout method"
            : "Payout methods"}
        </h2>
        {!formOpen && methods.length > 0 && (
          <StatusTag tone="live">{plural(methods.length, "method")}</StatusTag>
        )}
      </div>

      {formOpen ? (
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
              {saving ? "Saving" : editingMethod ? "Save changes" : "Add method"}
            </Button>
            <button type="button" onClick={closeForm} disabled={saving} className={ROW_ACTION}>
              Cancel
            </button>
          </div>
        </form>
      ) : methods.length === 0 ? (
        <div className="mt-5">
          <p className="text-ink-body max-w-[52ch] text-pretty">
            You have not added a payout method yet. Add a bank account or UPI ID so your earnings
            can reach you.
          </p>
          <div className="mt-5">
            <Button className="min-h-11" onClick={() => setIsAdding(true)}>
              Add a payout method
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-ink-body max-w-[60ch] text-pretty text-sm">
            Your primary method is used for automatic payouts.
          </p>
          <ul className="mt-4">
            {methods.map((method, index) => {
              const id = method.id ?? "";
              const busy = processingId === id;
              const label = methodLabel(method.type);
              return (
                <li
                  key={method.id ?? `${method.type}-${index}`}
                  className="border-hairline border-t py-6 first:border-t-0 first:pt-2"
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <h3 className="text-ink font-medium">{label}</h3>
                    {method.isDefault && <StatusTag tone="live">Primary</StatusTag>}
                  </div>
                  <div className="mt-3">
                    <ProfileFacts rows={methodFacts(method)} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1">
                    <button
                      type="button"
                      className={ROW_ACTION}
                      disabled={busy}
                      onClick={() => {
                        setEditingMethod(method);
                        setDraft(draftFrom(method));
                        setIsAdding(false);
                      }}
                      aria-label={`Change ${label} method`}
                    >
                      Change
                    </button>
                    {!method.isDefault && (
                      <button
                        type="button"
                        className={ROW_ACTION}
                        disabled={busy}
                        onClick={() => void handleSetDefault(id)}
                        aria-label={`Make ${label} the primary method`}
                      >
                        Make primary
                      </button>
                    )}
                    <button
                      type="button"
                      className={ROW_ACTION}
                      disabled={busy}
                      onClick={() => void handleDelete(id)}
                      aria-label={`Remove ${label} method`}
                    >
                      {busy ? "Working" : "Remove"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-hairline border-t pt-6">
            <Button variant="secondary" className="min-h-11" onClick={() => setIsAdding(true)}>
              Add another method
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
