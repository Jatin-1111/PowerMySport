import mongoose from "mongoose";
import { Coach } from "../../client/models/Coach";
import { Expert } from "../../client/models/ExpertProfile";
import { Venue } from "../../client/models/Venue";
import { User } from "../../client/models/User";
import { AppError } from "../../utils/AppError";

/**
 * Claim fields are the ones an admin reviewed when approving a provider: what
 * they say they coach or have achieved, and where a venue is. After approval an
 * edit to one of them is held as a pending change and the approved value stays
 * live until an admin approves it. Everything else edits freely.
 */
export type ProviderKind = "coach" | "expert" | "venue";

export const CLAIM_FIELDS: Record<ProviderKind, readonly string[]> = {
  coach: ["sports", "certifications"],
  expert: ["sports", "achievements"],
  venue: ["name", "address", "location"],
};

export interface PendingChangesDoc {
  fields: Record<string, unknown>;
  submittedAt: Date;
}

const normalize = (field: string, value: unknown): string => {
  if (Array.isArray(value)) {
    return JSON.stringify(
      value
        .map((v) => String(v).trim())
        .filter(Boolean)
        .sort()
    );
  }
  if (field === "location") {
    const coords = (value as { coordinates?: unknown[] } | undefined)?.coordinates;
    return JSON.stringify((coords || []).map((c) => Number(c)));
  }
  return JSON.stringify(typeof value === "string" ? value.trim() : (value ?? ""));
};

const sameValue = (field: string, a: unknown, b: unknown) =>
  normalize(field, a) === normalize(field, b);

/**
 * Splits an incoming edit into what applies now (`rest`) and the claim-field
 * changes that need review. A claim value equal to the approved one is not a
 * change, and it clears any earlier pending value for that field.
 */
export const reconcileClaimChanges = (
  kind: ProviderKind,
  current: Record<string, unknown>,
  existingPending: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>
): { rest: Record<string, unknown>; pending: Record<string, unknown> | null; changed: boolean } => {
  const rest = { ...incoming };
  const pending = { ...(existingPending || {}) };
  let changed = false;

  for (const field of CLAIM_FIELDS[kind]) {
    if (incoming[field] === undefined) continue;
    delete rest[field];
    if (sameValue(field, incoming[field], current[field])) {
      if (field in pending) {
        delete pending[field];
        changed = true;
      }
    } else {
      pending[field] = incoming[field];
      changed = true;
    }
  }

  return { rest, pending: Object.keys(pending).length ? pending : null, changed };
};

/** The `$set`/`$unset` fragment that stores (or clears) the pending change. */
export const pendingChangesUpdate = (
  pending: Record<string, unknown> | null
): Record<string, unknown> =>
  pending
    ? { $set: { pendingChanges: { fields: pending, submittedAt: new Date() } } }
    : { $unset: { pendingChanges: 1 } };

// ── Admin review ─────────────────────────────────────────────────────────────

const modelFor = (kind: ProviderKind) =>
  kind === "coach" ? Coach : kind === "expert" ? Expert : Venue;

const toId = (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError("Invalid id", 400);
  return new mongoose.Types.ObjectId(id);
};

export const approvePendingChanges = async (kind: ProviderKind, id: string): Promise<void> => {
  const Model = modelFor(kind) as typeof Coach;
  const doc = await Model.findById(toId(id)).select("pendingChanges").lean<{
    pendingChanges?: PendingChangesDoc;
  }>();
  if (!doc) throw new AppError("Not found", 404);
  const fields = doc.pendingChanges?.fields;
  if (!fields || Object.keys(fields).length === 0) {
    throw new AppError("There are no pending changes to approve", 409);
  }

  // Only claim fields can ever be stored as pending; filter again on the way out.
  const set: Record<string, unknown> = {};
  for (const field of CLAIM_FIELDS[kind]) {
    if (fields[field] !== undefined) set[field] = fields[field];
  }
  // An approved expert's sports are what pathway verification checks against.
  if (kind === "expert" && set.sports !== undefined) set.approvedSports = set.sports;

  await Model.updateOne({ _id: toId(id) }, { $set: set, $unset: { pendingChanges: 1 } });
};

export const rejectPendingChanges = async (kind: ProviderKind, id: string): Promise<void> => {
  const Model = modelFor(kind) as typeof Coach;
  const result = await Model.updateOne(
    { _id: toId(id), "pendingChanges.fields": { $exists: true } },
    { $unset: { pendingChanges: 1 } }
  );
  if (result.matchedCount === 0) throw new AppError("There are no pending changes to reject", 409);
};

export interface PendingChangeRow {
  kind: ProviderKind;
  id: string;
  name: string;
  submittedAt: Date | undefined;
  changes: { field: string; current: unknown; proposed: unknown }[];
}

export const listPendingChanges = async (): Promise<PendingChangeRow[]> => {
  const has = { "pendingChanges.fields": { $exists: true } };
  const [coaches, experts, venues] = await Promise.all([
    Coach.find(has).select("userId sports certifications pendingChanges").limit(200).lean(),
    Expert.find(has).select("userId sports achievements pendingChanges").limit(200).lean(),
    Venue.find(has).select("name address location pendingChanges").limit(200).lean(),
  ]);

  const userIds = [...coaches, ...experts].map((d: any) => d.userId).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } })
    .select("name")
    .lean();
  const nameOf = new Map(users.map((u: any) => [String(u._id), u.name as string]));

  const rows = (kind: ProviderKind, docs: any[]): PendingChangeRow[] =>
    docs.map((d) => {
      const fields = (d.pendingChanges?.fields || {}) as Record<string, unknown>;
      return {
        kind,
        id: String(d._id),
        name: kind === "venue" ? d.name : nameOf.get(String(d.userId)) || "Unnamed",
        submittedAt: d.pendingChanges?.submittedAt,
        changes: CLAIM_FIELDS[kind]
          .filter((field) => fields[field] !== undefined)
          .map((field) => ({ field, current: d[field], proposed: fields[field] })),
      };
    });

  return [...rows("coach", coaches), ...rows("expert", experts), ...rows("venue", venues)].sort(
    (a, b) => (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0)
  );
};
