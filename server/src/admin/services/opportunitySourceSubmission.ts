import { DataSourceSubmission } from "../../shared/models/DataSourceSubmission";
import { Opportunity } from "../../shared/models/Opportunity";
import { extractOpportunityForSubmission } from "./dataSourceExtraction/opportunity";
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
  options: { notify?: boolean } = {}
): Promise<void> {
  const entry = submission.opportunitySlug
    ? await Opportunity.findOne({ slug: submission.opportunitySlug }).select("title owner").lean()
    : null;
  const result = await extractOpportunityForSubmission(submission, entry?.title, {
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
  if (result.status === "PENDING_REVIEW" && options.notify !== false) {
    void notifyEditors(submission);
  }
}
