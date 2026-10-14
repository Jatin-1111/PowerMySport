import { DataSourceSubmission } from "../../shared/models/DataSourceSubmission";
import { Opportunity } from "../../shared/models/Opportunity";
import { extractOpportunityForSubmission } from "./dataSourceExtraction/opportunity";
import { createDraftFromSubmission } from "./opportunityAutoDraft";
import { getAdminsWithPermission, resolveAdminAppUrl } from "./AdminService";
import { sendDataSourceReadyForReviewEmail } from "../../utils/email";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("opportunity-sources");

// ─── Reading a submitted source ─────────────────────────────────────────────
//
// Shared by the admin route that a person uses to submit a link or PDF, and by
// the weekly watch, which submits a source on its own when a page it watches
// has changed. Both end in the same place: a PENDING_REVIEW record whose every
// field a person checks against its quote before anything is published.

export const OPPORTUNITY_TARGET = "OPPORTUNITY" as const;

async function notifyEditors(submission: { _id: unknown; sportSlug: string }): Promise<void> {
  try {
    const editors = await getAdminsWithPermission("opportunities:manage");
    const reviewUrl = `${resolveAdminAppUrl()}/admin/opportunities/sources/${String(submission._id)}`;
    await Promise.all(
      editors.map((admin) =>
        sendDataSourceReadyForReviewEmail({
          to: admin.email,
          name: admin.name,
          sportSlug: submission.sportSlug,
          targetType: OPPORTUNITY_TARGET,
          reviewUrl,
        })
      )
    );
  } catch (error) {
    log.error("Failed to notify admissions & scholarships editors:", error);
  }
}

/**
 * Read it in the background and return at once. For a reading that follows a
 * page's documents, which takes minutes: far longer than a request can be held
 * (the load balancer drops an idle connection after a minute), and the reviewer
 * is told it will appear when it is done. A reading that dies is recorded as
 * failed rather than left "being read" for ever.
 */
export function startOpportunityExtraction(
  submission: InstanceType<typeof DataSourceSubmission>
): void {
  void runOpportunityExtraction(submission).catch(async (error) => {
    log.error("Background reading of a source failed:", error);
    try {
      submission.status = "EXTRACTION_FAILED";
      submission.extractionError = "Reading it failed unexpectedly. Try reading it again.";
      await submission.save();
    } catch (saveError) {
      log.error("Could not record the failed reading:", saveError);
    }
  });
}

/**
 * Read the submission's source, store what came out, and (unless `notify` is
 * false) tell the editors it is ready. The watch passes `notify: false`: its own
 * digest already tells them, and one email per changed source would be noise.
 */
export async function runOpportunityExtraction(
  submission: InstanceType<typeof DataSourceSubmission>,
  options: { notify?: boolean; extract?: typeof extractOpportunityForSubmission } = {}
): Promise<void> {
  const entry = submission.opportunitySlug
    ? await Opportunity.findOne({ slug: submission.opportunitySlug }).select("title owner").lean()
    : null;
  const extract = options.extract ?? extractOpportunityForSubmission;
  // A reading for an existing entry is about that entry. One made from a lead is
  // about the lead: without a name to look for, a page that lists or links several
  // schemes yields whichever the model reads first (a foundation's page for one
  // scholarship returned a different, older one).
  const focus = entry?.title ?? (submission.autoDraft ? submission.sourceLabel : undefined);
  const result = await extract(submission, focus, {
    ownerName: entry?.owner?.name,
  });
  submission.status = result.status;
  submission.extractedData = result.extractedData;
  submission.citations = result.citations;
  submission.citationChecks = result.citationChecks;
  // Cleared when absent, so reading a submission again without documents does not
  // keep what an earlier reading with them found.
  submission.documents = result.documents;
  submission.fieldSources = result.fieldSources;
  submission.conflicts = result.conflicts;
  submission.extractionError = result.extractionError;
  submission.extractionWarnings = result.extractionWarnings;
  submission.extractionModel = result.extractionModel;
  submission.extractedAt = new Date();
  await submission.save();

  // A reading asked to become a draft entry does so as soon as it is read. When it
  // cannot (nothing usable, a duplicate), it stays in the review queue with the
  // reason, and the editors are told as for any other reading.
  let drafted = false;
  if (submission.autoDraft && result.status === "PENDING_REVIEW") {
    const made = await createDraftFromSubmission(submission);
    drafted = made.ok;
    if (!made.ok) {
      submission.reviewNotes = `Could not draft this automatically: ${made.reason}`;
      await submission.save();
    }
  }
  if (result.status === "PENDING_REVIEW" && options.notify !== false && !drafted) {
    void notifyEditors(submission);
  }
}
