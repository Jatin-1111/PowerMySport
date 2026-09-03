import { sendEmail, emailFrontendUrl, formatInr, renderEmailShell, detailTable } from "./shared";

interface CoachVerificationStatusEmailOptions {
  name: string;
  email: string;
  status: "PENDING" | "REVIEW" | "VERIFIED" | "REJECTED";
  notes?: string;
}

export const sendCoachVerificationStatusEmail = async (
  options: CoachVerificationStatusEmailOptions
): Promise<void> => {
  const statusLabels: Record<string, string> = {
    PENDING: "Pending",
    REVIEW: "In Review",
    VERIFIED: "Verified",
    REJECTED: "Rejected",
  };

  const statusMessage = statusLabels[options.status] || options.status;
  const actionCopy =
    options.status === "VERIFIED"
      ? "Your coach profile is now verified and will display a Verified badge."
      : options.status === "REJECTED"
        ? "Your verification was rejected. Please review the notes and resubmit."
        : "We are reviewing your verification. We will notify you once it's updated.";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 24px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 24px; border-radius: 0 0 10px 10px; }
    .badge { display: inline-block; padding: 6px 12px; background: #fff; border-radius: 999px; font-weight: bold; }
    .note { background: #fff3cd; border: 1px solid #ffeeba; padding: 12px; border-radius: 8px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Coach Verification Update</h1>
  </div>
  <div class="content">
    <p>Hi ${options.name},</p>
    <p>Your coach verification status is now:</p>
    <p><span class="badge">${statusMessage}</span></p>
    <p>${actionCopy}</p>
    ${options.notes ? `<div class="note"><strong>Notes:</strong> ${options.notes}</div>` : ""}
    <p style="margin-top: 20px;">Thanks,<br/>PowerMySport Team</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.email,
    subject: `Coach verification status: ${statusMessage}`,
    html,
  });
};

interface CoachVerificationReminderEmailOptions {
  name: string;
  email: string;
}

export const sendCoachVerificationReminderEmail = async (
  options: CoachVerificationReminderEmailOptions
): Promise<void> => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 24px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 24px; border-radius: 0 0 10px 10px; }
    .tip { background: #fff; border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Complete Your Coach Verification</h1>
  </div>
  <div class="content">
    <p>Hi ${options.name},</p>
    <p>This is a reminder to complete and submit your coach verification profile and documents for admin review.</p>
    <div class="tip">
      <strong>What to do next:</strong>
      <ul>
        <li>Complete your profile details</li>
        <li>Upload required verification documents</li>
        <li>Submit verification for review</li>
      </ul>
    </div>
    <p>Once submitted, our team will review and update your status.</p>
    <p style="margin-top: 20px;">Thanks,<br/>PowerMySport Team</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.email,
    subject: "Reminder: complete your coach verification",
    html,
  });
};

interface CoachAdminCredentialsEmailOptions {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}

interface VenueAdminCredentialsEmailOptions {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}

interface ExpertAdminCredentialsEmailOptions {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}

export const sendCoachAdminCredentialsEmail = async (
  options: CoachAdminCredentialsEmailOptions
): Promise<void> => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
    Your coach account is ready. Use the temporary credentials to sign in and complete your coaching profile.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;padding:28px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background-color:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:30px 28px 24px;text-align:center;">
              <div style="display:inline-block;background:#1f2937;border:1px solid #334155;color:#e2e8f0;padding:6px 12px;border-radius:9999px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">Coach</div>
              <h1 style="margin:14px 0 0;font-size:30px;line-height:34px;color:#ffffff;font-weight:800;">Coach Account Created</h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:22px;color:#cbd5e1;">Temporary credentials are ready for first login.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px;background-color:#ffffff;">
              <p style="margin:0 0 8px;font-size:18px;line-height:26px;color:#0f172a;font-weight:700;">Hi ${options.name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;">Your coach profile has been created by the admin team. Use the details below to sign in and finish setting up your coaching presence.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbeafe;border-radius:12px;background-color:#f8fbff;margin:0 0 16px;">
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #dbeafe;">
                    <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:#64748b;">Email</p>
                    <p style="margin:6px 0 0;font-size:16px;line-height:24px;font-weight:700;color:#0f172a;word-break:break-word;">${options.email}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:#64748b;">Temporary Password</p>
                    <p style="margin:6px 0 0;font-size:16px;line-height:24px;font-weight:700;color:#0f172a;word-break:break-word;">${options.password}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
                <tr>
                  <td style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:10px;padding:12px 14px;font-size:14px;line-height:22px;color:#155e75;">
                    Complete your coaching profile, verify your details, and keep your credentials secure.
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 8px;">
                <tr>
                  <td align="center" style="border-radius:10px;background:#0f172a;">
                    <a href="${options.loginUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Login to Coach Portal</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;line-height:18px;color:#64748b;text-align:center;word-break:break-all;">${options.loginUrl}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;line-height:20px;color:#64748b;">This email was sent to ${options.email}</p>
              <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  await sendEmail({
    to: options.email,
    subject: "Your PowerMySport Coach Account Is Ready",
    html,
  });
};

export const sendVenueAdminCredentialsEmail = async (
  options: VenueAdminCredentialsEmailOptions
): Promise<void> => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
    Your venue listing has been approved. Use the temporary credentials to access your venue dashboard.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;padding:28px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background-color:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#b45309 0%,#f59e0b 100%);padding:30px 28px 24px;text-align:center;">
              <div style="display:inline-block;background:#92400e;border:1px solid #fbbf24;color:#fffbeb;padding:6px 12px;border-radius:9999px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">Venue Lister</div>
              <h1 style="margin:14px 0 0;font-size:30px;line-height:34px;color:#ffffff;font-weight:800;">Venue Listing Approved</h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:22px;color:#fff7ed;">Temporary credentials are ready for first login.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px;background-color:#ffffff;">
              <p style="margin:0 0 8px;font-size:18px;line-height:26px;color:#0f172a;font-weight:700;">Hi ${options.name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;">Your venue has been listed by the admin team and is now ready to manage from your venue dashboard.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #fed7aa;border-radius:12px;background-color:#fffaf0;margin:0 0 16px;">
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #fed7aa;">
                    <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:#9a3412;">Email</p>
                    <p style="margin:6px 0 0;font-size:16px;line-height:24px;font-weight:700;color:#0f172a;word-break:break-word;">${options.email}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:#9a3412;">Temporary Password</p>
                    <p style="margin:6px 0 0;font-size:16px;line-height:24px;font-weight:700;color:#0f172a;word-break:break-word;">${options.password}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
                <tr>
                  <td style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px;font-size:14px;line-height:22px;color:#9a3412;">
                    Please change the temporary password after your first login.
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 8px;">
                <tr>
                  <td align="center" style="border-radius:10px;background:#0f172a;">
                    <a href="${options.loginUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Login to Venue Dashboard</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;line-height:18px;color:#64748b;text-align:center;word-break:break-all;">${options.loginUrl}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;line-height:20px;color:#64748b;">This email was sent to ${options.email}</p>
              <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  await sendEmail({
    to: options.email,
    subject: "Your PowerMySport Venue Listing Is Ready",
    html,
  });
};

export const sendExpertAdminCredentialsEmail = async (
  options: ExpertAdminCredentialsEmailOptions
): Promise<void> => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
    Your expert account is ready. Use the temporary credentials to sign in and access your expert dashboard.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;padding:28px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background-color:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#3b82f6 100%);padding:30px 28px 24px;text-align:center;">
              <div style="display:inline-block;background:#312e81;border:1px solid #818cf8;color:#e0e7ff;padding:6px 12px;border-radius:9999px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">Expert</div>
              <h1 style="margin:14px 0 0;font-size:30px;line-height:34px;color:#ffffff;font-weight:800;">Expert Account Created</h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:22px;color:#e0e7ff;">Temporary credentials are ready for first login.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px;background-color:#ffffff;">
              <p style="margin:0 0 8px;font-size:18px;line-height:26px;color:#0f172a;font-weight:700;">Hi ${options.name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;">Your expert profile has been created by the admin team. Use the details below to sign in and access your dashboard.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0e7ff;border-radius:12px;background-color:#f5f7ff;margin:0 0 16px;">
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #e0e7ff;">
                    <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:#4f46e5;">Email</p>
                    <p style="margin:6px 0 0;font-size:16px;line-height:24px;font-weight:700;color:#0f172a;word-break:break-word;">${options.email}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:#4f46e5;">Temporary Password</p>
                    <p style="margin:6px 0 0;font-size:16px;line-height:24px;font-weight:700;color:#0f172a;font-family:monospace;">${options.password}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="${options.loginUrl}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#4f46e5;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;text-align:center;box-shadow:0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -1px rgba(79, 70, 229, 0.1);">Sign In to Dashboard</a>
                  </td>
                </tr>
              </table>

              <hr style="border:0;border-top:1px solid #e2e8f0;margin:28px 0;" />

              <p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Security Notice</p>
              <p style="margin:0;font-size:13px;line-height:20px;color:#64748b;">Please change your password immediately after logging in for the first time. Keep your credentials secure.</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#f8fafc;padding:24px 28px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">&copy; ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await sendEmail({
    to: options.email,
    subject: "Your PowerMySport Expert Account Is Ready",
    html,
    // Same reasoning as the admin credentials mail below: it carries the only
    // copy of a temporary password.
    critical: true,
  });
};

interface CoachSubscriptionPurchasedOptions {
  name?: string | undefined;
  email: string;
  packageName: string;
  price: number;
  counterpartName: string;
  recipientRole: "Player" | "Coach";
}

export const sendCoachSubscriptionPurchasedEmail = async (
  options: CoachSubscriptionPurchasedOptions
): Promise<void> => {
  const forPlayer = options.recipientRole === "Player";
  const html = renderEmailShell({
    heading: forPlayer ? "Your coaching plan is active 🏆" : "You have a new subscriber 🎉",
    intro: forPlayer
      ? `Hi ${options.name || "there"}, your subscription to ${options.counterpartName}'s coaching plan is now active.`
      : `Hi ${options.name || "there"}, ${options.counterpartName} just subscribed to your coaching plan.`,
    bodyHtml: detailTable([
      ["Plan", options.packageName],
      ["Price", formatInr(options.price)],
      [forPlayer ? "Coach" : "Subscriber", options.counterpartName],
    ]),
    ctaLabel: forPlayer ? "View my subscriptions" : "View my clients",
    ctaUrl: `${emailFrontendUrl()}/${forPlayer ? "dashboard" : "coach/clients"}`,
    accent: "#16a34a",
  });
  await sendEmail({
    to: options.email,
    subject: forPlayer
      ? `Your coaching plan with ${options.counterpartName} is active`
      : `${options.counterpartName} subscribed to your coaching plan`,
    html,
  });
};

interface CoachSubscriptionCancelledOptions {
  name?: string | undefined;
  email: string;
  packageName: string;
  counterpartName: string;
  recipientRole: "Player" | "Coach";
}

export const sendCoachSubscriptionCancelledEmail = async (
  options: CoachSubscriptionCancelledOptions
): Promise<void> => {
  const forPlayer = options.recipientRole === "Player";
  const html = renderEmailShell({
    heading: "Subscription cancelled",
    intro: forPlayer
      ? `Hi ${options.name || "there"}, your subscription to ${options.counterpartName}'s coaching plan has been cancelled.`
      : `Hi ${options.name || "there"}, ${options.counterpartName} has cancelled their subscription to your coaching plan.`,
    bodyHtml: detailTable([
      ["Plan", options.packageName],
      [forPlayer ? "Coach" : "Subscriber", options.counterpartName],
    ]),
    ctaLabel: forPlayer ? "Explore coaches" : "View dashboard",
    ctaUrl: `${emailFrontendUrl()}/${forPlayer ? "coaches" : "coach/clients"}`,
    accent: "#64748b",
  });
  await sendEmail({
    to: options.email,
    subject: "Coaching subscription cancelled — PowerMySport",
    html,
  });
};

// ─── Expert self-serve review emails ──────────────────────────────────────────

export const sendExpertApprovedEmail = async (options: {
  name: string;
  email: string;
  dashboardUrl: string;
}): Promise<void> => {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">Your expert profile is live on PowerMySport. Clients can now find and book sessions with you.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;padding:28px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background-color:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:30px 28px 24px;text-align:center;">
              <div style="display:inline-block;background:#065f46;border:1px solid #6ee7b7;color:#d1fae5;padding:6px 12px;border-radius:9999px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">Expert — Approved</div>
              <h1 style="margin:14px 0 0;font-size:28px;line-height:34px;color:#ffffff;font-weight:800;">You&rsquo;re Live!</h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:22px;color:#d1fae5;">Your expert profile has been approved and is now visible to clients.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;background-color:#ffffff;">
              <p style="margin:0 0 16px;font-size:18px;line-height:26px;color:#0f172a;font-weight:700;">Congratulations, ${options.name}!</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#475569;">Your profile is now live on the PowerMySport platform. Clients can discover your profile, browse your availability, and book 1:1 sessions with you.</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#475569;">Make sure your availability windows are set so clients can start booking right away.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="${options.dashboardUrl}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#059669;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Go to Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:18px 28px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">&copy; ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  await sendEmail({
    to: options.email,
    subject: "Your PowerMySport Expert Profile Is Live!",
    html,
  });
};

export const sendExpertRejectedEmail = async (options: {
  name: string;
  email: string;
  reason: string;
  dashboardUrl: string;
}): Promise<void> => {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">Your expert profile application requires some changes before it can go live.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;padding:28px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background-color:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626 0%,#f87171 100%);padding:30px 28px 24px;text-align:center;">
              <div style="display:inline-block;background:#7f1d1d;border:1px solid #fca5a5;color:#fee2e2;padding:6px 12px;border-radius:9999px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">Action Required</div>
              <h1 style="margin:14px 0 0;font-size:28px;line-height:34px;color:#ffffff;font-weight:800;">Profile Needs Updates</h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:22px;color:#fee2e2;">Please review the feedback below and resubmit your profile.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;background-color:#ffffff;">
              <p style="margin:0 0 16px;font-size:18px;line-height:26px;color:#0f172a;font-weight:700;">Hi ${options.name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;">Thank you for applying to join PowerMySport as an expert. After reviewing your profile, our team has some feedback for you:</p>
              <div style="background-color:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;padding:14px 16px;margin:0 0 20px;">
                <p style="margin:0;font-size:15px;line-height:24px;color:#7f1d1d;">${options.reason}</p>
              </div>
              <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#475569;">Please update your profile and resubmit for review. Our team will review it again promptly.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="${options.dashboardUrl}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#dc2626;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Update My Profile</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:18px 28px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">&copy; ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  await sendEmail({
    to: options.email,
    subject: "Your PowerMySport Expert Profile Needs Updates",
    html,
  });
};
