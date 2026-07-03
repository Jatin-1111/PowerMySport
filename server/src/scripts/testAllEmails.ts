import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

/**
 * Exercises every email template helper.
 *
 *   npm run email:test-all                       → dry run (no mail sent); validates
 *                                                  recipient, subject and rendered HTML.
 *   npm run email:test-all -- --send --to a@b.com → also sends each template for real
 *                                                  and records the SMTP messageId.
 */

const argv = process.argv.slice(2);
const SEND = argv.includes("--send");
const getFlag = (name: string): string | undefined => {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.split("=")[1];
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
};
const OVERRIDE_TO = getFlag("--to");

interface Captured {
  to: string;
  subject: string;
  html: string;
  sent: boolean;
  messageId?: string;
  error?: string;
}

const captured: Captured[] = [];

// Build a real transport from env (used only in --send mode), then override the
// module factory so every helper's send is intercepted and recorded uniformly.
const realTransport = SEND
  ? nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT || "587", 10),
      secure: process.env.EMAIL_SECURE === "true",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    })
  : null;

(nodemailer as unknown as { createTransport: () => unknown }).createTransport =
  () => ({
    sendMail: async (mail: { to: string; subject: string; html: string }) => {
      const rec: Captured = {
        to: mail.to,
        subject: mail.subject,
        html: mail.html || "",
        sent: false,
      };
      if (SEND && realTransport) {
        try {
          const info = await realTransport.sendMail(mail);
          rec.sent = true;
          rec.messageId = info.messageId;
        } catch (e) {
          rec.error = (e as Error).message;
        }
      } else {
        rec.sent = true;
        rec.messageId = `dry-${captured.length + 1}`;
      }
      captured.push(rec);
      return { messageId: rec.messageId || "dry" };
    },
  });

process.env.EMAIL_FROM = process.env.EMAIL_FROM || "teams@powermysport.com";

// eslint-disable-next-line @typescript-eslint/no-var-requires
import * as email from "../utils/email";

const to = (fallback: string) => OVERRIDE_TO || fallback;
const D = new Date("2026-08-01T13:30:00Z");

interface Case {
  category: string;
  expectedTo: string;
  run: () => Promise<void>;
  expect?: string[]; // substrings expected in HTML
}

const cases: Case[] = [
  {
    category: "Welcome",
    expectedTo: to("player@example.com"),
    run: () =>
      email.sendWelcomeEmail({ name: "Asha", email: to("player@example.com"), role: "PLAYER" }),
    expect: ["Asha"],
  },
  {
    category: "Password reset",
    expectedTo: to("reset@example.com"),
    run: () =>
      email.sendPasswordResetEmail({ name: "Asha", email: to("reset@example.com"), resetToken: "tok_abc123" }),
    expect: ["reset", "tok_abc123"],
  },
  {
    category: "Booking lifecycle — PENDING_CONFIRMATION (player)",
    expectedTo: to("lifecycle@example.com"),
    run: () =>
      email.sendBookingLifecycleEmail({
        email: to("lifecycle@example.com"), name: "Asha", venueName: "Turf Arena", sport: "Football",
        date: D, startTime: "18:00", endTime: "19:00", totalAmount: 500,
        state: "PENDING_CONFIRMATION", recipientRole: "PLAYER",
      }),
    expect: ["Turf Arena", "Football"],
  },
  {
    category: "Booking lifecycle — CONFIRMED (player, with check-in code)",
    expectedTo: to("lifecycle@example.com"),
    run: () =>
      email.sendBookingLifecycleEmail({
        email: to("lifecycle@example.com"), name: "Asha", venueName: "Turf Arena", sport: "Football",
        date: D, startTime: "18:00", endTime: "19:00", totalAmount: 500,
        state: "CONFIRMED", recipientRole: "PLAYER", checkInCode: "PMS-7788",
      }),
    expect: ["PMS-7788"],
  },
  {
    category: "Booking lifecycle — CANCELLED (provider, with refund)",
    expectedTo: to("provider@example.com"),
    run: () =>
      email.sendBookingLifecycleEmail({
        email: to("provider@example.com"), name: "Coach K", venueName: "Turf Arena", sport: "Football",
        date: D, startTime: "18:00", endTime: "19:00", totalAmount: 500,
        state: "CANCELLED", recipientRole: "PROVIDER",
        refundAmount: 500, refundPercentage: 100, cancellationReason: "User cancelled",
      }),
    expect: ["Turf Arena"],
  },
  {
    category: "Booking confirmation",
    expectedTo: to("confirm@example.com"),
    run: () =>
      email.sendBookingConfirmationEmail({
        name: "Asha", email: to("confirm@example.com"), venueName: "Turf Arena", sport: "Football",
        date: D, startTime: "18:00", endTime: "19:00", totalAmount: 500, checkInCode: "PMS-1234",
      }),
    expect: ["PMS-1234"],
  },
  {
    category: "Booking reminder (24h)",
    expectedTo: to("reminder@example.com"),
    run: () =>
      email.sendBookingReminderEmail({
        email: to("reminder@example.com"), name: "Asha", venueName: "Turf Arena", sport: "Football",
        date: D, startTime: "18:00", endTime: "19:00", interval: "24_HOURS", bookingId: "bk_1",
      }),
  },
  {
    category: "Booking invitation",
    expectedTo: to("invitee@example.com"),
    run: () =>
      email.sendBookingInvitationEmail({
        inviteeName: "Ravi", inviteeEmail: to("invitee@example.com"), inviterName: "Asha",
        venueName: "Turf Arena", sport: "Football", date: "2026-08-01", startTime: "18:00", endTime: "19:00",
        estimatedAmount: 250,
      }),
  },
  {
    category: "Friend request",
    expectedTo: to("recipient@example.com"),
    run: () =>
      email.sendFriendRequestEmail({ recipientName: "Ravi", recipientEmail: to("recipient@example.com"), requesterName: "Asha" }),
  },
  {
    category: "Friend request accepted",
    expectedTo: to("requester@example.com"),
    run: () =>
      email.sendFriendRequestAcceptedEmail({ requesterName: "Asha", requesterEmail: to("requester@example.com"), acceptedByName: "Ravi" }),
  },
  {
    category: "Coach verification — VERIFIED",
    expectedTo: to("coach@example.com"),
    run: () =>
      email.sendCoachVerificationStatusEmail({ name: "Coach K", email: to("coach@example.com"), status: "VERIFIED" }),
  },
  {
    category: "Coach verification — REJECTED (with notes)",
    expectedTo: to("coach@example.com"),
    run: () =>
      email.sendCoachVerificationStatusEmail({ name: "Coach K", email: to("coach@example.com"), status: "REJECTED", notes: "ID unclear" }),
    expect: ["ID unclear"],
  },
  {
    category: "Coach verification reminder",
    expectedTo: to("coach@example.com"),
    run: () =>
      email.sendCoachVerificationReminderEmail({ name: "Coach K", email: to("coach@example.com") }),
  },
  {
    category: "Credentials (venue inquiry)",
    expectedTo: to("creds@example.com"),
    run: () =>
      email.sendCredentialsEmail({ name: "Owner", email: to("creds@example.com"), password: "Temp@123", loginUrl: "https://app.powermysport.com/login" }),
  },
  {
    category: "Coach admin credentials",
    expectedTo: to("coachadmin@example.com"),
    run: () =>
      email.sendCoachAdminCredentialsEmail({ name: "Coach K", email: to("coachadmin@example.com"), password: "Temp@123", loginUrl: "https://app.powermysport.com/login" }),
  },
  {
    category: "Venue admin credentials",
    expectedTo: to("venueadmin@example.com"),
    run: () =>
      email.sendVenueAdminCredentialsEmail({ name: "Owner", email: to("venueadmin@example.com"), password: "Temp@123", loginUrl: "https://app.powermysport.com/login" }),
  },
  {
    category: "Admin temporary credentials",
    expectedTo: to("admin@example.com"),
    run: () =>
      email.sendAdminTemporaryCredentialsEmail({ name: "Admin", email: to("admin@example.com"), role: "SUPPORT_ADMIN", temporaryPassword: "Temp@123", loginUrl: "https://admin.powermysport.com/login" }),
  },
  {
    category: "Order confirmation",
    expectedTo: to("buyer@example.com"),
    run: () =>
      email.sendOrderConfirmationEmail({
        email: to("buyer@example.com"), name: "Asha", orderNumber: "ORD-1001", totalAmount: 1299,
        items: [{ productName: "Football", variantLabel: "Size 5", quantity: 1, unitPrice: 1299, lineTotal: 1299 }],
        shippingAddress: { fullName: "Asha", addressLine1: "12 MG Road", city: "Bengaluru", state: "KA", postalCode: "560001", country: "India" },
        paymentMethod: "PhonePe",
      }),
    expect: ["ORD-1001", "Football"],
  },
  {
    category: "Shop launch",
    expectedTo: to("subscriber@example.com"),
    run: () => email.sendShopLaunchEmail(to("subscriber@example.com")),
  },
  {
    category: "Support ticket received",
    expectedTo: to("support1@example.com"),
    run: () =>
      email.sendSupportTicketReceivedEmail({ name: "Asha", email: to("support1@example.com"), ticketId: "abc12345", subject: "Login issue", category: "TECHNICAL" }),
    expect: ["abc1234", "Login issue"],
  },
  {
    category: "Support ticket status change",
    expectedTo: to("support2@example.com"),
    run: () =>
      email.sendSupportTicketStatusEmail({ name: "Asha", email: to("support2@example.com"), ticketId: "abc12345", subject: "Login issue", status: "RESOLVED", note: "Fixed on our end." }),
    expect: ["RESOLVED"],
  },
  {
    category: "Payout processed",
    expectedTo: to("payout@example.com"),
    run: () =>
      email.sendPayoutProcessedEmail({ name: "Coach K", email: to("payout@example.com"), amount: 4500, bookingCount: 3, role: "COACH" }),
    expect: ["4,500"],
  },
  {
    category: "Dispute raised",
    expectedTo: to("dispute1@example.com"),
    run: () =>
      email.sendDisputeStatusEmail({ name: "Asha", email: to("dispute1@example.com"), disputeType: "NO_SHOW", status: "OPEN", bookingId: "bk123456" }),
    expect: ["bk123456"],
  },
  {
    category: "Dispute resolved (with refund)",
    expectedTo: to("dispute2@example.com"),
    run: () =>
      email.sendDisputeStatusEmail({ name: "Asha", email: to("dispute2@example.com"), disputeType: "POOR_QUALITY", status: "RESOLVED", bookingId: "bk123456", resolution: "PARTIAL_REFUND", refundAmount: 250 }),
    expect: ["PARTIAL REFUND"],
  },
  {
    category: "Waitlist slot available",
    expectedTo: to("waitlist@example.com"),
    run: () =>
      email.sendWaitlistSlotAvailableEmail({ name: "Asha", email: to("waitlist@example.com"), venueName: "Turf Arena", sport: "Football", date: D, startTime: "18:00", endTime: "19:00" }),
    expect: ["Turf Arena"],
  },
  {
    category: "Coach subscription purchased (player)",
    expectedTo: to("subplayer@example.com"),
    run: () =>
      email.sendCoachSubscriptionPurchasedEmail({ name: "Asha", email: to("subplayer@example.com"), packageName: "Pro Monthly", price: 999, counterpartName: "Coach K", recipientRole: "PLAYER" }),
    expect: ["Pro Monthly", "Coach K"],
  },
  {
    category: "Coach subscription purchased (coach)",
    expectedTo: to("subcoach@example.com"),
    run: () =>
      email.sendCoachSubscriptionPurchasedEmail({ name: "Coach K", email: to("subcoach@example.com"), packageName: "Pro Monthly", price: 999, counterpartName: "Asha", recipientRole: "COACH" }),
    expect: ["Pro Monthly"],
  },
  {
    category: "Coach subscription cancelled",
    expectedTo: to("subcancel@example.com"),
    run: () =>
      email.sendCoachSubscriptionCancelledEmail({ name: "Asha", email: to("subcancel@example.com"), packageName: "Pro Monthly", counterpartName: "Coach K", recipientRole: "PLAYER" }),
    expect: ["Pro Monthly"],
  },
  {
    category: "Review received",
    expectedTo: to("review@example.com"),
    run: () =>
      email.sendReviewReceivedEmail({ name: "Coach K", email: to("review@example.com"), rating: 5, review: "Excellent session!", reviewerName: "Asha", targetType: "COACH" }),
    expect: ["Excellent session!"],
  },
  {
    category: "Account suspended",
    expectedTo: to("suspend@example.com"),
    run: () =>
      email.sendAccountStatusEmail({ name: "Asha", email: to("suspend@example.com"), action: "SUSPEND", reason: "Policy violation" }),
    expect: ["Policy violation"],
  },
  {
    category: "Account reactivated",
    expectedTo: to("reactivate@example.com"),
    run: () =>
      email.sendAccountStatusEmail({ name: "Asha", email: to("reactivate@example.com"), action: "REACTIVATE" }),
  },
  {
    category: "Password changed confirmation",
    expectedTo: to("pwchanged@example.com"),
    run: () =>
      email.sendPasswordChangedEmail({ name: "Asha", email: to("pwchanged@example.com") }),
  },
];

const BAD_TOKENS = ["undefined", "[object Object]", "Invalid Date", "NaN"];
const emailish = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface Result {
  index: number;
  category: string;
  to: string;
  expectedTo: string;
  subject: string;
  toMatch: boolean;
  validRecipient: boolean;
  subjectOk: boolean;
  htmlOk: boolean;
  badTokens: string[];
  expectOk: boolean;
  sent: boolean;
  messageId?: string | undefined;
  error?: string | undefined;
  status: "PASS" | "FAIL";
}

async function main(): Promise<void> {
  console.log(`\nEmail template test — mode: ${SEND ? "LIVE SEND" : "DRY RUN (no mail sent)"}`);
  if (SEND && !OVERRIDE_TO) {
    console.error("--send requires --to <address>. Aborting.");
    process.exit(1);
  }

  const results: Result[] = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]!;
    const before = captured.length;
    let runError: string | undefined;
    try {
      await c.run();
    } catch (e) {
      runError = (e as Error).message;
    }
    const rec = captured[captured.length - 1];
    const produced = captured.length > before && rec;

    const html = produced ? rec!.html : "";
    const badTokens = BAD_TOKENS.filter((t) => html.includes(t));
    const expectOk = !c.expect || c.expect.every((s) => html.includes(s));

    const res: Result = {
      index: i + 1,
      category: c.category,
      to: produced ? rec!.to : "",
      expectedTo: c.expectedTo,
      subject: produced ? rec!.subject : "",
      toMatch: produced ? rec!.to === c.expectedTo : false,
      validRecipient: produced ? emailish.test(rec!.to) : false,
      subjectOk: produced ? Boolean(rec!.subject && rec!.subject.length > 0) : false,
      htmlOk: produced ? html.length > 0 && badTokens.length === 0 : false,
      badTokens,
      expectOk,
      sent: produced ? rec!.sent : false,
      messageId: produced ? rec!.messageId : undefined,
      error: runError || (produced ? rec!.error : "no email produced"),
      status: "FAIL",
    };
    res.status =
      produced &&
      res.toMatch &&
      res.validRecipient &&
      res.subjectOk &&
      res.htmlOk &&
      res.expectOk &&
      (!SEND || res.sent)
        ? "PASS"
        : "FAIL";
    results.push(res);

    const badge = res.status === "PASS" ? "PASS" : "FAIL";
    console.log(
      `[${badge}] ${res.category}\n        → to=${res.to} subject="${res.subject.slice(0, 60)}"` +
        (res.badTokens.length ? ` badTokens=${res.badTokens.join(",")}` : "") +
        (res.error ? ` error=${res.error}` : "") +
        (SEND ? ` messageId=${res.messageId || "—"}` : ""),
    );
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.length - passed;

  console.log(`\n──────────────────────────────────────────────`);
  console.log(`RESULT: ${passed}/${results.length} passed${failed ? `, ${failed} FAILED` : ""}`);

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
