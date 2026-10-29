import { detailTable, emailFrontendUrl, escapeHtml, renderEmailShell, sendEmail } from "./shared";

interface ContactRequestEmailOptions {
  /** The parent's own address, from their account. Never taken from the request. */
  to: string;
  parentName: string;
  childName: string;
  childId: string;
  /** The label the parent gave the link, so they know which one was used. */
  recipientLabel: string;
  coachName: string;
  coachEmail: string;
  message?: string | undefined;
}

/**
 * Tells a parent that someone who opened one of their links asked to be put in touch.
 *
 * Three rules this template exists to hold:
 *
 *   1. **Nothing the sender typed reaches a header.** The recipient and the subject come from the
 *      parent's account and the child's name; what the sender wrote appears only in the body,
 *      escaped, so it cannot add a recipient or change the subject.
 *   2. **It says plainly that nobody checked.** The name and address are what the sender typed.
 *      The parent decides whether to reply, and is told so.
 *   3. **The parent's address is never given to the sender.** There is no Reply-To: replying
 *      is a choice the parent makes by writing to the address in the message.
 *
 * It is sent as critical: it is the only copy of the request the parent will see, so a failure to
 * send must reach the person who sent it, not vanish.
 */
export const sendContactRequestEmail = async (
  options: ContactRequestEmailOptions
): Promise<void> => {
  const rows: Array<[string, string]> = [
    ["Name", escapeHtml(options.coachName)],
    [
      "Email",
      `<a href="mailto:${escapeHtml(encodeURI(options.coachEmail))}">${escapeHtml(options.coachEmail)}</a>`,
    ],
    ["Used the link for", escapeHtml(options.recipientLabel)],
  ];
  if (options.message) rows.push(["Message", escapeHtml(options.message)]);

  const html = renderEmailShell({
    heading: "Someone asked to contact you",
    intro: `Hi ${escapeHtml(options.parentName)}, someone who opened the link you made for ${escapeHtml(
      options.childName
    )}'s sporting profile asked to be put in touch.`,
    bodyHtml:
      detailTable(rows) +
      `<p style="color:#555;">PowerMySport has not checked who this is: the name and email are what they typed. Reply only if you want to. Your email address has not been shared with them.</p>` +
      `<p style="color:#555;">You can stop the link at any time from ${escapeHtml(options.childName)}'s page.</p>`,
    ctaLabel: `Open ${escapeHtml(options.childName)}'s page`,
    ctaUrl: `${emailFrontendUrl()}/dashboard/dependents/${encodeURIComponent(options.childId)}`,
  });

  const text = [
    `Hi ${options.parentName}, someone who opened the link you made for ${options.childName}'s sporting profile asked to be put in touch.`,
    "",
    `Name: ${options.coachName}`,
    `Email: ${options.coachEmail}`,
    `Used the link for: ${options.recipientLabel}`,
    ...(options.message ? [`Message: ${options.message}`] : []),
    "",
    "PowerMySport has not checked who this is: the name and email are what they typed. Reply only if you want to. Your email address has not been shared with them.",
  ].join("\n");

  await sendEmail({
    to: options.to,
    subject: `Someone asked to contact you about ${options.childName}'s profile`,
    html,
    text,
    critical: true,
  });
};
