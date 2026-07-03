import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { sendEmail } from "../utils/email";

dotenv.config();

/**
 * Email service health check (diagnostic, not a product feature).
 *
 *   npm run email:verify                 → check config + live SMTP connect/auth
 *   npm run email:verify -- --to a@b.com → also send one real test email
 *
 * Must be run from an environment with network access to the SMTP host.
 * Never prints the SMTP password.
 */
async function main(): Promise<void> {
  const toArg = process.argv.find((a) => a.startsWith("--to="));
  const toFlagIndex = process.argv.indexOf("--to");
  const testRecipient = toArg
    ? toArg.split("=")[1]
    : toFlagIndex !== -1
      ? process.argv[toFlagIndex + 1]
      : undefined;

  const host = process.env.EMAIL_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.EMAIL_PORT || "587", 10);
  const secure = process.env.EMAIL_SECURE === "true";

  console.log("── Email configuration ──────────────────────────────");
  console.log("EMAIL_HOST    :", host);
  console.log("EMAIL_PORT    :", port);
  console.log("EMAIL_SECURE  :", secure);
  console.log("EMAIL_USER    :", process.env.EMAIL_USER || "— NOT SET");
  console.log(
    "EMAIL_PASSWORD:",
    process.env.EMAIL_PASSWORD ? `set (${process.env.EMAIL_PASSWORD.length} chars)` : "— NOT SET",
  );
  console.log("EMAIL_FROM    :", process.env.EMAIL_FROM || process.env.EMAIL_USER || "— NOT SET");

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error("\n❌ EMAIL_USER / EMAIL_PASSWORD not configured — cannot verify.");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  });

  console.log("\n── SMTP connection & auth ───────────────────────────");
  try {
    await transporter.verify();
    console.log(`✅ Connected and authenticated to ${host}:${port}`);
  } catch (error) {
    const e = error as { code?: string; message?: string };
    console.error(`❌ SMTP verify failed — ${e.code || ""} ${e.message || error}`);
    process.exit(2);
  }

  if (testRecipient) {
    console.log("\n── Sending test email ───────────────────────────────");
    console.log("To:", testRecipient);
    await sendEmail({
      to: testRecipient,
      subject: "PowerMySport email service test",
      html: `<div style="font-family:Arial,sans-serif">
        <h2 style="color:#FF6B35">Email service is working ✅</h2>
        <p>This is an automated test message from <strong>npm run email:verify</strong>.</p>
        <p>Sent at ${new Date().toISOString()}.</p>
      </div>`,
    });
    console.log("✅ Test email dispatched (check the inbox to confirm delivery).");
  } else {
    console.log("\nTip: pass --to you@example.com to also send a real test email.");
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
