import mongoose from "mongoose";
import { TournamentEdition } from "../models/TournamentEdition";

/**
 * Public URL slugs for tournament editions.
 *
 * Lives here rather than in the approval controller so the backfill script
 * (scripts/backfillEditionSlugs.ts) mints slugs through the exact same function
 * the write path uses — the two silently drifting would hand the same event two
 * different URLs.
 */

/** "AITA CS7 (Delhi)" -> "aita-cs7-delhi" */
export function slugifyEditionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

export interface EditionKey {
  sportSlug: string;
  name: string;
  startDate: Date;
}

/**
 * The slug for one edition.
 *
 * Stable by construction: a row that already has a slug keeps it, so a page
 * that has been shared or indexed never moves when its source is re-approved.
 * New slugs are `name-startDate`, deduped with a numeric suffix — the edition
 * key includes sportSlug, so two sports running an identically-named event on
 * the same day would otherwise collide.
 */
export async function resolveEditionSlug(key: EditionKey): Promise<string> {
  const existing = await TournamentEdition.findOne(key).select("slug").lean();
  if (existing?.slug) return existing.slug as string;

  const base =
    `${slugifyEditionName(key.name)}-${key.startDate.toISOString().slice(0, 10)}`.replace(/^-/, "");

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await TournamentEdition.findOne({ slug: candidate }).select("_id").lean();
    if (!taken) return candidate;
  }
  // 50 identically-named same-day editions means something is wrong upstream;
  // fall back to a unique suffix rather than failing the approval.
  return `${base}-${new mongoose.Types.ObjectId().toString().slice(-6)}`;
}
