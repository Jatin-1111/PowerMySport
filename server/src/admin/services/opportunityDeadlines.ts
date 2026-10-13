import { Opportunity } from "../../shared/models/Opportunity";
import { STALE_AFTER_DAYS, todayInIndia } from "../../shared/validation/opportunityFormat";
import { getAdminsWithPermission, resolveAdminAppUrl } from "./AdminService";
import { sendOpportunityDeadlinesDigestEmail } from "../../utils/email";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("opportunity-deadlines");

// ─── What is coming due, and what has gone quiet ────────────────────────────
//
// No AI and nothing stored: the dates an entry already carries, read against
// today's date, once a week. It answers the two questions an editor otherwise
// has to remember to ask: "which windows are about to open or close, so the page
// parents see is right?" and "which entries are due a check?".
//
// Only published entries are reported on. A draft is not in front of a parent,
// so a date on it is not urgent; the one thing said about drafts is how many
// have never been verified. A week with nothing to say sends nothing.

export const CLOSING_WITHIN_DAYS = 14;
export const OPENING_WITHIN_DAYS = 14;
export const KEY_DATE_WITHIN_DAYS = 7;
/** A window that closed longer ago than this is taken to be left closed on purpose. */
export const CLOSED_LIVE_WITHIN_DAYS = 45;
/** Entries whose verification will go stale within this many days are listed as due soon. */
export const CHECK_DUE_WITHIN_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whole days from `from` to `to`, both "YYYY-MM-DD". Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

const validDate = (value: string | null | undefined): value is string =>
  typeof value === "string" && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));

export interface DeadlineEntry {
  _id: unknown;
  slug: string;
  title: string;
  status: "draft" | "published";
  lastVerifiedOn?: string | null;
  cycle?: {
    opensOn?: string | null;
    closesOn?: string | null;
    keyDates?: Array<{ label: string; date: string }> | null;
  } | null;
}

export interface DueItem {
  id: string;
  title: string;
  /** The date this item is about. */
  date: string;
  /** Days from today: 0 is today, negative is in the past. */
  days: number;
  /** For a key date, what happens on it. */
  label?: string;
}

export interface DeadlineReport {
  closingSoon: DueItem[];
  openingSoon: DueItem[];
  keyDates: DueItem[];
  closedButLive: DueItem[];
  /** Live entries whose last verification is already over a year old. */
  checkOverdue: DueItem[];
  /** Live entries that will pass a year in the next CHECK_DUE_WITHIN_DAYS. */
  checkDueSoon: DueItem[];
  neverVerifiedDrafts: number;
}

export const reportIsEmpty = (r: DeadlineReport): boolean =>
  r.closingSoon.length === 0 &&
  r.openingSoon.length === 0 &&
  r.keyDates.length === 0 &&
  r.closedButLive.length === 0 &&
  r.checkOverdue.length === 0 &&
  r.checkDueSoon.length === 0;

/** Pure: entries and today's date in, the week's report out. */
export function buildDeadlineReport(entries: DeadlineEntry[], today: string): DeadlineReport {
  const report: DeadlineReport = {
    closingSoon: [],
    openingSoon: [],
    keyDates: [],
    closedButLive: [],
    checkOverdue: [],
    checkDueSoon: [],
    neverVerifiedDrafts: 0,
  };
  const byDate = (a: DueItem, b: DueItem) => a.days - b.days || a.title.localeCompare(b.title);

  for (const entry of entries) {
    const id = String(entry._id);

    if (entry.status !== "published") {
      if (!entry.lastVerifiedOn) report.neverVerifiedDrafts += 1;
      continue;
    }

    const opensOn = entry.cycle?.opensOn;
    const closesOn = entry.cycle?.closesOn;
    if (validDate(closesOn)) {
      const days = daysBetween(today, closesOn);
      const item = { id, title: entry.title, date: closesOn, days };
      if (days >= 0 && days <= CLOSING_WITHIN_DAYS) report.closingSoon.push(item);
      else if (days < 0 && -days <= CLOSED_LIVE_WITHIN_DAYS) report.closedButLive.push(item);
    }
    if (validDate(opensOn)) {
      const days = daysBetween(today, opensOn);
      if (days >= 0 && days <= OPENING_WITHIN_DAYS) {
        report.openingSoon.push({ id, title: entry.title, date: opensOn, days });
      }
    }
    for (const keyDate of entry.cycle?.keyDates ?? []) {
      if (!validDate(keyDate.date)) continue;
      const days = daysBetween(today, keyDate.date);
      if (days >= 0 && days <= KEY_DATE_WITHIN_DAYS) {
        report.keyDates.push({
          id,
          title: entry.title,
          date: keyDate.date,
          days,
          label: keyDate.label,
        });
      }
    }

    if (validDate(entry.lastVerifiedOn)) {
      const age = daysBetween(entry.lastVerifiedOn, today);
      // Same bar as the admin's "check due" tag: over STALE_AFTER_DAYS is overdue.
      if (age > STALE_AFTER_DAYS) {
        report.checkOverdue.push({
          id,
          title: entry.title,
          date: entry.lastVerifiedOn,
          days: -(age - STALE_AFTER_DAYS),
        });
      } else if (STALE_AFTER_DAYS - age <= CHECK_DUE_WITHIN_DAYS) {
        report.checkDueSoon.push({
          id,
          title: entry.title,
          date: entry.lastVerifiedOn,
          days: STALE_AFTER_DAYS - age,
        });
      }
    }
  }

  report.closingSoon.sort(byDate);
  report.openingSoon.sort(byDate);
  report.keyDates.sort(byDate);
  report.closedButLive.sort((a, b) => b.days - a.days || a.title.localeCompare(b.title));
  report.checkOverdue.sort((a, b) => a.days - b.days || a.title.localeCompare(b.title));
  report.checkDueSoon.sort(byDate);
  return report;
}

// ─── The weekly run ──────────────────────────────────────────────────────────

export interface DeadlineDigestSummary {
  sent: boolean;
  recipients: number;
  report: DeadlineReport;
}

export async function runDeadlineDigest(
  deps: {
    today?: string;
    recipients?: () => Promise<Array<{ email: string; name: string }>>;
    send?: typeof sendOpportunityDeadlinesDigestEmail;
  } = {}
): Promise<DeadlineDigestSummary> {
  const today = deps.today ?? todayInIndia();
  const entries = await Opportunity.find({})
    .select("slug title status lastVerifiedOn cycle")
    .lean<DeadlineEntry[]>();
  const report = buildDeadlineReport(entries, today);

  if (reportIsEmpty(report)) {
    log.info("Deadline digest: nothing to report this week");
    return { sent: false, recipients: 0, report };
  }

  const recipients = await (
    deps.recipients ?? (() => getAdminsWithPermission("opportunities:manage"))
  )();
  const send = deps.send ?? sendOpportunityDeadlinesDigestEmail;
  const reviewUrl = `${resolveAdminAppUrl()}/admin/opportunities`;
  let delivered = 0;
  for (const admin of recipients) {
    try {
      await send({ to: admin.email, name: admin.name, report, reviewUrl, today });
      delivered += 1;
    } catch (error) {
      log.error(`Could not email the deadline digest to ${admin.email}:`, error);
    }
  }
  log.info("Deadline digest sent", { recipients: delivered });
  return { sent: delivered > 0, recipients: delivered, report };
}
