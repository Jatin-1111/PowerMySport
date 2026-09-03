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

const editionKeyId = (key: EditionKey): string =>
  `${key.sportSlug}|${key.name}|${key.startDate.toISOString()}`;

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Batched sibling of resolveEditionSlug — same stability guarantee and same
 * numeric-suffix algorithm, but resolves a whole calendar's worth of editions
 * (up to ~150 for a full tennis calendar) in a constant, small number of
 * round trips instead of 1-51 sequential queries per edition.
 */
export async function resolveEditionSlugsBatch(keys: EditionKey[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (keys.length === 0) return result;

  const existingDocs = await TournamentEdition.find({
    $or: keys.map((k) => ({
      sportSlug: k.sportSlug,
      name: k.name,
      startDate: k.startDate,
    })),
  })
    .select("sportSlug name startDate slug")
    .lean();

  const existingByKeyId = new Map(
    existingDocs.map((d) => [
      editionKeyId({
        sportSlug: d.sportSlug,
        name: d.name,
        startDate: d.startDate,
      }),
      d.slug as string | undefined,
    ])
  );

  const needsNewSlug: Array<{ id: string; base: string }> = [];
  for (const key of keys) {
    const id = editionKeyId(key);
    if (result.has(id)) continue; // duplicate key in the input batch
    const existingSlug = existingByKeyId.get(id);
    if (existingSlug) {
      result.set(id, existingSlug);
      continue;
    }
    const base =
      `${slugifyEditionName(key.name)}-${key.startDate.toISOString().slice(0, 10)}`.replace(
        /^-/,
        ""
      );
    needsNewSlug.push({ id, base });
  }

  if (needsNewSlug.length === 0) return result;

  const bases = [...new Set(needsNewSlug.map((n) => n.base))];
  const takenDocs = await TournamentEdition.find({
    $or: bases.map((base) => ({
      slug: { $regex: `^${escapeRegex(base)}(-\\d+)?$` },
    })),
  })
    .select("slug")
    .lean();
  const takenSlugs = new Set(takenDocs.map((d) => d.slug as string));

  for (const { id, base } of needsNewSlug) {
    let attempt = 0;
    let candidate = base;
    while (takenSlugs.has(candidate) && attempt < 49) {
      attempt += 1;
      candidate = `${base}-${attempt + 1}`;
    }
    if (takenSlugs.has(candidate)) {
      candidate = `${base}-${new mongoose.Types.ObjectId().toString().slice(-6)}`;
    } else {
      // Reserve within this batch so two new editions sharing a base
      // (same slugified name + date, different sport) don't collide —
      // the sequential version got this for free via its per-item DB probe.
      takenSlugs.add(candidate);
    }
    result.set(id, candidate);
  }

  return result;
}
