import { DataSourceSubmission } from "../../shared/models/DataSourceSubmission";
import { OpportunityLead } from "../../shared/models/OpportunityLead";
import { isSupportedSport, toSupportedSlug } from "../../shared/constants/supportedSports";
import { AppError } from "../../utils/AppError";
import { OPPORTUNITY_TARGET, startOpportunityExtraction } from "./opportunitySourceSubmission";

// ─── "Draft it": one press from a lead to a populated draft entry ────────────
//
// Reading a lead used to be a form (which sport, what to call the document, which
// link) followed by a review. This does the form's job from what the lead already
// knows, reads the page and the documents it links to, and leaves the result as a
// draft entry (opportunityAutoDraft.ts). It answers at once; the reading takes a
// few minutes in the background.
//
// It refuses where a person should look first:
//   - a lead triage thinks we already cover, unless the editor says to go on, so a
//     second entry for the same scheme is a choice and not an accident;
//   - an aggregator with no official page found, because an aggregator is never the
//     source to cite;
//   - a lead already read or dismissed.

const DEFAULT_SPORT = "tennis";

export interface LeadDraftDeps {
  /** Starts the background reading. Replaced in tests, which must not call a model. */
  start: (submission: InstanceType<typeof DataSourceSubmission>) => void;
}

export async function draftFromLead(
  leadId: string,
  adminId: string,
  options: { force?: boolean } = {},
  deps: LeadDraftDeps = { start: startOpportunityExtraction }
): Promise<InstanceType<typeof DataSourceSubmission>> {
  const lead = await OpportunityLead.findById(leadId);
  if (!lead) throw new AppError("Not found.", 404);
  if (lead.status === "read") throw new AppError("This lead has already been read.", 409);
  if (lead.status === "dismissed") {
    throw new AppError("This lead was dismissed. Restore it first.", 409);
  }

  const twin = lead.triage?.possibleDuplicateOf;
  if (twin && !options.force) {
    throw new AppError(
      `This looks like "${twin.title}", which we already have. Check that entry against it instead, or draft it anyway.`,
      409
    );
  }

  const url = lead.isAggregator ? lead.triage?.officialUrl : lead.url;
  if (!url) {
    throw new AppError(
      "This is an aggregator page and no official page was found for it. Use Read it with the official link.",
      400
    );
  }

  const sportSlug =
    lead.sportSlug && isSupportedSport(lead.sportSlug) ? lead.sportSlug : DEFAULT_SPORT;

  const submission = await DataSourceSubmission.create({
    targetType: OPPORTUNITY_TARGET,
    sportSlug: toSupportedSlug(sportSlug),
    opportunityTrack: lead.track,
    sourceLabel: lead.name,
    sourceKind: "LINK",
    sourceUrl: url,
    followDocuments: true,
    autoDraft: true,
    status: "PENDING_EXTRACTION",
    submittedBy: adminId,
  });

  await OpportunityLead.updateOne(
    { _id: lead._id },
    { $set: { status: "read", submissionId: submission._id } }
  );

  deps.start(submission);
  return submission;
}
