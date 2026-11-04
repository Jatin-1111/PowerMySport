import mongoose from "mongoose";

import type { DataSourceSubmission } from "../../shared/models/DataSourceSubmission";
import { Opportunity } from "../../shared/models/Opportunity";
import {
  parseOpportunity,
  parseOpportunityDraft,
  todayInIndia,
} from "../../shared/validation/opportunityFormat";
import { sourcesToCite, type DocumentRecord } from "./dataSourceExtraction/multiDocument";
import { recordAuditLog } from "./AuditLogService";
import { revalidateOpportunities } from "./ClientCacheRevalidationService";
import { applyChanges, proposedChanges, withSource } from "./opportunitySourceMerge";
import { uniqueSlug } from "./opportunitySlug";
import { acknowledgeWatchUrls } from "./opportunityWatch";

// ─── Writing a reviewed reading into an entry ───────────────────────────────
//
// What "approve" does, for a person pressing the button and for the AI approver
// (opportunityAutoApprover.ts) alike, so the two can never drift apart: the same
// merge, the same citation of sources, the same validation, the same verification
// stamp. Only who is recorded as having decided differs.
//
// Approving counts as verification (an explicit product decision): the reviewer
// checked each kept field against its quote. For the AI approver that claim is
// earned by the approval rules, not by a person, and the record says so.

type Submission = InstanceType<typeof DataSourceSubmission>;

export interface ApprovalActor {
  /** The admin who pressed it, or SYSTEM_ACTOR_ID for the AI approver. */
  id: string;
  email: string;
  /** True when no person decided: the AI approver acted under its rules. */
  automatic: boolean;
}

/** Audit entries need an admin id; the AI approver uses this one, which belongs to no account. */
export const SYSTEM_ACTOR_ID = "000000000000000000000a11";
export const SYSTEM_ACTOR: ApprovalActor = {
  id: SYSTEM_ACTOR_ID,
  email: "auto-approver@powermysport.com",
  automatic: true,
};

export type ApprovalResult =
  | {
      ok: true;
      savedId: string;
      /** Whether an existing entry was changed (as opposed to a new one made). */
      wasLive: boolean;
      kept: number;
      proposed: number;
      /** The entry as it was before this, for putting it back. Null for a new entry. */
      before: Record<string, unknown> | null;
    }
  | { ok: false; status: number; message: string; errors?: string[] };

const plain = (value: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;

/**
 * Write the kept rows of a reading into its entry (or a new one), cite its
 * sources, mark it verified today, and record the decision. `requested` is the
 * change paths to keep, or "all" for every proposed change.
 */
export async function approveSubmission(
  submission: Submission,
  requested: string[] | "all",
  actor: ApprovalActor
): Promise<ApprovalResult> {
  if (submission.status !== "PENDING_REVIEW") {
    return {
      ok: false,
      status: 400,
      message: `This source is ${submission.status.toLowerCase()}, not waiting for review.`,
    };
  }

  const doc = submission.opportunitySlug
    ? await Opportunity.findOne({ slug: submission.opportunitySlug })
    : null;
  if (submission.opportunitySlug && !doc) {
    return {
      ok: false,
      status: 404,
      message: "The entry this source was for no longer exists.",
    };
  }

  const current = doc ? plain(doc.toObject()) : null;
  const before = current ? plain(current) : null;
  const extracted = plain(submission.extractedData);
  const changes = proposedChanges(current, extracted);
  const keep = new Set(
    requested === "all"
      ? changes.map((change) => change.path)
      : requested.filter((path) => changes.some((change) => change.path === path))
  );

  const merged = applyChanges(current, changes, keep);
  const sourceUrl = submission.originUrl || submission.sourceUrl;
  if (!sourceUrl) {
    return { ok: false, status: 400, message: "This source has no public link to cite." };
  }
  const publishedOn =
    typeof extracted.sourcePublishedOn === "string" ? extracted.sourcePublishedOn : undefined;
  // Cite what the kept fields came from. A single-source reading cites its one
  // source; one that read several cites each document that supplied a kept field.
  const records = (submission.documents as DocumentRecord[] | undefined) ?? [];
  // With several sources the merged date is the newest document's, which says
  // nothing about the page; the page's own date, if it printed one, is in its record.
  const ownRecord = records.find((record) => record.url === sourceUrl);
  const citeAs = sourcesToCite(
    records,
    (submission.fieldSources as Record<string, string> | undefined) ?? {},
    keep,
    {
      label: submission.sourceLabel || "Official source",
      url: sourceUrl,
      publishedOn: ownRecord ? ownRecord.sourcePublishedOn : publishedOn,
    }
  );
  let citedSources = merged.sources as
    Array<{ label: string; url: string; publishedOn?: string }> | undefined;
  // Oldest first, so the newest ends up at the top, as one source does.
  for (const source of [...citeAs].reverse()) citedSources = withSource(citedSources, source);
  merged.sources = citedSources;
  // Approval counts as verification: the reviewer checked each kept field against
  // its quote, and confirmed the rest did not change.
  merged.lastVerifiedOn = todayInIndia();

  if (!doc) {
    if (typeof merged.title !== "string" || !merged.category) {
      return {
        ok: false,
        status: 400,
        message: "Keep a title and a section (or set them) before approving a new entry.",
      };
    }
    merged.track = submission.opportunityTrack ?? "scholarship";
    merged.slug = await uniqueSlug(merged.title);
  }

  const isPublished = doc?.status === "published";
  const {
    _id: _ignoredId,
    status: _ignoredStatus,
    publishedAt: _ignoredPublishedAt,
    createdAt: _ignoredCreatedAt,
    updatedAt: _ignoredUpdatedAt,
    updatedBy: _ignoredUpdatedBy,
    __v: _ignoredVersion,
    ...fields
  } = merged;
  const parsed = isPublished ? parseOpportunity(fields) : parseOpportunityDraft(fields);
  if (!parsed.ok) {
    return {
      ok: false,
      status: 400,
      message: isPublished
        ? "The live entry would no longer be complete with these changes."
        : "The entry would not be valid with these changes.",
      errors: parsed.errors,
    };
  }

  const updatedBy = actor.automatic ? {} : { updatedBy: actor.id };
  let savedId: string;
  if (doc) {
    doc.overwrite({
      ...parsed.value,
      status: doc.status,
      publishedAt: doc.publishedAt ?? null,
      createdAt: doc.createdAt,
      ...updatedBy,
    } as never);
    await doc.save();
    savedId = String(doc._id);
  } else {
    const created = await Opportunity.create({
      ...parsed.value,
      status: "draft",
      ...updatedBy,
    } as Record<string, unknown>);
    savedId = String(created._id);
  }

  // Reviewing this entry against a source answers whatever the weekly watch
  // flagged on its links, so those flags are cleared with the approval.
  const saved = await Opportunity.findById(savedId).select("sources.url watchUrls").lean();
  await acknowledgeWatchUrls([
    ...(saved?.sources ?? []).map((s) => s.url),
    ...(saved?.watchUrls ?? []),
  ]);

  submission.status = "APPROVED";
  submission.reviewedAt = new Date();
  if (!actor.automatic) {
    submission.reviewedBy = actor.id as unknown as mongoose.Types.ObjectId;
  }
  submission.reviewNotes = actor.automatic
    ? `Approved automatically under the approval rules: kept ${keep.size} of ${changes.length} proposed change(s).`
    : `Kept ${keep.size} of ${changes.length} proposed change(s).`;
  await submission.save();

  void recordAuditLog({
    adminId: actor.id,
    adminEmail: actor.email,
    action: actor.automatic ? "opportunity-source.auto-approve" : "opportunity-source.approve",
    targetType: "Opportunity",
    targetId: savedId,
    metadata: { submissionId: String(submission._id), kept: [...keep], proposed: changes.length },
  });
  if (isPublished) revalidateOpportunities();

  return {
    ok: true,
    savedId,
    wasLive: Boolean(doc),
    kept: keep.size,
    proposed: changes.length,
    before,
  };
}
