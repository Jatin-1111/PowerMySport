/* eslint-disable @typescript-eslint/no-var-requires */
// User-controlled text (display names, subjects, notes, venue names, avatar URLs) must
// never reach the HTML of an outbound email unescaped: the platform's own sender would
// otherwise deliver an attacker's markup and links to another person. These render the
// real templates with a hostile value and inspect the HTML that would be sent.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it, mock } = require("node:test");

const shared = require("../utils/email/shared");
const {
  sendFriendRequestEmail,
  sendFriendRequestAcceptedEmail,
  sendReviewReceivedEmail,
} = require("../utils/email/social");
const { sendBookingInvitationEmail } = require("../utils/email/booking");
const {
  sendSupportTicketReceivedEmail,
  sendSupportTicketStatusEmail,
} = require("../utils/email/shop");
const { sendCoachSubscriptionPurchasedEmail } = require("../utils/email/provider");

const PAYLOAD =
  '<a href="https://evil.example/login">Verify your account</a><img src=x onerror=alert(1)>';

let sent: Array<{ to?: string; subject?: string; html: string }> = [];

beforeEach(() => {
  sent = [];
  mock.method(shared, "sendEmail", async (options: any) => {
    sent.push(options);
    return { success: true };
  });
});

afterEach(() => mock.restoreAll());

const assertNoInjectedMarkup = (html: string) => {
  assert.equal(html.includes('<a href="https://evil.example'), false, "injected anchor");
  assert.equal(html.includes("<img src=x"), false, "injected image");
  assert.equal(
    html.includes("&lt;a href=&quot;https://evil.example"),
    true,
    "text is shown escaped"
  );
};

describe("outbound email escapes user-controlled text", () => {
  it("friend request: requester name", async () => {
    await sendFriendRequestEmail({
      recipientName: "Rec",
      recipientEmail: "rec@example.com",
      requesterName: PAYLOAD,
    });
    assertNoInjectedMarkup(sent[0]!.html);
  });

  it("friend request accepted: both names", async () => {
    await sendFriendRequestAcceptedEmail({
      requesterName: PAYLOAD,
      requesterEmail: "req@example.com",
      acceptedByName: PAYLOAD,
    });
    assertNoInjectedMarkup(sent[0]!.html);
  });

  it("friend request: an avatar URL cannot break out of the CSS url()", async () => {
    await sendFriendRequestEmail({
      recipientName: "Rec",
      recipientEmail: "rec@example.com",
      requesterName: "Alice",
      requesterPhotoUrl:
        'https://cdn.example/a.png");}</style><script>alert(1)</script><style>x{y:url("',
    });
    const html = sent[0]!.html;
    assert.equal(html.includes("<script>"), false);
    assert.equal(html.includes("</style><script"), false);
    await sendFriendRequestEmail({
      recipientName: "Rec",
      recipientEmail: "rec@example.com",
      requesterName: "Alice",
      requesterPhotoUrl: "javascript:alert(1)",
    });
    assert.equal(sent[1]!.html.includes("javascript:"), false);
  });

  it("booking invitation: inviter and venue names", async () => {
    await sendBookingInvitationEmail({
      inviteeName: PAYLOAD,
      inviteeEmail: "x@example.com",
      inviterName: PAYLOAD,
      venueName: PAYLOAD,
      sport: PAYLOAD,
      date: new Date(),
      startTime: "10:00",
      endTime: "11:00",
      estimatedAmount: 100,
    });
    assertNoInjectedMarkup(sent[0]!.html);
  });

  it("support ticket receipt and status: name, subject, category, note", async () => {
    await sendSupportTicketReceivedEmail({
      name: PAYLOAD,
      email: "v@example.com",
      ticketId: "0123456789abcdef",
      subject: PAYLOAD,
      category: PAYLOAD,
    });
    assertNoInjectedMarkup(sent[0]!.html);
    await sendSupportTicketStatusEmail({
      name: PAYLOAD,
      email: "v@example.com",
      ticketId: "0123456789abcdef",
      subject: PAYLOAD,
      status: "RESOLVED",
      note: PAYLOAD,
    });
    assertNoInjectedMarkup(sent[1]!.html);
  });

  it("review received: reviewer name and comment", async () => {
    await sendReviewReceivedEmail({
      name: "Coach",
      email: "c@example.com",
      rating: 5,
      review: PAYLOAD,
      reviewerName: PAYLOAD,
      targetType: "Coach",
    });
    assertNoInjectedMarkup(sent[0]!.html);
  });

  it("coach subscription: plan and counterpart names", async () => {
    await sendCoachSubscriptionPurchasedEmail({
      name: PAYLOAD,
      email: "c@example.com",
      counterpartName: PAYLOAD,
      packageName: PAYLOAD,
      price: 1000,
      forPlayer: true,
    });
    assertNoInjectedMarkup(sent[0]!.html);
  });

  it("email subjects stay plain text (not HTML-escaped)", async () => {
    await sendFriendRequestEmail({
      recipientName: "Rec",
      recipientEmail: "rec@example.com",
      requesterName: "Tom & Jerry's",
    });
    assert.equal(sent[0]!.subject, "Tom & Jerry's wants to connect with you on PowerMySport");
  });
});
