"use client";

import { Check } from "lucide-react";

/**
 * The one control on the results page that records a decision.
 *
 * Everything else here is either something the parent told us before seeing
 * results (their shortlist) or something we worked out (scores, the sport our
 * CTA names). Until this is clicked, "which sport did they go with" is a guess
 * — and the WhatsApp handoff that follows leaves no trace to correct it.
 */
export function ChooseSportButton({
  sportName,
  chosen,
  saving,
  onChoose,
  tone = "light",
}: {
  sportName: string;
  chosen: boolean;
  /**
   * A write is in flight for *some* card. Only guards against a second pick
   * racing the first — deliberately renders no spinner, because the card that
   * was actually clicked has already flipped to its chosen state and the other
   * four aren't loading anything.
   */
  saving: boolean;
  onChoose: (sport: string) => void;
  /** `light` sits on a white card, `subtle` on the tinted footer of a portfolio card. */
  tone?: "light" | "subtle";
}) {
  // Portfolio cards are narrow columns — a full-width control reads as part of
  // the card; on the wide fit cards it would look like a second CTA bar.
  const width = tone === "subtle" ? "w-full" : "";

  if (chosen) {
    return (
      <span
        className={`bg-turf-green/10 text-turf-green inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${width}`}
      >
        <Check className="h-4 w-4 shrink-0" />
        You&apos;re starting here
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onChoose(sportName)}
      disabled={saving}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${width} ${
        tone === "subtle"
          ? "hover:border-power-orange hover:text-power-orange border border-slate-200 bg-white text-slate-600"
          : "hover:border-power-orange hover:bg-power-orange/5 hover:text-power-orange border border-slate-200 text-slate-600"
      }`}
    >
      Start with {sportName}
    </button>
  );
}
