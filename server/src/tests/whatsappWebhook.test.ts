import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import express from "express";
import request from "supertest";
import whatsappWebhook from "../shared/routes/whatsappWebhook";
import {
  extractInboundMessages,
  isValidMetaSignature,
  maskPhone,
} from "../shared/services/whatsappService";

/**
 * The WhatsApp webhook is a public URL, so what keeps strangers out is the
 * verify-token handshake and the HMAC on every POST. Both are pinned here, with
 * the app wired the way app.ts wires it (raw body captured by express.json).
 */

const SECRET = "test-app-secret";
const VERIFY = "test-verify-token";

function buildApp() {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody: string }).rawBody = buf.toString();
      },
    })
  );
  app.use("/api/whatsapp", whatsappWebhook);
  return app;
}

function sign(body: string, secret = SECRET): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

const textPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "1",
      changes: [
        {
          field: "messages",
          value: {
            messages: [
              { id: "wamid.A", from: "919876543210", type: "text", text: { body: "hello" } },
            ],
          },
        },
      ],
    },
  ],
};

test("GET echoes the challenge when the verify token matches", async () => {
  process.env.WHATSAPP_VERIFY_TOKEN = VERIFY;
  const res = await request(buildApp())
    .get("/api/whatsapp/webhook")
    .query({ "hub.mode": "subscribe", "hub.verify_token": VERIFY, "hub.challenge": "12345" });

  assert.equal(res.status, 200);
  assert.equal(res.text, "12345");
});

test("GET refuses a wrong verify token", async () => {
  process.env.WHATSAPP_VERIFY_TOKEN = VERIFY;
  const res = await request(buildApp())
    .get("/api/whatsapp/webhook")
    .query({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "12345" });

  assert.equal(res.status, 403);
});

test("GET answers 503 when no verify token is configured", async () => {
  delete process.env.WHATSAPP_VERIFY_TOKEN;
  const res = await request(buildApp())
    .get("/api/whatsapp/webhook")
    .query({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "12345" });

  assert.equal(res.status, 503);
});

test("POST with a valid signature is acknowledged", async () => {
  process.env.META_APP_SECRET = SECRET;
  delete process.env.WHATSAPP_ACCESS_TOKEN; // no sending in this test
  const body = JSON.stringify(textPayload);
  const res = await request(buildApp())
    .post("/api/whatsapp/webhook")
    .set("Content-Type", "application/json")
    .set("X-Hub-Signature-256", sign(body))
    .send(body);

  assert.equal(res.status, 200);
});

test("POST with a bad or missing signature is rejected", async () => {
  process.env.META_APP_SECRET = SECRET;
  const body = JSON.stringify(textPayload);

  const forged = await request(buildApp())
    .post("/api/whatsapp/webhook")
    .set("Content-Type", "application/json")
    .set("X-Hub-Signature-256", sign(body, "someone-elses-secret"))
    .send(body);
  const missing = await request(buildApp())
    .post("/api/whatsapp/webhook")
    .set("Content-Type", "application/json")
    .send(body);

  assert.equal(forged.status, 401);
  assert.equal(missing.status, 401);
});

test("the signature covers the exact bytes, so an edited body fails", () => {
  const body = JSON.stringify(textPayload);
  const header = sign(body);

  assert.equal(isValidMetaSignature(body, header, SECRET), true);
  assert.equal(isValidMetaSignature(body.replace("hello", "hullo"), header, SECRET), false);
});

test("extractInboundMessages reads text and list replies, and ignores status updates", () => {
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                { id: "a", from: "91111", type: "text", text: { body: "hi" } },
                {
                  id: "b",
                  from: "91111",
                  type: "interactive",
                  interactive: { list_reply: { id: "x", title: "Tournaments" } },
                },
                { id: "c", from: "91111", type: "image" },
              ],
            },
          },
          { value: { statuses: [{ id: "s", status: "delivered" }] } },
        ],
      },
    ],
  };

  assert.deepEqual(
    extractInboundMessages(payload).map((m) => [m.id, m.type, m.text]),
    [
      ["a", "text", "hi"],
      ["b", "interactive", "Tournaments"],
      ["c", "image", null],
    ]
  );
  assert.deepEqual(extractInboundMessages(null), []);
  assert.deepEqual(extractInboundMessages({ entry: "nope" }), []);
});

test("maskPhone keeps only the country prefix and last two digits", () => {
  assert.equal(maskPhone("919876543210"), "91********10");
  assert.equal(maskPhone("123"), "****");
});
