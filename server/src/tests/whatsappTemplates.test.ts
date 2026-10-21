/* eslint-disable @typescript-eslint/no-var-requires */
// The booking templates: which template and which variables each event produces,
// that nothing Meta would reject is sent, and that the switch really moves
// booking messages from n8n to a direct send. Meta's API is stubbed.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");

const {
  buildBookingTemplate,
  cleanParam,
  formatIstDateTime,
  sendBookingTemplate,
} = require("../shared/services/whatsappTemplates");
const { notifyBookingWhatsApp } = require("../shared/services/WhatsAppNotificationService");

const realFetch = globalThis.fetch;
let calls: Array<{ url: string; body: any }> = [];

const base = {
  playerPhone: "919876543210",
  playerName: "Aarav Sharma",
  sport: "Tennis",
  // 18:00 IST on 25 Oct 2026.
  dateTime: "2026-10-25T12:30:00.000Z",
};

const settle = () => new Promise((r) => setTimeout(r, 80));

beforeEach(() => {
  calls = [];
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
  (globalThis as any).fetch = async (url: string, init: any) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return { ok: true, text: async () => "" };
  };
});

afterEach(() => {
  (globalThis as any).fetch = realFetch;
  delete process.env.WHATSAPP_TEMPLATES;
  delete process.env.N8N_BOOKING_WEBHOOK_URL;
  delete process.env.PMS_SERVER_WEBHOOK_SECRET;
});

describe("dates in the messages", () => {
  it("shows Indian time, whatever the server clock is", () => {
    assert.equal(formatIstDateTime("2026-10-25T12:30:00.000Z"), "25 Oct 2026, 6:00 PM");
    assert.equal(formatIstDateTime("2026-09-03T04:00:00.000Z"), "3 Sep 2026, 9:30 AM");
    assert.equal(formatIstDateTime("not a date"), "");
  });
});

describe("variables Meta would refuse", () => {
  it("flattens newlines and runs of spaces, trims, caps the length, and never sends an empty one", () => {
    assert.equal(cleanParam("Aarav\nSharma\t  Jr "), "Aarav Sharma Jr");
    assert.equal(cleanParam("   "), "-");
    assert.equal(cleanParam(undefined), "-");
    assert.equal(cleanParam("x".repeat(500)).length, 200);
  });
});

describe("which template each event uses", () => {
  it("confirms with the venue and coach when there are some", () => {
    assert.deepEqual(
      buildBookingTemplate("BOOKING_CONFIRMED", {
        ...base,
        venue: "Centre Court",
        coachName: "Ravi",
      }),
      {
        name: "booking_confirmed",
        params: [
          "Aarav Sharma",
          "Tennis",
          "25 Oct 2026, 6:00 PM",
          "Venue: Centre Court. Coach: Ravi.",
        ],
      }
    );
  });

  it("still fills the last variable when there is neither", () => {
    const t = buildBookingTemplate("BOOKING_CONFIRMED", base);
    assert.equal(t.params[3], "Open your dashboard for the details.");
  });

  it("says a refund is on its way only when there is one", () => {
    const withRefund = buildBookingTemplate("BOOKING_CANCELLED", { ...base, refundAmount: 400 });
    assert.equal(withRefund.name, "booking_cancelled");
    assert.equal(withRefund.params[3], "A refund of Rs 400 is on its way.");
    const without = buildBookingTemplate("BOOKING_CANCELLED", { ...base, refundAmount: 0 });
    assert.equal(without.params[3], "Check your dashboard for the payment details.");
  });

  it("reschedules from the old time to the new one, and sends nothing without a new time", () => {
    const t = buildBookingTemplate("BOOKING_RESCHEDULED", {
      ...base,
      newDateTime: "2026-10-26T11:30:00.000Z",
    });
    assert.deepEqual(t.params, [
      "Aarav Sharma",
      "Tennis",
      "25 Oct 2026, 6:00 PM",
      "26 Oct 2026, 5:00 PM",
    ]);
    assert.equal(buildBookingTemplate("BOOKING_RESCHEDULED", base), null);
  });

  it("builds a reminder, and refuses a booking with no usable date", () => {
    assert.equal(buildBookingTemplate("BOOKING_REMINDER", base).name, "booking_reminder");
    assert.equal(buildBookingTemplate("BOOKING_CONFIRMED", { ...base, dateTime: "" }), null);
  });
});

describe("sending", () => {
  it("posts the template to Meta with the approved name, language and variables", async () => {
    assert.equal(
      await sendBookingTemplate("BOOKING_CANCELLED", { ...base, refundAmount: 400 }),
      true
    );
    assert.equal(calls.length, 1);
    assert.match(calls[0]!.url, /\/123456\/messages$/);
    const body = calls[0]!.body;
    assert.equal(body.to, "919876543210");
    assert.equal(body.type, "template");
    assert.equal(body.template.name, "booking_cancelled");
    assert.equal(body.template.language.code, "en");
    assert.deepEqual(
      body.template.components[0].parameters.map((p: any) => p.text),
      ["Aarav Sharma", "Tennis", "25 Oct 2026, 6:00 PM", "A refund of Rs 400 is on its way."]
    );
  });

  it("does nothing when sending is not configured", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    assert.equal(await sendBookingTemplate("BOOKING_CONFIRMED", base), false);
    assert.equal(calls.length, 0);
  });

  it("reports a refusal from Meta instead of throwing", async () => {
    (globalThis as any).fetch = async () => ({
      ok: false,
      status: 400,
      text: async () => "template not found",
    });
    assert.equal(await sendBookingTemplate("BOOKING_CONFIRMED", base), false);
  });
});

describe("the switch between n8n and a direct send", () => {
  it("sends the template from this server when WHATSAPP_TEMPLATES is on", async () => {
    process.env.WHATSAPP_TEMPLATES = "on";
    notifyBookingWhatsApp({ ...base, event: "BOOKING_CONFIRMED" });
    await settle();
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.body.template.name, "booking_confirmed");
  });

  it("does not touch Meta when it is off, so n8n stays the route", async () => {
    notifyBookingWhatsApp({ ...base, event: "BOOKING_CONFIRMED" });
    await settle();
    assert.equal(calls.length, 0);
  });
});
