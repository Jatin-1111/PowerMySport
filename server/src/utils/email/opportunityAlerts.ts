import { detailTable, emailFrontendUrl, escapeHtml, renderEmailShell, sendEmail } from "./shared";

interface OpportunityAlertEmailItem {
  title?: string;
  path?: string;
  /** The sentence for this item, written when the alert was queued. */
  text?: string;
}

interface OpportunityAlertEmailOptions {
  email: string;
  name: string;
  items: OpportunityAlertEmailItem[];
}

/**
 * Tells a parent that an admission or scholarship window they follow has opened
 * or is about to close.
 *
 * Two rules this template exists to hold:
 *
 *   1. **The dates are ours, not the organiser's.** They are what an editor last
 *      verified, and organisers move deadlines. The email says so and sends the
 *      parent to the entry, which links the official source, rather than telling
 *      them to act on a date alone.
 *   2. **No child is addressed.** It goes to the account holder, about an entry
 *      they chose to follow.
 */
export const sendOpportunityAlertEmail = async (
  options: OpportunityAlertEmailOptions
): Promise<void> => {
  const items = options.items.filter((item) => item.text);
  if (items.length === 0) return;

  const rows = items.map((item): [string, string] => [
    escapeHtml(item.title ?? "Entry"),
    `${escapeHtml(item.text ?? "")}${
      item.path
        ? ` <a href="${escapeHtml(`${emailFrontendUrl()}${item.path}`)}">See the details</a>`
        : ""
    }`,
  ]);

  const first = items[0];
  const html = renderEmailShell({
    heading:
      items.length === 1 ? "An entry you follow has a date" : "Entries you follow have dates",
    intro: `Hi ${escapeHtml(options.name)}, here is what has changed on what you follow.`,
    bodyHtml:
      detailTable(rows) +
      `<p style="color:#555;">These are the dates we last verified. Organisers can change them, so confirm on the official page before you apply. You can stop these by un-following the entry.</p>`,
    ctaLabel: "Open the entry",
    ctaUrl: `${emailFrontendUrl()}${first?.path ?? "/scholarships"}`,
  });

  await sendEmail({
    to: options.email,
    subject: items.length === 1 ? "A date on an entry you follow" : "Dates on entries you follow",
    html,
  });
};
