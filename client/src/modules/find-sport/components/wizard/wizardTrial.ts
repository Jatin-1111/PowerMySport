import api from "@/lib/api/axios";
import type { SportFitResult, SportResult } from "../../types";

// ─── Primary sport ──────────────────────────────────────────────────────────
// The one sport everything downstream (trial booking, check-in nudge) hangs
// off. The parent's own picks outrank our recommendations — that's what they'll
// actually walk into a trial class for — and among their picks it's the
// best-scoring one, matching the sport the results page names in its CTA.
export function primarySport(
  scored: SportResult[],
  chosen: SportFitResult[]
): { name: string; firstNote?: string } | null {
  const chosenTop: SportFitResult | undefined = [...chosen].sort((a, b) => b.score - a.score)[0];
  if (chosenTop) return { name: chosenTop.sport.name, firstNote: chosenTop.strengths[0] };
  const scoredTop: SportResult | undefined = scored[0];
  if (scoredTop) return { name: scoredTop.sport.name, firstNote: scoredTop.reasons[0] };
  return null;
}

// ─── Trial check-in ────────────────────────────────────────────────────────
// Schedules the 4-week "how did the trial go?" nudge for the sport the family
// is most likely to try. Fire-and-forget — a failure here shouldn't affect the
// save the parent already saw succeed.

/** The 2-3 concrete things to watch for, reused verbatim in the nudge email. */
export function trialSignals(firstNote: string | undefined, childName: string): string[] {
  const name = childName || "your child";
  return [
    firstNote,
    `Did ${name} ask to play again without being asked?`,
    "Was the cost and time commitment manageable for your family?",
  ].filter((s): s is string => !!s);
}

export function scheduleTrialCheckIn(
  dependentId: string | null,
  scored: SportResult[],
  chosen: SportFitResult[],
  childName: string
): void {
  const top = primarySport(scored, chosen);
  if (!top) return;

  api
    .post("/plan-checkins/find-sport-trial", {
      dependentId: dependentId || undefined,
      sport: top.name,
      signals: trialSignals(top.firstNote, childName),
    })
    .catch(() => {});
}

/** The first "why this fits" line for a named sport, whichever list it came from. */
export function firstNoteFor(
  sportName: string,
  scored: SportResult[],
  chosen: SportFitResult[]
): string | undefined {
  const fit = chosen.find((c) => c.sport.name === sportName);
  if (fit) return fit.strengths[0];
  return scored.find((s) => s.sport.name === sportName)?.reasons[0];
}
