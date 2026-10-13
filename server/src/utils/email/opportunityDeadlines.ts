import { escapeHtml, sendEmail } from "./shared";

interface DueItem {
  id: string;
  title: string;
  date: string;
  days: number;
  label?: string;
}

interface DeadlineReport {
  closingSoon: DueItem[];
  openingSoon: DueItem[];
  keyDates: DueItem[];
  closedButLive: DueItem[];
  checkOverdue: DueItem[];
  checkDueSoon: DueItem[];
  neverVerifiedDrafts: number;
}

interface OpportunityDeadlinesDigestOptions {
  to: string;
  name: string;
  report: DeadlineReport;
  reviewUrl: string;
  today: string;
}

const formatDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** "today", "in 6 days", "3 days ago". */
const when = (days: number): string => {
  if (days === 0) return "today";
  const n = Math.abs(days);
  const unit = n === 1 ? "day" : "days";
  return days > 0 ? `in ${n} ${unit}` : `${n} ${unit} ago`;
};

/**
 * The week's one email about dates: windows about to open or close, and entries
 * due a check. Sent only when there is something in it.
 */
export const sendOpportunityDeadlinesDigestEmail = async (
  options: OpportunityDeadlinesDigestOptions
): Promise<void> => {
  const { report } = options;

  const entryUrl = (id: string) => `${options.reviewUrl}/${encodeURIComponent(id)}`;
  const section = (
    heading: string,
    intro: string,
    items: DueItem[],
    detail: (i: DueItem) => string
  ) =>
    items.length
      ? `<h3 style="margin-bottom: 4px;">${escapeHtml(heading)} (${items.length})</h3>
         <p style="margin-top: 0; color: #555;">${escapeHtml(intro)}</p>
         <ul>${items
           .map(
             (item) =>
               `<li style="margin-bottom: 8px;"><a href="${escapeHtml(entryUrl(item.id))}"><strong>${escapeHtml(item.title)}</strong></a><br/><span style="color: #555;">${escapeHtml(detail(item))}</span></li>`
           )
           .join("")}</ul>`
      : "";

  const counts = [
    report.closingSoon.length && `${report.closingSoon.length} closing`,
    report.openingSoon.length && `${report.openingSoon.length} opening`,
    report.closedButLive.length && `${report.closedButLive.length} closed but live`,
    report.checkOverdue.length + report.checkDueSoon.length &&
      `${report.checkOverdue.length + report.checkDueSoon.length} due a check`,
  ].filter(Boolean);

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="margin-bottom: 4px;">Admissions &amp; scholarships: dates and checks</h2>
  <p>Hi ${escapeHtml(options.name)},</p>
  <p>This is what is coming due on live entries, as of ${escapeHtml(formatDate(options.today))}.</p>
  ${section(
    "Windows closing soon",
    "Parents can see these. Make sure the closing date and the page are right.",
    report.closingSoon,
    (i) => `Closes ${formatDate(i.date)} (${when(i.days)})`
  )}
  ${section(
    "Windows opening soon",
    "Check the opening date and how to apply before they open.",
    report.openingSoon,
    (i) => `Opens ${formatDate(i.date)} (${when(i.days)})`
  )}
  ${section(
    "Key dates this week",
    "Trials, deadlines and other dates entered on the entry.",
    report.keyDates,
    (i) => `${i.label ?? "Key date"}: ${formatDate(i.date)} (${when(i.days)})`
  )}
  ${section(
    "Window closed, still live",
    "The window closed recently and the entry is still published. Add the next cycle's dates, or unpublish it.",
    report.closedButLive,
    (i) => `Closed ${formatDate(i.date)} (${when(i.days)})`
  )}
  ${section(
    "Overdue for a check",
    "Last verified over a year ago. Parents are shown this date.",
    report.checkOverdue,
    (i) => `Last verified ${formatDate(i.date)}`
  )}
  ${section(
    "Due a check soon",
    "Will pass a year since their last verification within a month.",
    report.checkDueSoon,
    (i) => `Last verified ${formatDate(i.date)}; a year is up ${when(i.days)}`
  )}
  ${
    report.neverVerifiedDrafts
      ? `<p style="color: #555;">${report.neverVerifiedDrafts} draft${
          report.neverVerifiedDrafts === 1 ? " has" : "s have"
        } never been verified.</p>`
      : ""
  }
  <p style="margin-top: 20px;"><a href="${escapeHtml(options.reviewUrl)}" style="display: inline-block; padding: 12px 24px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">Open Admissions &amp; Scholarships</a></p>
  <p style="color: #777; font-size: 13px;">Sent on Mondays, and only when there is something in it.</p>
</body>
</html>`;

  await sendEmail({
    to: options.to,
    subject: `Admissions & scholarships: ${counts.join(", ") || "dates and checks"}`,
    html,
  });
};
