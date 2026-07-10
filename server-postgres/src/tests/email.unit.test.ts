import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";

/**
 * Email recipient verification.
 *
 * We cannot (and should not) send real mail from CI, so instead we stub the
 * nodemailer transport and assert that every email helper addresses its
 * message to the correct recipient field, with a non-empty subject and a
 * configured "from". This is the deterministic way to answer "are emails sent
 * to the right person?".
 */

interface CapturedMail {
  to: string;
  from: string;
  subject: string;
  html: string;
}

const sent: CapturedMail[] = [];

// Stub the transport BEFORE importing the email module. email.ts calls
// nodemailer.createTransport() lazily per-send, so mutating the shared module
// object here is enough to intercept every send.
(nodemailer as unknown as { createTransport: () => unknown }).createTransport =
  () => ({
    sendMail: async (mail: CapturedMail) => {
      sent.push(mail);
      return { messageId: `test-${sent.length}` };
    },
  });

// Ensure a deterministic "from" address.
process.env.EMAIL_FROM = "teams@powermysport.com";

import * as email from "../utils/email";

const lastMail = (): CapturedMail => {
  assert.ok(sent.length > 0, "expected an email to have been sent");
  return sent[sent.length - 1]!;
};

const assertSentTo = (expectedTo: string) => {
  const mail = lastMail();
  assert.equal(mail.to, expectedTo, `expected recipient ${expectedTo}`);
  assert.ok(mail.subject && mail.subject.length > 0, "subject should be set");
  assert.ok(mail.from.includes("powermysport.com"), "from should be set");
};

test("welcome email → user's own address", async () => {
  await email.sendWelcomeEmail({
    name: "Asha",
    email: "player@example.com",
    role: "Player",
  });
  assertSentTo("player@example.com");
});

test("password reset email → account owner", async () => {
  await email.sendPasswordResetEmail({
    name: "Asha",
    email: "reset@example.com",
    resetToken: "tok_123",
  });
  assertSentTo("reset@example.com");
});

test("booking lifecycle email → the passed recipient", async () => {
  await email.sendBookingLifecycleEmail({
    email: "lifecycle@example.com",
    name: "Asha",
    venueName: "Turf Arena",
    sport: "Football",
    date: new Date("2026-08-01T00:00:00Z"),
    startTime: "18:00",
    endTime: "19:00",
    totalAmount: 500,
    state: "CONFIRMED",
    recipientRole: "Player",
  });
  assertSentTo("lifecycle@example.com");
});

test("booking confirmation email → the passed recipient", async () => {
  await email.sendBookingConfirmationEmail({
    name: "Asha",
    email: "confirm@example.com",
    venueName: "Turf Arena",
    sport: "Football",
    date: new Date("2026-08-01T00:00:00Z"),
    startTime: "18:00",
    endTime: "19:00",
    totalAmount: 500,
  });
  assertSentTo("confirm@example.com");
});

test("booking reminder email → the passed recipient", async () => {
  await email.sendBookingReminderEmail({
    email: "reminder@example.com",
    name: "Asha",
    venueName: "Turf Arena",
    sport: "Football",
    date: new Date("2026-08-01T00:00:00Z"),
    startTime: "18:00",
    endTime: "19:00",
    interval: "24_HOURS",
  });
  assertSentTo("reminder@example.com");
});

test("booking invitation email → the invitee, not the inviter", async () => {
  await email.sendBookingInvitationEmail({
    inviteeName: "Ravi",
    inviteeEmail: "invitee@example.com",
    inviterName: "Asha",
    venueName: "Turf Arena",
    sport: "Football",
    date: "2026-08-01",
    startTime: "18:00",
    endTime: "19:00",
  });
  assertSentTo("invitee@example.com");
});

test("friend request email → the recipient, not the requester", async () => {
  await email.sendFriendRequestEmail({
    recipientName: "Ravi",
    recipientEmail: "recipient@example.com",
    requesterName: "Asha",
  });
  assertSentTo("recipient@example.com");
});

test("friend request accepted email → the original requester", async () => {
  await email.sendFriendRequestAcceptedEmail({
    requesterName: "Asha",
    requesterEmail: "requester@example.com",
    acceptedByName: "Ravi",
  });
  assertSentTo("requester@example.com");
});

test("coach verification status email → the coach", async () => {
  await email.sendCoachVerificationStatusEmail({
    name: "Coach K",
    email: "coach@example.com",
    status: "VERIFIED",
  });
  assertSentTo("coach@example.com");
});

test("coach verification reminder email → the coach", async () => {
  await email.sendCoachVerificationReminderEmail({
    name: "Coach K",
    email: "coach-reminder@example.com",
  });
  assertSentTo("coach-reminder@example.com");
});

test("credentials email → the new account holder", async () => {
  await email.sendCredentialsEmail({
    name: "Venue Owner",
    email: "creds@example.com",
    password: "temp123",
    loginUrl: "https://app.powermysport.com/login",
  });
  assertSentTo("creds@example.com");
});

test("admin temporary credentials email → the admin", async () => {
  await email.sendAdminTemporaryCredentialsEmail({
    name: "Admin",
    email: "admin@example.com",
    role: "SUPPORT_ADMIN",
    temporaryPassword: "temp123",
    loginUrl: "https://admin.powermysport.com/login",
  });
  assertSentTo("admin@example.com");
});

test("order confirmation email → the buyer", async () => {
  await email.sendOrderConfirmationEmail({
    email: "buyer@example.com",
    name: "Asha",
    orderNumber: "ORD-1001",
    totalAmount: 1299,
    items: [
      {
        productName: "Football",
        variantLabel: "Size 5",
        quantity: 1,
        unitPrice: 1299,
        lineTotal: 1299,
      },
    ],
    shippingAddress: {
      fullName: "Asha",
      addressLine1: "12 MG Road",
      city: "Bengaluru",
      state: "KA",
      postalCode: "560001",
      country: "India",
    },
    paymentMethod: "PhonePe",
  });
  assertSentTo("buyer@example.com");
});

test("shop launch email → the subscriber", async () => {
  await email.sendShopLaunchEmail("subscriber@example.com");
  assertSentTo("subscriber@example.com");
});
