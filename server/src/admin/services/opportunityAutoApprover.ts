import { DataSourceSubmission } from "../../shared/models/DataSourceSubmission";
import { Opportunity } from "../../shared/models/Opportunity";
import { todayInIndia } from "../../shared/validation/opportunityFormat";
import { log as __rootLog } from "../../utils/logger";
import { recordAuditLog } from "./AuditLogService";
import { revalidateOpportunities } from "./ClientCacheRevalidationService";
import { assessSubmission, type Assessment } from "./opportunityApprovalAssessment";
import { publishEntry } from "./opportunityPublishing";
import { approveSubmission, SYSTEM_ACTOR } from "./opportunitySourceApproval";

const log = __rootLog.child("opportunity-auto-approver");

type Submission = InstanceType<typeof DataSourceSubmission>;

// ─── The AI approver ─────────────────────────────────────────────────────────
//
// When a reading is done, it is put in front of the approval rules
// (opportunityApprovalPolicy.ts). A reading that satisfies every rule is approved
// and, for a new entry, published, without anyone looking at it; one that fails any
// rule stays in the queue for a person, with the rule that held it.
//
// It is switched on explicitly (OPPORTUNITY_AUTO_APPROVE=on) and OFF otherwise,
// everywhere, so deploying this changes nothing until someone decides it should.
// While off it still records what it WOULD have done on every reading, so the
// decision to switch it on can be made by comparing those verdicts with what
// editors actually did.
//
// Every action is a record on the submission (`autoApproval`), an audit-log entry
// under the AI approver, and reversible: the entry as it was is kept, and "revert"
// puts it back and hands the reading to a person. A daily cap bounds how much it can
// do before someone looks, and OPPORTUNITY_AUTO_APPROVE_DISABLED=true stops it at once.

export type AutoAction =
  /** Failed a rule: left for a person. */
  | "held"
  /** Passed every rule, but automatic approval is off: this is what it would have done. */
  | "off"
  /** Passed, but today's cap on automatic approvals was reached. */
  | "capped"
  /** Wrote a change into a live entry, or made a verified draft that was not published. */
  | "approved"
  /** The source confirmed a live entry as it is: only the verification date moved. */
  | "reverified"
  /** Made (or verified) a new entry and put it on the public pages. */
  | "published"
  /** Something went wrong while acting; nothing was left half-done. */
  | "failed";

export const ACTED: readonly AutoAction[] = ["approved", "reverified", "published"];

export interface AutoApprovalRecord {
  assessedAt: Date;
  pass: boolean;
  failed: string[];
  kind: "update" | "new";
  unchanged: boolean;
  rows: number;
  action: AutoAction;
  actedAt?: Date;
  /** The entry the action was on. */
  entryId?: string;
  /** The entry as it was before the action, for putting it back. Null for a new entry. */
  before?: Record<string, unknown> | null;
  reason?: string;
  revertedAt?: Date;
  revertedBy?: string;
}

export const autoApproveEnabled = (): boolean =>
  process.env.OPPORTUNITY_AUTO_APPROVE === "on" &&
  process.env.OPPORTUNITY_AUTO_APPROVE_DISABLED !== "true";

export const dailyCap = (): number => {
  const configured = Number(process.env.OPPORTUNITY_AUTO_APPROVE_DAILY_CAP);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 10;
};

/** The start of today in India, the day the cap is counted over. */
const startOfIndianDay = (now: Date): Date => new Date(`${todayInIndia(now)}T00:00:00+05:30`);

const plain = (value: unknown): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;

export async function actedToday(now: Date = new Date()): Promise<number> {
  return DataSourceSubmission.countDocuments({
    "autoApproval.action": { $in: ACTED },
    "autoApproval.actedAt": { $gte: startOfIndianDay(now) },
    "autoApproval.revertedAt": { $exists: false },
  });
}

const record = (assessment: Assessment, action: AutoAction, now: Date): AutoApprovalRecord => ({
  assessedAt: now,
  pass: assessment.pass,
  failed: assessment.failed,
  kind: assessment.kind,
  unchanged: assessment.unchanged,
  rows: assessment.rows,
  action,
});

async function save(submission: Submission, value: AutoApprovalRecord): Promise<void> {
  submission.set("autoApproval", value);
  submission.markModified("autoApproval");
  await submission.save();
}

/**
 * Judge a finished reading and, if every rule holds and automatic approval is on,
 * act on it. Never throws: whatever happens, the reading is left in a state a person
 * can pick up, with the outcome recorded.
 */
export async function considerAutoApproval(
  submission: Submission,
  now: Date = new Date()
): Promise<AutoApprovalRecord | null> {
  // A reading someone reverted is the editors' now. Reading it again must not undo that.
  const existing = submission.get("autoApproval") as AutoApprovalRecord | undefined;
  if (existing?.revertedAt) return existing;

  let assessment: Assessment | null;
  try {
    assessment = await assessSubmission(submission, now);
  } catch (error) {
    log.error("Could not assess a reading:", error);
    return null;
  }
  if (!assessment) return null;

  const base = record(assessment, assessment.pass ? "off" : "held", now);
  if (!assessment.pass) {
    await save(submission, base).catch((error) => log.error("Could not record a verdict:", error));
    return base;
  }
  if (!autoApproveEnabled()) {
    await save(submission, base).catch((error) => log.error("Could not record a verdict:", error));
    return base;
  }
  if ((await actedToday(now)) >= dailyCap()) {
    const capped = {
      ...base,
      action: "capped" as const,
      reason: `Today's limit of ${dailyCap()} was reached.`,
    };
    await save(submission, capped).catch((error) =>
      log.error("Could not record a verdict:", error)
    );
    return capped;
  }

  try {
    const acted = await act(submission, assessment, base, now);
    await save(submission, acted);
    return acted;
  } catch (error) {
    log.error("Automatic approval failed:", error);
    const failed = {
      ...base,
      action: "failed" as const,
      reason: error instanceof Error ? error.message : String(error),
    };
    await save(submission, failed).catch((saveError) =>
      log.error("Could not record the failure:", saveError)
    );
    return failed;
  }
}

async function act(
  submission: Submission,
  assessment: Assessment,
  base: AutoApprovalRecord,
  now: Date
): Promise<AutoApprovalRecord> {
  const actedAt = now;

  // A draft made from a lead already holds the reading: verify it, then publish it.
  if (submission.status === "APPROVED" && submission.autoDraft && submission.draftedSlug) {
    const draft = await Opportunity.findOne({ slug: submission.draftedSlug });
    if (!draft) throw new Error("The draft this reading made no longer exists.");
    if (draft.status === "published")
      return { ...base, action: "held", reason: "Already published." };
    const before = plain(draft.toObject());
    draft.lastVerifiedOn = todayInIndia(now);
    await draft.save();
    const published = await publishEntry(String(draft._id), SYSTEM_ACTOR);
    if (!published.ok) {
      // Put it back exactly as it was: a draft that is not verified.
      draft.set("lastVerifiedOn", undefined);
      await draft.save();
      return { ...base, action: "held", reason: published.errors.join("; ") };
    }
    void recordAuditLog({
      adminId: SYSTEM_ACTOR.id,
      adminEmail: SYSTEM_ACTOR.email,
      action: "opportunity.auto-verify",
      targetType: "Opportunity",
      targetId: String(draft._id),
      metadata: { submissionId: String(submission._id) },
    });
    return { ...base, action: "published", actedAt, entryId: String(draft._id), before };
  }

  // A live entry the source confirms as it is: only the verification date moves.
  // Everything else is written through the same path a person's approval takes.
  const result = await approveSubmission(
    submission,
    assessment.unchanged ? [] : "all",
    SYSTEM_ACTOR
  );
  if (!result.ok) {
    return {
      ...base,
      action: "held",
      reason: [result.message, ...(result.errors ?? [])].join(" "),
    };
  }

  if (!result.wasLive) {
    // A new entry: it is now a verified draft. Publish it, or leave it a draft for a person.
    const published = await publishEntry(result.savedId, SYSTEM_ACTOR);
    return published.ok
      ? { ...base, action: "published", actedAt, entryId: result.savedId, before: null }
      : {
          ...base,
          action: "approved",
          actedAt,
          entryId: result.savedId,
          before: null,
          reason: `Made a verified draft but did not publish it: ${published.errors.join("; ")}`,
        };
  }

  revalidateOpportunities();
  return {
    ...base,
    action: assessment.unchanged ? "reverified" : "approved",
    actedAt,
    entryId: result.savedId,
    before: result.before,
  };
}

// ─── Putting it back ─────────────────────────────────────────────────────────

export type RevertResult =
  { ok: true; message: string } | { ok: false; status: number; message: string };

/**
 * Undo an automatic approval and hand the reading to a person. An update is put
 * back to the entry as it was. A new entry is unpublished and its verification
 * removed, but kept as a draft (this never deletes an entry). The reading returns
 * to the review queue, and the AI approver will not act on it again.
 */
export async function revertAutoApproval(
  submission: Submission,
  actor: { id: string; email: string }
): Promise<RevertResult> {
  const value = submission.get("autoApproval") as AutoApprovalRecord | undefined;
  if (!value || !ACTED.includes(value.action) || !value.entryId) {
    return { ok: false, status: 400, message: "The AI approver did not act on this reading." };
  }
  if (value.revertedAt) return { ok: false, status: 409, message: "This was already reverted." };

  const entry = await Opportunity.findById(value.entryId);
  if (!entry) return { ok: false, status: 404, message: "The entry no longer exists." };

  if (value.before) {
    // An update: the entry exactly as it was.
    const { _id: _id, __v: _v, ...restored } = value.before as Record<string, unknown>;
    entry.overwrite(restored as never);
  } else {
    // A new entry: back to an unverified draft.
    entry.status = "draft";
    entry.publishedAt = null;
    entry.set("lastVerifiedOn", undefined);
  }
  await entry.save();
  revalidateOpportunities();

  submission.status = "PENDING_REVIEW";
  submission.reviewNotes = "The automatic approval was reverted. A person needs to decide on this.";
  submission.set("autoApproval", {
    ...value,
    revertedAt: new Date(),
    revertedBy: actor.id,
  });
  submission.markModified("autoApproval");
  await submission.save();

  void recordAuditLog({
    adminId: actor.id,
    adminEmail: actor.email,
    action: "opportunity-source.auto-revert",
    targetType: "Opportunity",
    targetId: value.entryId,
    metadata: { submissionId: String(submission._id), was: value.action },
  });
  return { ok: true, message: "Reverted. The reading is back in the review queue." };
}
