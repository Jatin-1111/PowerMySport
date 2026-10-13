import { DataSourceSubmission } from "../../shared/models/DataSourceSubmission";
import { Opportunity } from "../../shared/models/Opportunity";
import { isSupportedSport, toSupportedSlug } from "../../shared/constants/supportedSports";
import { OPPORTUNITY_TARGET, runOpportunityExtraction } from "./opportunitySourceSubmission";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("opportunity-watch");

// ─── From "this source changed" to "here is what changed" ───────────────────
//
// The weekly watch only knows that a page or file is different. A person then
// had to open the entry, press "Check against a source", wait for the read and
// review the result. This does the first three steps: for each changed source it
// submits the source against every entry that cites it, exactly as that button
// would, so the person opens a finished change list with a quote beside each
// field.
//
// What it never does: publish, edit a live entry, or mark anything verified.
// The result is an ordinary PENDING_REVIEW submission, and approving it is still
// the human step that counts as verification.
//
// Bounded on purpose. Each read is one or two Gemini calls and the daily quota
// is shared with every other extraction, so a run reads at most MAX_PER_RUN
// sources and leaves the rest flagged in "Source changes" for a person.

export const MAX_AUTO_DIFFS_PER_RUN = 6;
/** How long a read still counts as in progress; a read takes seconds to a couple of minutes. */
export const IN_FLIGHT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_SPORT = "tennis";

/**
 * On in production, off everywhere else unless asked for. Local scripts and dev
 * servers run against the same live database (see server/CLAUDE.md), so an
 * unattended Gemini read must be a deliberate choice there, not a side effect of
 * pressing "Check now". `OPPORTUNITY_WATCH_AUTO_DIFF=false` switches it off in
 * production too.
 */
export const autoDiffEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const flag = env.OPPORTUNITY_WATCH_AUTO_DIFF;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return env.NODE_ENV === "production";
};

export interface ChangedSource {
  url: string;
  changeKind: "documents" | "text" | "file";
  entries: Array<{ slug: string }>;
}

export interface AutoDiffSummary {
  created: number;
  /** Already waiting for review, or the entry is gone. */
  skipped: number;
  /** Read, but nothing usable came out; no record is kept. */
  unreadable: number;
  /** Changed sources left for a person because the per-run cap was reached. */
  deferred: number;
}

const labelFor = (url: string): string => {
  try {
    return `Changed source: ${new URL(url).hostname.replace(/^www\./, "")}`.slice(0, 160);
  } catch {
    return "Changed source";
  }
};

export async function createAutoDiffs(
  changed: ChangedSource[],
  deps: {
    max?: number;
    /** Reads the submission's source and stores the result. Replaced in tests. */
    read?: (submission: InstanceType<typeof DataSourceSubmission>) => Promise<void>;
  } = {}
): Promise<AutoDiffSummary> {
  const max = deps.max ?? MAX_AUTO_DIFFS_PER_RUN;
  const read =
    deps.read ?? ((submission) => runOpportunityExtraction(submission, { notify: false }));
  const summary: AutoDiffSummary = { created: 0, skipped: 0, unreadable: 0, deferred: 0 };

  for (const source of changed) {
    for (const { slug } of source.entries) {
      const entry = await Opportunity.findOne({ slug }).select("slug track sports").lean();
      if (!entry) {
        summary.skipped += 1;
        continue;
      }

      // One change list per source and entry at a time: a person has not yet
      // reviewed the last one, and a second would only repeat it.
      // A read that began long ago and never finished (the server died mid-read)
      // is not "waiting": nobody can see it to review, so it would block this
      // source and entry for good.
      const waiting = await DataSourceSubmission.exists({
        targetType: OPPORTUNITY_TARGET,
        opportunitySlug: entry.slug,
        sourceUrl: source.url,
        $or: [
          { status: "PENDING_REVIEW" },
          {
            status: "PENDING_EXTRACTION",
            createdAt: { $gte: new Date(Date.now() - IN_FLIGHT_WINDOW_MS) },
          },
        ],
      });
      if (waiting) {
        summary.skipped += 1;
        continue;
      }

      if (summary.created + summary.unreadable >= max) {
        summary.deferred += 1;
        continue;
      }

      const sport = entry.sports?.[0] ?? DEFAULT_SPORT;
      const submission = await DataSourceSubmission.create({
        targetType: OPPORTUNITY_TARGET,
        sportSlug: toSupportedSlug(isSupportedSport(sport) ? sport : DEFAULT_SPORT),
        opportunitySlug: entry.slug,
        opportunityTrack: entry.track,
        sourceLabel: labelFor(source.url),
        sourceKind: "LINK",
        sourceUrl: source.url,
        status: "PENDING_EXTRACTION",
        autoDetected: true,
        detectedChange: source.changeKind,
      });

      try {
        await read(submission);
      } catch (error) {
        log.error(`Auto-diff of ${source.url} for ${entry.slug} failed:`, error);
        submission.status = "EXTRACTION_FAILED";
      }

      if (submission.status === "PENDING_REVIEW") {
        summary.created += 1;
      } else {
        // A read that came to nothing is not worth a person's attention: the
        // source stays flagged under "Source changes" and can be read by hand.
        await DataSourceSubmission.deleteOne({ _id: submission._id });
        summary.unreadable += 1;
      }
    }
  }

  log.info("Auto-diff finished", summary);
  return summary;
}
