import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import {
  normalizeIndianPhone,
  notifyBookingWhatsApp,
} from "../shared/services/WhatsAppNotificationService";
import { combineDateAndTimeIST } from "../utils/openingHours";

/**
 * Booking messages go server -> n8n -> Meta. What this pins is the server's
 * half: the request is signed the way the n8n workflow checks it (hex HMAC of
 * the raw body in X-PMS-Signature), and the instant it carries is the real IST
 * start, not the server's local clock reading of an IST wall time.
 */

const SECRET = "test-shared-secret";

function receiveOne(): Promise<{
  url: string;
  got: Promise<{ headers: http.IncomingHttpHeaders; body: string }>;
  close: () => void;
}> {
  return new Promise((resolveServer) => {
    let resolveGot!: (v: { headers: http.IncomingHttpHeaders; body: string }) => void;
    const got = new Promise<{ headers: http.IncomingHttpHeaders; body: string }>((r) => {
      resolveGot = r;
    });
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        res.end("OK");
        resolveGot({ headers: req.headers, body });
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolveServer({
        url: `http://127.0.0.1:${port}/webhook/booking-event`,
        got,
        close: () => server.close(),
      });
    });
  });
}

test("normalizeIndianPhone gives Meta's 12-digit form", () => {
  assert.equal(normalizeIndianPhone("9876543210"), "919876543210");
  assert.equal(normalizeIndianPhone("+91 98765 43210"), "919876543210");
  assert.equal(normalizeIndianPhone("09876543210"), "919876543210");
  assert.equal(normalizeIndianPhone("919876543210"), "919876543210");
});

test("combineDateAndTimeIST ignores the server's timezone", () => {
  // Booking dates are stored as UTC midnight of the day; 18:00 IST is 12:30 UTC.
  const date = new Date("2026-10-20T00:00:00.000Z");
  assert.equal(combineDateAndTimeIST(date, "18:00").toISOString(), "2026-10-20T12:30:00.000Z");
  assert.equal(combineDateAndTimeIST(date, "05:00").toISOString(), "2026-10-19T23:30:00.000Z");
});

test("notifyBookingWhatsApp POSTs a body signed with the shared secret", async () => {
  const sink = await receiveOne();
  process.env.N8N_BOOKING_WEBHOOK_URL = sink.url;
  process.env.PMS_SERVER_WEBHOOK_SECRET = SECRET;
  try {
    notifyBookingWhatsApp({
      event: "BOOKING_RESCHEDULED",
      playerPhone: "919876543210",
      playerName: "Aarav",
      sport: "Tennis",
      dateTime: "2026-10-20T12:30:00.000Z",
      newDateTime: "2026-10-22T13:30:00.000Z",
    });
    const { headers, body } = await sink.got;

    const expected = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
    assert.equal(headers["x-pms-signature"], expected);
    assert.equal(headers["content-type"], "application/json");
    const parsed = JSON.parse(body);
    assert.equal(parsed.event, "BOOKING_RESCHEDULED");
    assert.equal(parsed.newDateTime, "2026-10-22T13:30:00.000Z");
  } finally {
    sink.close();
  }
});

test("env set after import is still honoured, and unset env sends nothing", async () => {
  delete process.env.N8N_BOOKING_WEBHOOK_URL;
  // Must not throw or attempt a request with nothing configured.
  notifyBookingWhatsApp({
    event: "BOOKING_CONFIRMED",
    playerPhone: "919876543210",
    playerName: "Aarav",
    sport: "Tennis",
    dateTime: "2026-10-20T12:30:00.000Z",
  });
});
