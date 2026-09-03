import nodemailer from "nodemailer";
import { log as __rootLog } from "../logger";

const log = __rootLog.child("email");

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /**
   * Rethrow when the send fails, instead of swallowing it.
   *
   * Default `false`, which is right for the notification mail most callers send:
   * a failed "your booking is confirmed" should not roll back the booking.
   *
   * It is WRONG for any mail that is the only copy of something — a temporary
   * password, a verification link, a one-time code. There, a swallowed failure
   * leaves an account nobody can get into while the API reports success. Those
   * callers must pass `critical: true` so the caller can roll back.
   */
  critical?: boolean;
}

/** Everything useful an SMTP rejection carries, flattened for one log line. */
const describeSmtpError = (error: unknown): string => {
  if (!error || typeof error !== "object") return String(error);
  const e = error as {
    code?: string;
    responseCode?: number;
    command?: string;
    response?: string;
    message?: string;
  };
  return [
    e.code && `code=${e.code}`,
    e.responseCode && `responseCode=${e.responseCode}`,
    e.command && `command=${e.command}`,
    e.response && `response=${e.response}`,
    e.message,
  ]
    .filter(Boolean)
    .join(" | ");
};

export const sendEmail = async (options: SendEmailOptions): Promise<void> => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"PowerMySport" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    };

    const info = await transporter.sendMail(mailOptions);

    // `rejected` is the quiet one: the SMTP conversation succeeds, sendMail
    // resolves, and the server has still refused this recipient. Without this
    // check a rejected address looks identical to a delivered one in the logs.
    if (info.rejected?.length) {
      throw new Error(`SMTP accepted the message but rejected ${info.rejected.join(", ")}`);
    }

    log.info(`Email sent to ${options.to}: ${info.messageId}`);
  } catch (error) {
    log.error(
      `Email sending failed [to=${options.to}] [subject=${options.subject}]: ${describeSmtpError(error)}`
    );
    if (options.critical) throw error;
    // Otherwise swallowed by design — see `critical` above.
  }
};

/**
 * Authenticate against the SMTP server without sending anything.
 *
 * For diagnosing "mail isn't arriving" without mailing a real person: it
 * separates a credential or host problem from a per-message rejection.
 */
export const verifyEmailTransport = async (): Promise<
  { ok: true } | { ok: false; error: string }
> => {
  try {
    await createTransporter().verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeSmtpError(error) };
  }
};

/** Escapes HTML-significant characters — use for any value interpolated into an email template. */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// ════════════════════════════════════════════════════════════════════════════
// Additional transactional templates
// (support tickets, payouts, disputes, waitlist, coach subscriptions,
//  reviews, account safety, password-change). Added 2026-07.
// ════════════════════════════════════════════════════════════════════════════

export const emailFrontendUrl = (): string => process.env.FRONTEND_URL || "http://localhost:3000";

export const formatInr = (n: number): string => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export const renderEmailShell = (opts: {
  heading: string;
  intro?: string;
  bodyHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  accent?: string;
}): string => {
  const accent = opts.accent || "#ff6b35";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,${accent} 0%,#f7931e 100%);color:#fff;padding:24px 30px;border-radius:10px 10px 0 0;">
    <h1 style="margin:0;font-size:22px;">${opts.heading}</h1>
  </div>
  <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px;">
    ${opts.intro ? `<p>${opts.intro}</p>` : ""}
    ${opts.bodyHtml || ""}
    ${
      opts.ctaLabel && opts.ctaUrl
        ? `<p style="margin:24px 0;"><a href="${opts.ctaUrl}" style="display:inline-block;padding:12px 28px;background:${accent};color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">${opts.ctaLabel}</a></p>`
        : ""
    }
    <p style="color:#666;font-size:13px;margin-top:28px;">This is an automated message from PowerMySport.</p>
  </div>
</body></html>`;
};

export const detailTable = (rows: Array<[string, string]>): string =>
  `<table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#fff;">${k}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;background:#fff;">${v}</td></tr>`
    )
    .join("")}</table>`;
