import { CAL_TZ } from "@/modules/pathway/config/tournamentDisplay";

import type { EditionDocument, TournamentEditionDetail } from "./pathway";

// Extracted from app/(marketing)/tournaments/[slug]/page.tsx — pure fetch and
// formatting logic the route itself doesn't need to hold, per the src/app
// size ratchet (tests/oversizedFiles.json). Relocated as-is, no behavior
// change.

/**
 * Deliberately shorter than the hour used elsewhere on the marketing site.
 *
 * The question this page exists to answer — "is the fact sheet up yet?" — is
 * exactly the one that changes, and it changes the moment an admin approves a
 * source. At an hour's cache a parent is told "no fact sheet published yet"
 * while the link is already live, which is worse than showing nothing at all.
 * The read behind it is a single indexed lookup, so a minute costs very little.
 *
 * The tag is here so this can become instant later: have the approve action
 * call revalidateTag("tournament-editions") instead of waiting out the window.
 */
const EDITION_REVALIDATE_SECONDS = 60;

export async function fetchEdition(slug: string): Promise<TournamentEditionDetail | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    const res = await fetch(`${apiBase}/tournament-editions/${encodeURIComponent(slug)}`, {
      next: { revalidate: EDITION_REVALIDATE_SECONDS, tags: ["tournament-editions"] },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.success ? (body.data as TournamentEditionDetail) : null;
  } catch {
    return null;
  }
}

export function formatFullDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: CAL_TZ,
  });
}

export function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: CAL_TZ,
  });
}

export const DOCUMENT_META: Record<EditionDocument["kind"], { label: string; hint: string }> = {
  factSheet: {
    label: "Fact sheet",
    hint: "Entry fee, entry deadline, format and venue rules — read this before entering.",
  },
  acceptanceList: {
    label: "Acceptance list",
    hint: "Who has been accepted into the draw.",
  },
  entryForm: { label: "Entry form", hint: "Submit this to enter." },
  draw: { label: "Draw", hint: "Match-ups and seedings." },
  results: { label: "Results", hint: "Final results for this event." },
  other: { label: "Document", hint: "Published alongside this tournament." },
};
