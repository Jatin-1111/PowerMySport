"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/modules/shared/ui/Button";
import { Modal } from "@/modules/shared/ui/Modal";
import {
  isMissingArchetypeTraits,
  type DependentCompletionProfile,
} from "@/modules/player/utils/dependentCompletion";

const DISMISS_KEY = "pms_traits_nudge_dismissed";

function readDismissed(): string[] {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function dismissTraitsNudge(dependentId: string): void {
  try {
    const ids = readDismissed();
    if (!ids.includes(dependentId)) {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...ids, dependentId]));
    }
  } catch {
    // sessionStorage unavailable (e.g. private mode) — nudge just reappears next time.
  }
}

/** Whether the "add a few more details" nudge should fire for this dependent:
 * missing personality/physical/comfort traits, and not already skipped this
 * session. Session-scoped (not permanent) so a quick dismiss doesn't silence
 * it forever — mirrors the persona banner's dismiss pattern. */
export function shouldShowTraitsNudge(
  dependent: (DependentCompletionProfile & { _id?: string }) | null | undefined,
): boolean {
  if (!dependent?._id) return false;
  if (readDismissed().includes(dependent._id)) return false;
  return isMissingArchetypeTraits(dependent);
}

interface CompleteProfileNudgeProps {
  isOpen: boolean;
  dependentId: string;
  dependentName: string;
  /** Called after the parent skips or opts to add details — the caller
   * proceeds with whatever the nudge was gating (opening chat, booking). */
  onProceed: () => void;
}

export function CompleteProfileNudge({
  isOpen,
  dependentId,
  dependentName,
  onProceed,
}: CompleteProfileNudgeProps) {
  const handleSkip = () => {
    dismissTraitsNudge(dependentId);
    onProceed();
  };

  const handleAddDetails = () => {
    // Opens in a new tab so the guidance/booking flow in this tab is left
    // exactly as-is — nothing here has been submitted/paid for yet.
    window.open(
      `/dashboard/my-profile?editDependent=${dependentId}&step=physical`,
      "_blank",
      "noopener,noreferrer",
    );
    dismissTraitsNudge(dependentId);
    onProceed();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleSkip} title="A few more details?" size="sm">
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-power-orange/10">
          <Sparkles className="h-6 w-6 text-power-orange" />
        </div>
        <p className="text-sm text-slate-600">
          {dependentName}&apos;s profile is missing a few personality and play-style
          details. Adding them helps us personalise guidance and gives the expert
          better context — takes about a minute, in a new tab.
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Button type="button" onClick={handleAddDetails} className="w-full">
          Add details
        </Button>
        <Button type="button" variant="secondary" onClick={handleSkip} className="w-full">
          Skip for now
        </Button>
      </div>
    </Modal>
  );
}
