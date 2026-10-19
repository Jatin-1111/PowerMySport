/* eslint-disable @typescript-eslint/no-var-requires */
// The pieces that keep the WhatsApp assistant a pilot: who may use it, not
// answering one message twice, and what counts as "stop". The webhook is driven
// with Meta's API stubbed, so nothing is sent anywhere.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
import crypto = require("node:crypto");
const { after, afterEach, before, beforeEach, describe, it } = require("node:test");
const express = require("express");
const request = require("supertest");

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const {
  PILOT_REPLY,
  claimInboundMessage,
  isOnEnvList,
  isOptOutMessage,
  parseAllowList,
} = require("../shared/services/whatsappPilot");
const {
  addPilotNumbers,
  listPilotNumbers,
  mayUseAssistant,
  parsePilotInput,
  removePilotNumber,
  setPilotMode,
} = require("../shared/services/whatsappPilotNumbers");
const { WhatsAppPilotNumber } = require("../shared/models/WhatsAppPilotNumber");
const whatsappWebhook = require("../shared/routes/whatsappWebhook").default;
const redis = require("../config/redis").default;

let mongod: any;
before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

describe("the pilot allow-list", () => {
  it("reads numbers in the forms people type them, as Meta's 12-digit form", () => {
    const list = parseAllowList("9876543210, +91 98765 43211 ,09876543212, nonsense");
    assert.deepEqual([...list].sort(), ["919876543210", "919876543211", "919876543212"]);
  });

  it("matches a sender against the environment list, in any form", () => {
    assert.equal(isOnEnvList("919876543210", "9876543210"), true);
    assert.equal(isOnEnvList("919876543299", "9876543210"), false);
    assert.equal(isOnEnvList("919876543210", undefined), false);
    assert.equal(isOnEnvList("919876543210", ""), false);
  });
});

describe("pasted numbers", () => {
  it("reads one number per line with an optional name, and says which lines it could not", () => {
    const { entries, invalid } = parsePilotInput(
      [
        "9876543210, Coach Ravi",
        "+91 98765 43211 Meera (parent)",
        "09876543212",
        "9876543210",
        "12345",
        "not a number",
        "",
      ].join("\n")
    );
    assert.deepEqual(entries, [
      { phone: "919876543210", label: "Coach Ravi" },
      { phone: "919876543211", label: "Meera (parent)" },
      { phone: "919876543212", label: "" },
    ]);
    assert.deepEqual(invalid, ["12345", "not a number"]);
  });

  it("refuses a number that is not an Indian mobile", () => {
    assert.equal(parsePilotInput("919876543210").invalid.length, 0);
    assert.equal(parsePilotInput("5551234567").entries.length, 0);
  });
});

describe("the database allow-list", () => {
  beforeEach(async () => {
    await WhatsAppPilotNumber.deleteMany({});
    await setPilotMode("listed");
    delete process.env.WHATSAPP_ALLOWED_NUMBERS;
  });

  it("is closed when nothing is listed", async () => {
    assert.equal(await mayUseAssistant("919876543210"), false);
  });

  it("lets a listed number in, stores only a hash and the last four digits, and drops it on removal", async () => {
    const result = await addPilotNumbers("9876543210, Coach Ravi", "admin-1");
    assert.deepEqual(result, { added: 1, alreadyListed: 0, invalid: [] });
    assert.equal(await mayUseAssistant("919876543210"), true);
    assert.equal(await mayUseAssistant("919876543299"), false);

    const raw = await WhatsAppPilotNumber.collection.findOne({});
    assert.equal(JSON.stringify(raw).includes("9876543210"), false);
    assert.equal(raw.lastFour, "3210");

    const [entry] = await listPilotNumbers();
    assert.equal(entry.label, "Coach Ravi");
    assert.equal(await removePilotNumber(entry.id), true);
    assert.equal(await mayUseAssistant("919876543210"), false);
  });

  it("counts a number that is already listed instead of adding it twice", async () => {
    await addPilotNumbers("9876543210");
    const again = await addPilotNumbers("+91 98765 43210");
    assert.equal(again.added, 0);
    assert.equal(again.alreadyListed, 1);
    assert.equal((await listPilotNumbers()).length, 1);
  });

  it("lets everyone in when staff choose that, and only the listed ones when they switch back", async () => {
    await setPilotMode("everyone");
    assert.equal(await mayUseAssistant("919000000001"), true);
    await setPilotMode("listed");
    assert.equal(await mayUseAssistant("919000000001"), false);
  });

  it("still lets in a number on the environment list", async () => {
    process.env.WHATSAPP_ALLOWED_NUMBERS = "9876543210";
    assert.equal(await mayUseAssistant("919876543210"), true);
  });
});

describe("claiming a message once", () => {
  it("is true the first time an id is seen and false for every repeat", async () => {
    const id = `wamid.${crypto.randomUUID()}`;
    assert.equal(await claimInboundMessage(id), true);
    assert.equal(await claimInboundMessage(id), false);
    assert.equal(await claimInboundMessage(id), false);
    assert.equal(await claimInboundMessage(`wamid.${crypto.randomUUID()}`), true);
  });
});

describe("stop words", () => {
  it("treats a message that is only a request to stop as one", () => {
    for (const text of ["STOP", "stop", "Stop!", " delete my data ", "Unsubscribe", "forget me"]) {
      assert.equal(isOptOutMessage(text), true, text);
    }
  });

  it("does not take a question that merely contains the word as one", () => {
    for (const text of [
      "How do I stop my son from losing interest?",
      "Please don't stop the tournament updates",
      "Which sport suits a 12 year old?",
      "",
      null,
    ]) {
      assert.equal(isOptOutMessage(text as string | null), false, String(text));
    }
  });
});

// ─── The webhook, with Meta's API stubbed ─────────────────────────────────────

const SECRET = "pilot-test-secret";
const realFetch = globalThis.fetch;
let sent: Array<{ path: string; body: any }> = [];

const buildApp = () => {
  const app = express();
  app.use(
    express.json({
      verify: (req: any, _res: unknown, buf: Buffer) => {
        req.rawBody = buf.toString();
      },
    })
  );
  app.use("/api/whatsapp", whatsappWebhook);
  return app;
};

const payload = (id: string, from: string) =>
  JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              messages: [{ id, from, type: "text", text: { body: "hello" } }],
            },
          },
        ],
      },
    ],
  });

const post = (body: string) =>
  request(buildApp())
    .post("/api/whatsapp/webhook")
    .set("Content-Type", "application/json")
    .set(
      "X-Hub-Signature-256",
      `sha256=${crypto.createHmac("sha256", SECRET).update(body, "utf8").digest("hex")}`
    )
    .send(body);

/** The messages are handled after the response, so wait until the count settles. */
const settle = async (min: number) => {
  for (let i = 0; i < 60 && sent.length < min; i++) await new Promise((r) => setTimeout(r, 25));
  await new Promise((r) => setTimeout(r, 100));
};

describe("the webhook in pilot mode", () => {
  beforeEach(() => {
    sent = [];
    process.env.META_APP_SECRET = SECRET;
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    process.env.WHATSAPP_ASSISTANT = "on";
    process.env.WHATSAPP_ALLOWED_NUMBERS = "9876543210";
    (globalThis as any).fetch = async (url: string, init: any) => {
      sent.push({ path: String(url), body: JSON.parse(init.body) });
      return { ok: true, text: async () => "" };
    };
  });

  afterEach(() => {
    (globalThis as any).fetch = realFetch;
    delete process.env.WHATSAPP_ASSISTANT;
    delete process.env.WHATSAPP_ALLOWED_NUMBERS;
  });

  it("tells a number that is not on the list it is a pilot, and sends nothing else", async () => {
    const res = await post(payload(`wamid.${crypto.randomUUID()}`, "919000000001"));
    assert.equal(res.status, 200);
    await settle(2);

    const texts = sent.filter((m) => m.body.type === "text");
    assert.equal(texts.length, 1);
    assert.equal(texts[0]!.body.to, "919000000001");
    assert.equal(texts[0]!.body.text.body, PILOT_REPLY);
  });

  it("answers a redelivered message once", async () => {
    const id = `wamid.${crypto.randomUUID()}`;
    await post(payload(id, "919000000002"));
    await post(payload(id, "919000000002"));
    await post(payload(id, "919000000002"));
    await settle(2);

    assert.equal(sent.filter((m) => m.body.type === "text").length, 1);
  });
});
