import { escapeHtml, sendEmail } from "./shared";

interface DigestItem {
  url: string;
  status: string;
  note?: string;
  changeKind?: string;
  entries: string[];
}

interface OpportunityWatchDigestOptions {
  to: string;
  name: string;
  items: DigestItem[];
  reviewUrl: string;
  firstRun: boolean;
  checked: number;
  ok: number;
  unreadable: number;
}

const CHANGE_TEXT: Record<string, string> = {
  documents: "New or removed documents are linked from this page",
  text: "The page's text changed",
  file: "The document itself changed",
};

const STATUS_TEXT: Record<string, string> = {
  blocked: "Could not be read from our server",
  moved: "Moved",
  gone: "No longer exists",
  disallowed: "The site asks crawlers not to fetch it",
  error: "Could not be fetched",
};

/**
 * The weekly source check's one email: what changed, and what stopped being
 * readable. The first run also reports how many sources our server can read
 * at all, which is the readability test nothing else can run.
 */
export const sendOpportunityWatchDigestEmail = async (
  options: OpportunityWatchDigestOptions
): Promise<void> => {
  const changed = options.items.filter((item) => item.status === "ok");
  const problems = options.items.filter((item) => item.status !== "ok");

  const row = (item: DigestItem, headline: string) => `
    <li style="margin-bottom: 14px;">
      <strong>${escapeHtml(headline)}</strong><br/>
      <a href="${escapeHtml(item.url)}">${escapeHtml(item.url)}</a><br/>
      <span style="color: #555;">Used by: ${escapeHtml(item.entries.join(", "))}</span>
      ${item.note ? `<br/><span style="color: #555;">${escapeHtml(item.note)}</span>` : ""}
    </li>`;

  const intro = options.firstRun
    ? `<p>This was the first check of every source our admissions and scholarship entries depend on. Our server could read <strong>${options.ok} of ${options.checked}</strong>.</p>`
    : `<p>This week's source check found something to look at.</p>`;

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="margin-bottom: 4px;">Admissions &amp; scholarships: source check</h2>
  <p>Hi ${escapeHtml(options.name)},</p>
  ${intro}
  ${
    changed.length
      ? `<h3>Changed (${changed.length})</h3><p>Open the entry and use "Check against a source" to see what is different.</p><ul>${changed
          .map((item) => row(item, CHANGE_TEXT[item.changeKind ?? ""] ?? "Changed"))
          .join("")}</ul>`
      : ""
  }
  ${
    problems.length
      ? `<h3>Cannot be read (${problems.length})</h3><ul>${problems
          .map((item) => row(item, STATUS_TEXT[item.status] ?? item.status))
          .join("")}</ul>`
      : ""
  }
  <p style="margin-top: 20px;"><a href="${escapeHtml(options.reviewUrl)}" style="display: inline-block; padding: 12px 24px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">Open Admissions &amp; Scholarships</a></p>
  <p style="color: #777; font-size: 13px;">A problem is reported once. It stays flagged in admin until someone dismisses it or the source is read again.</p>
</body>
</html>`;

  await sendEmail({
    to: options.to,
    subject: options.firstRun
      ? `Source check: ${options.ok} of ${options.checked} sources readable`
      : `Source check: ${changed.length} changed, ${problems.length} unreadable`,
    html,
  });
};
