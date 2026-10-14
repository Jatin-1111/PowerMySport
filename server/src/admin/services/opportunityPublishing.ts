import type mongoose from "mongoose";

import { Opportunity } from "../../shared/models/Opportunity";
import { parseOpportunity, todayInIndia } from "../../shared/validation/opportunityFormat";
import { recordAuditLog } from "./AuditLogService";
import { revalidateOpportunities } from "./ClientCacheRevalidationService";
import {
  checkOpportunityOffline,
  type CheckableEntry,
  type Finding,
} from "./opportunityPublishCheck";
import type { ApprovalActor } from "./opportunitySourceApproval";

// ─── The gate between a draft and a parent ──────────────────────────────────
//
// One definition of "ready to publish", used by the Publish button and by the AI
// approver, so there is no second, looser way onto the public pages. An entry is
// ready when it parses as a whole publishable record and the offline plausibility
// check finds no "problem" (a record that cannot be right). Warnings and notes are
// passed back and never block.

/** What a save may not carry into the schema: system fields the schema does not own. */
const stripSystemFields = (doc: Record<string, unknown>): Record<string, unknown> => {
  const {
    _id: _id,
    status: _status,
    publishedAt: _publishedAt,
    updatedBy: _updatedBy,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    __v: _version,
    cycleState: _cycleState,
    stale: _stale,
    ...rest
  } = doc;
  return rest;
};

export type PublishCheck =
  { ok: true; findings: Finding[] } | { ok: false; errors: string[]; findings: Finding[] };

export async function checkPublishable(doc: {
  _id: mongoose.Types.ObjectId;
  toObject: () => unknown;
}): Promise<PublishCheck> {
  // Round-tripped so Mongoose's subdocument wrappers become the plain objects
  // the schema expects.
  const plain = JSON.parse(JSON.stringify(doc.toObject())) as Record<string, unknown>;
  const check = parseOpportunity(stripSystemFields(plain));
  if (!check.ok) return { ok: false, errors: check.errors, findings: [] };

  const others = await Opportunity.find({ _id: { $ne: doc._id } })
    .select("slug title")
    .lean();
  const findings = checkOpportunityOffline(plain as CheckableEntry, todayInIndia(), others);
  const problems = findings.filter((finding) => finding.severity === "problem");
  if (problems.length > 0) {
    return { ok: false, errors: problems.map((finding) => finding.message), findings };
  }
  return { ok: true, findings };
}

/** Publish an entry that has passed the gate. Returns the check so the caller can report it. */
export async function publishEntry(
  id: string,
  actor: ApprovalActor
): Promise<PublishCheck & { slug?: string }> {
  const doc = await Opportunity.findById(id);
  if (!doc) return { ok: false, errors: ["No entry with that id."], findings: [] };
  const check = await checkPublishable(doc);
  if (!check.ok) return check;

  doc.status = "published";
  doc.publishedAt = new Date();
  await doc.save();

  void recordAuditLog({
    adminId: actor.id,
    adminEmail: actor.email,
    action: actor.automatic ? "opportunity.auto-publish" : "opportunity.publish",
    targetType: "Opportunity",
    targetId: String(doc._id),
    metadata: { slug: doc.slug },
  });
  revalidateOpportunities();
  return { ...check, slug: doc.slug };
}
