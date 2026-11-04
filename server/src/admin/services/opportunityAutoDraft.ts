import mongoose from "mongoose";

import type { DataSourceSubmission } from "../../shared/models/DataSourceSubmission";
import { Opportunity } from "../../shared/models/Opportunity";
import Admin from "../models/Admin";
import { parseOpportunityDraft } from "../../shared/validation/opportunityFormat";
import { log as __rootLog } from "../../utils/logger";
import { sourcesToCite, type DocumentRecord } from "./dataSourceExtraction/multiDocument";
import { staleCycleReason, titleMatchesLead } from "./dataSourceExtraction/opportunityChecks";
import { recordAuditLog } from "./AuditLogService";
import { applyChanges, proposedChanges, withSource } from "./opportunitySourceMerge";
import { uniqueSlug } from "./opportunitySlug";

const log = __rootLog.child("opportunity-auto-draft");

// ─── A draft entry, filled in from a source, with nobody in the loop ────────
//
// What a lead becomes when an editor presses "Draft it": the source is read, and
// what it said is written straight into a new DRAFT entry, so the editor opens an
// entry that is already populated instead of building one from a review screen.
//
// What this deliberately does not do:
//   - Publish. A draft is not in front of a parent, and publishing is still the
//     separate, checked step it always was.
//   - Mark the entry verified. `lastVerifiedOn` is left empty, because nobody has
//     checked a thing. Approving a review counts as verification (the reviewer
//     checked each kept field against its quote); this has no reviewer, so it
//     cannot claim that. An editor checks the fields, then presses "Mark verified".
//
// The evidence is not lost: the submission stays, marked as drafted automatically,
// and its review page shows every field with the quote it came from.
//
// When a draft cannot be made safely (no title or section was read, the fields do
// not validate, an entry with this title already exists), nothing is created and
// the reading is left in the ordinary review queue with the reason.

export type AutoDraftResult =
  { ok: true; slug: string; id: string } | { ok: false; reason: string };

const plain = (value: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;

const norm = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export async function createDraftFromSubmission(
  submission: InstanceType<typeof DataSourceSubmission>
): Promise<AutoDraftResult> {
  const extracted = plain(submission.extractedData);
  const changes = proposedChanges(null, extracted);
  const keep = new Set(changes.map((change) => change.path));
  const merged = applyChanges(null, changes, keep);

  const title = typeof merged.title === "string" ? merged.title.trim() : "";
  if (!title || !merged.category) {
    return { ok: false, reason: "No title or section could be read from the source." };
  }

  const sourceUrl = submission.originUrl || submission.sourceUrl;
  if (!sourceUrl) return { ok: false, reason: "The source has no public link to cite." };

  // Is this the scheme the lead was about? The lead's name is what the editor chose
  // to draft; a reading that came back as something else is not that.
  if (submission.sourceLabel && !titleMatchesLead(submission.sourceLabel, title)) {
    return {
      ok: false,
      reason: `The source describes "${title}", which does not match the lead "${submission.sourceLabel}".`,
    };
  }

  // Rules for a year that is over, from a document years old, are not a draft to
  // hand an editor as if it were current.
  const cycle = merged.cycle as { label?: string } | undefined;
  const stale = staleCycleReason(
    cycle?.label,
    typeof extracted.sourcePublishedOn === "string" ? extracted.sourcePublishedOn : undefined
  );
  if (stale) return { ok: false, reason: stale };

  // The same title as an entry we already have is a duplicate, not a new entry.
  const existing = await Opportunity.find({}).select("title").lean();
  const twin = existing.find((entry) => norm(entry.title) === norm(title));
  if (twin) {
    return { ok: false, reason: `An entry called "${twin.title}" already exists.` };
  }

  // Cite what the fields came from, as approving a review does.
  const records = (submission.documents as DocumentRecord[] | undefined) ?? [];
  const publishedOn =
    typeof extracted.sourcePublishedOn === "string" ? extracted.sourcePublishedOn : undefined;
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
  let cited: Array<{ label: string; url: string; publishedOn?: string }> | undefined;
  for (const source of [...citeAs].reverse()) cited = withSource(cited, source);

  const fields: Record<string, unknown> = {
    ...merged,
    sources: cited,
    track: submission.opportunityTrack ?? "scholarship",
    slug: await uniqueSlug(title),
  };
  delete fields.sourcePublishedOn;
  // Not verified: see the note at the top of this file.
  delete fields.lastVerifiedOn;

  const parsed = parseOpportunityDraft(fields);
  if (!parsed.ok) {
    return { ok: false, reason: `It would not be a valid entry: ${parsed.errors.join("; ")}` };
  }

  const created = await Opportunity.create({
    ...parsed.value,
    status: "draft",
    ...(submission.submittedBy ? { updatedBy: submission.submittedBy } : {}),
  } as Record<string, unknown>);

  submission.status = "APPROVED";
  submission.autoDraft = true;
  submission.draftedSlug = created.slug;
  submission.reviewNotes = "Drafted automatically. Nobody has checked it yet.";
  await submission.save();

  if (submission.submittedBy) {
    // The audit log names who the action was for: the editor who pressed "Draft it".
    const editor = await Admin.findById(submission.submittedBy).select("email").lean();
    void recordAuditLog({
      adminId: String(submission.submittedBy),
      adminEmail: editor?.email || "unknown",
      action: "opportunity-source.auto-draft",
      targetType: "Opportunity",
      targetId: String(created._id),
      metadata: { submissionId: String(submission._id), fields: [...keep] },
    });
  }
  log.info(`Drafted "${created.slug}" from submission ${String(submission._id)}`);
  return { ok: true, slug: created.slug, id: String(created._id as mongoose.Types.ObjectId) };
}
