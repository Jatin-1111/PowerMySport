import { sendEmail, emailFrontendUrl, renderEmailShell, detailTable } from "./shared";

interface WelcomeEmailOptions {
  name: string;
  email: string;
  role: string;
}

export const sendWelcomeEmail = async (options: WelcomeEmailOptions): Promise<void> => {
  const roleNames: Record<string, string> = {
    Player: "Player",
    Parent: "Parent",
    VenueLister: "Venue Lister",
    Coach: "Coach",
    Academy: "Academy",
    Admin: "Admin",
    VENUE_ONBOARDING: "Venue Lister",
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: #ff6b35;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 14px;
    }
    .feature-box {
      background: white;
      padding: 15px;
      margin: 15px 0;
      border-left: 4px solid #ff6b35;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚽ Welcome to PowerMySport!</h1>
  </div>

  <div class="content">
    <h2>Hi ${options.name}! 👋</h2>

    <p>Thank you for joining <strong>PowerMySport</strong> as a <strong>${roleNames[options.role] || "User"}</strong>!</p>

    <p>We're excited to have you as part of our sports community. Your account has been successfully created and you're all set to get started.</p>

    ${
      options.role === "Player"
        ? `
    <div class="feature-box">
      <h3>🎯 As a Player, you can:</h3>
      <ul>
        <li>Browse and book sports venues</li>
        <li>Find and book coaching sessions</li>
        <li>Track your bookings and payment history</li>
        <li>Discover new sports facilities in your area</li>
      </ul>
    </div>
    `
        : options.role === "Parent"
          ? `
    <div class="feature-box">
      <h3>🧑‍🤝‍🧑 As a Parent, you can:</h3>
      <ul>
        <li>Take the sport assessment to find your child's best-fit sports</li>
        <li>Get a personalised roadmap and expert guidance</li>
        <li>Book 1:1 sessions with sports experts</li>
        <li>Track your child's sporting journey over time</li>
      </ul>
    </div>
    `
          : options.role === "Coach"
            ? `
    <div class="feature-box">
      <h3>🏆 As a Coach, you can:</h3>
      <ul>
        <li>Create and manage your coaching profile</li>
        <li>Set your availability and pricing</li>
        <li>Accept bookings from players</li>
        <li>Track your earnings and sessions</li>
      </ul>
    </div>
    `
            : options.role === "VenueLister"
              ? `
    <div class="feature-box">
      <h3>🏟️ As a Venue Lister, you can:</h3>
      <ul>
        <li>List and manage your sports venues</li>
        <li>Set pricing and availability</li>
        <li>Accept bookings from players</li>
        <li>Track revenue and venue usage</li>
      </ul>
    </div>
    `
              : ""
    }

    <center>
      <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/login" class="button">
        Get Started →
      </a>
    </center>

    <p>If you have any questions or need assistance, feel free to reach out to our support team.</p>

    <p>Best regards,<br>
    <strong>The PowerMySport Team</strong></p>
  </div>

  <div class="footer">
    <p>This email was sent to ${options.email}</p>
    <p>© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.email,
    subject: "Welcome to PowerMySport! 🎉",
    html,
  });
};

interface PasswordResetEmailOptions {
  name: string;
  email: string;
  resetToken: string;
}

export const sendPasswordResetEmail = async (options: PasswordResetEmailOptions): Promise<void> => {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${options.resetToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: #ff6b35;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
    }
    .warning-box {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      border-radius: 5px;
      margin: 15px 0;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔐 Password Reset Request</h1>
  </div>

  <div class="content">
    <h2>Hi ${options.name},</h2>

    <p>We received a request to reset your password for your PowerMySport account.</p>

    <p>Click the button below to reset your password. This link will expire in <strong>1 hour</strong>.</p>

    <center>
      <a href="${resetUrl}" class="button">
        Reset Password
      </a>
    </center>

    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #666; font-size: 12px;">${resetUrl}</p>

    <div class="warning-box">
      <strong>⚠️ Important:</strong> If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.
    </div>

    <p>Best regards,<br>
    <strong>The PowerMySport Team</strong></p>
  </div>

  <div class="footer">
    <p>This email was sent to ${options.email}</p>
    <p>© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.email,
    subject: "Reset Your Password - PowerMySport",
    html,
  });
};

interface CredentialsEmailOptions {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}

interface AdminTemporaryCredentialsEmailOptions {
  name: string;
  email: string;
  role: string;
  temporaryPassword: string;
  loginUrl: string;
}

export const sendCredentialsEmail = async (options: CredentialsEmailOptions): Promise<void> => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: #ff6b35;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
    }
    .credentials-box {
      background: #e8f4fd;
      border: 1px solid #b6d4fe;
      padding: 20px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Inquiry Approved!</h1>
  </div>

  <div class="content">
    <h2>Hi ${options.name},</h2>

    <p>Good news! Your venue inquiry has been approved. You can now login to your Venue Lister Dashboard and start managing your venue.</p>

    <div class="credentials-box">
      <h3>🔐 Your Login Credentials</h3>
      <p><strong>Email:</strong> ${options.email}</p>
      <p><strong>Password:</strong> ${options.password}</p>
      <p><em>Please change your password after your first login.</em></p>
    </div>

    <center>
      <a href="${options.loginUrl}" class="button">
        Login to Dashboard
      </a>
    </center>

    <p>Best regards,<br>
    <strong>The PowerMySport Team</strong></p>
  </div>

  <div class="footer">
    <p>This email was sent to ${options.email}</p>
    <p>© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.email,
    subject: "Your Venue Lister Account Approved! 🏟️",
    html,
  });
};

export const sendAdminTemporaryCredentialsEmail = async (
  options: AdminTemporaryCredentialsEmailOptions
): Promise<void> => {
  // Format role name (e.g., "SYSTEM_ADMIN" -> "System Admin")
  const roleLabel = options.role
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
    Your ${roleLabel} account is ready. Use the temporary credentials to sign in and update your password.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;padding:28px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background-color:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:30px 28px 24px;text-align:center;">
              <div style="display:inline-block;background:#1f2937;border:1px solid #334155;color:#e2e8f0;padding:6px 12px;border-radius:9999px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">${roleLabel}</div>
              <h1 style="margin:14px 0 0;font-size:30px;line-height:34px;color:#ffffff;font-weight:800;">Admin Access Created</h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:22px;color:#cbd5e1;">Temporary credentials are ready for first login.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px;background-color:#ffffff;">
              <p style="margin:0 0 8px;font-size:18px;line-height:26px;color:#0f172a;font-weight:700;">Hi ${options.name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;">Your ${roleLabel.toLowerCase()} account has been created successfully. Use the details below to sign in.</p>

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
                    <p style="margin:6px 0 0;font-size:16px;line-height:24px;font-weight:700;color:#0f172a;word-break:break-word;">${options.temporaryPassword}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
                <tr>
                  <td style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px;font-size:14px;line-height:22px;color:#9a3412;">
                    For security, you must change this temporary password immediately after first login.
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 8px;">
                <tr>
                  <td align="center" style="border-radius:10px;background:#0f172a;">
                    <a href="${options.loginUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Login to Admin Portal</a>
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
    subject: "Your PowerMySport Admin Account Credentials",
    html,
    // This mail is the ONLY copy of the temporary password — it is never stored
    // in readable form and never shown in the UI. If it does not leave, the
    // account it belongs to is unreachable, so the caller must be able to roll
    // the account back rather than be told the mail was sent.
    critical: true,
  });
};

interface AccountStatusOptions {
  name?: string | undefined;
  email: string;
  action: "SUSPEND" | "DEACTIVATE" | "REACTIVATE";
  reason?: string | undefined;
}

export const sendAccountStatusEmail = async (options: AccountStatusOptions): Promise<void> => {
  const reactivated = options.action === "REACTIVATE";
  const heading = reactivated
    ? "Your account has been reactivated"
    : options.action === "DEACTIVATE"
      ? "Your account has been deactivated"
      : "Your account has been suspended";
  const html = renderEmailShell({
    heading,
    intro: reactivated
      ? `Hi ${options.name || "there"}, your PowerMySport account has been reactivated and you can log in again.`
      : `Hi ${options.name || "there"}, your PowerMySport account has been ${options.action === "DEACTIVATE" ? "deactivated" : "suspended"} by our team.`,
    bodyHtml: options.reason
      ? detailTable([["Reason", options.reason]]) +
        `<p style="margin-top:8px;">If you believe this was a mistake, please reply to this email or contact support.</p>`
      : `<p>If you believe this was a mistake, please contact support.</p>`,
    ctaLabel: reactivated ? "Log in" : "Contact support",
    ctaUrl: `${emailFrontendUrl()}/${reactivated ? "login" : "contact"}`,
    accent: reactivated ? "#16a34a" : "#ef4444",
  });
  await sendEmail({
    to: options.email,
    subject: reactivated
      ? "Your PowerMySport account has been reactivated"
      : `Your PowerMySport account has been ${options.action === "DEACTIVATE" ? "deactivated" : "suspended"}`,
    html,
  });
};

interface PasswordChangedOptions {
  name?: string | undefined;
  email: string;
}

export const sendPasswordChangedEmail = async (options: PasswordChangedOptions): Promise<void> => {
  const html = renderEmailShell({
    heading: "Your password was changed",
    intro: `Hi ${options.name || "there"}, this is a confirmation that the password for your PowerMySport account was just changed.`,
    bodyHtml: `<p>If you made this change, no action is needed. <strong>If you did not change your password</strong>, please reset it immediately and contact support — your account may be at risk.</p>`,
    ctaLabel: "Reset password",
    ctaUrl: `${emailFrontendUrl()}/forgot-password`,
    accent: "#ef4444",
  });
  await sendEmail({
    to: options.email,
    subject: "Your PowerMySport password was changed",
    html,
  });
};
