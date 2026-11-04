/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for phone push notifications through Expo.
//
// Three properties are the kind that fail silently in production: a message reaching someone who
// no longer owns the phone, a dead token being retried for ever, and a push going out for a type of
// message the parent turned off. Expo itself is stubbed, so nothing here ever calls the real service.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
delete process.env.EXPO_PUSH_ENABLED;

import assert = require("node:assert/strict");
const { after, before, beforeEach, afterEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { User } = require("../client/models/User");
const { DevicePushToken } = require("../client/models/DevicePushToken");
const {
  ExpoPushService,
  isExpoPushToken,
  setExpoFetchForTests,
  MAX_DEVICES_PER_USER,
} = require("../client/services/ExpoPushService");
const { DEVICE_PUSH_TOKEN_INDEXES } = require("../migrations/72_device_push_token_indexes");

let memoryServer: { getUri(): string; stop(): Promise<void> };

const tokenOf = (n: number | string) => `ExponentPushToken[test-device-${n}-abcdefgh]`;

const seedParent = async (name: string, preferences?: Record<string, unknown>) =>
  User.create({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.test`,
    phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    password: "not-a-real-password",
    role: "Parent",
    ...(preferences ? { notificationPreferences: preferences } : {}),
  });

interface Call {
  url: string;
  body: any;
  headers: Record<string, string>;
}

/** Records every call and answers like Expo: one ticket per message, or whatever the test supplies. */
const stubExpo = (answer?: (call: Call) => unknown) => {
  const calls: Call[] = [];
  setExpoFetchForTests(async (url: string, init: any) => {
    const call = { url, body: JSON.parse(init.body), headers: init.headers };
    calls.push(call);
    const data = answer
      ? answer(call)
      : url.endsWith("/send")
        ? call.body.map((_: unknown, i: number) => ({
            status: "ok",
            id: `ticket-${calls.length}-${i}`,
          }))
        : {};
    return { ok: true, status: 200, json: async () => ({ data }) };
  });
  return calls;
};

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
  await DevicePushToken.syncIndexes();
});

after(async () => {
  setExpoFetchForTests(null);
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  await DevicePushToken.deleteMany({});
  await User.deleteMany({});
  delete process.env.EXPO_PUSH_ENABLED;
});

afterEach(() => setExpoFetchForTests(null));

describe("isExpoPushToken", () => {
  it("accepts both Expo token spellings and rejects anything else", () => {
    assert.equal(isExpoPushToken("ExponentPushToken[abcdefgh12345]"), true);
    assert.equal(isExpoPushToken("ExpoPushToken[abcdefgh12345]"), true);
    assert.equal(isExpoPushToken("fcm-token-abcdefgh12345"), false);
    assert.equal(isExpoPushToken("ExponentPushToken[]"), false);
    assert.equal(isExpoPushToken("ExponentPushToken[bad token]"), false);
    assert.equal(isExpoPushToken(undefined), false);
  });
});

describe("registering devices", () => {
  it("stores one row per phone and refreshes it on every launch", async () => {
    const parent = await seedParent("Asha Rao");
    await ExpoPushService.register(parent.id, {
      token: tokenOf(1),
      platform: "android",
      deviceName: "Pixel",
    });
    await ExpoPushService.register(parent.id, {
      token: tokenOf(1),
      platform: "android",
      appVersion: "1.0.0",
    });

    const rows = await DevicePushToken.find({});
    assert.equal(rows.length, 1);
    assert.equal(rows[0].deviceName, "Pixel");
    assert.equal(rows[0].appVersion, "1.0.0");
  });

  it("moves a phone to the account that signs in on it, so the previous owner stops receiving", async () => {
    const first = await seedParent("First Parent");
    const second = await seedParent("Second Parent");
    await ExpoPushService.register(first.id, { token: tokenOf(1), platform: "android" });
    await ExpoPushService.register(second.id, { token: tokenOf(1), platform: "android" });

    assert.equal(await DevicePushToken.countDocuments({ userId: first._id }), 0);
    assert.equal(await DevicePushToken.countDocuments({ userId: second._id }), 1);
  });

  it("keeps only the newest phones for one account", async () => {
    const parent = await seedParent("Many Phones");
    for (let i = 0; i < MAX_DEVICES_PER_USER + 3; i += 1) {
      await ExpoPushService.register(parent.id, { token: tokenOf(i), platform: "android" });
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const kept = await DevicePushToken.find({ userId: parent._id }).sort({ lastSeenAt: -1 }).lean();
    assert.equal(kept.length, MAX_DEVICES_PER_USER);
    assert.ok(
      kept.some((d: { token: string }) => d.token === tokenOf(MAX_DEVICES_PER_USER + 2)),
      "newest is kept"
    );
    assert.ok(!kept.some((d: { token: string }) => d.token === tokenOf(0)), "oldest is dropped");
  });

  it("lets only the owner remove a phone", async () => {
    const owner = await seedParent("Owner Parent");
    const other = await seedParent("Other Parent");
    await ExpoPushService.register(owner.id, { token: tokenOf(1), platform: "android" });

    assert.equal(await ExpoPushService.unregister(other.id, tokenOf(1)), false);
    assert.equal(await DevicePushToken.countDocuments({}), 1);
    assert.equal(await ExpoPushService.unregister(owner.id, tokenOf(1)), true);
    assert.equal(await DevicePushToken.countDocuments({}), 0);
  });
});

describe("sending", () => {
  it("sends the title, body, data and channel to every phone the account has", async () => {
    const parent = await seedParent("Two Phones");
    await ExpoPushService.register(parent.id, { token: tokenOf(1), platform: "android" });
    await ExpoPushService.register(parent.id, { token: tokenOf(2), platform: "android" });
    const calls = stubExpo();

    const result = await ExpoPushService.sendToUser(parent.id, {
      title: "This week's ranking",
      body: "Test Child is still ranked 212",
      data: { type: "RANKING_DIGEST" },
    });

    assert.equal(result.sent, 2);
    const send = calls.find((c) => c.url.endsWith("/send"));
    assert.ok(send);
    assert.equal(send.body.length, 2);
    assert.equal(send.body[0].title, "This week's ranking");
    assert.equal(send.body[0].channelId, "default");
    assert.equal(send.body[0].priority, "high");
    assert.deepEqual(send.body[0].data, { type: "RANKING_DIGEST" });
    assert.deepEqual(
      new Set(send.body.map((m: { to: string }) => m.to)),
      new Set([tokenOf(1), tokenOf(2)])
    );
  });

  it("sends nothing, and calls nobody, for an account with no phones", async () => {
    const parent = await seedParent("No Phone");
    const calls = stubExpo();
    const result = await ExpoPushService.sendToUser(parent.id, { title: "t", body: "b" });
    assert.deepEqual(result, { sent: 0, removed: 0 });
    assert.equal(calls.length, 0);
  });

  it("never messages a phone belonging to a different account", async () => {
    const mine = await seedParent("My Account");
    const theirs = await seedParent("Their Account");
    await ExpoPushService.register(theirs.id, { token: tokenOf(9), platform: "android" });
    const calls = stubExpo();
    await ExpoPushService.sendToUser(mine.id, { title: "t", body: "b" });
    assert.equal(calls.length, 0);
  });

  it("drops a token Expo reports as no longer registered", async () => {
    const parent = await seedParent("Uninstalled");
    await ExpoPushService.register(parent.id, { token: tokenOf(1), platform: "android" });
    stubExpo(() => [
      { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
    ]);

    const result = await ExpoPushService.sendToUser(parent.id, { title: "t", body: "b" });
    assert.equal(result.removed, 1);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(await DevicePushToken.countDocuments({}), 0);
  });

  it("drops a token found dead when the receipts are checked later", async () => {
    const parent = await seedParent("Late Receipt");
    await ExpoPushService.register(parent.id, { token: tokenOf(1), platform: "android" });
    const calls = stubExpo((call) =>
      call.url.endsWith("/getReceipts")
        ? { "ticket-1": { status: "error", details: { error: "DeviceNotRegistered" } } }
        : [{ status: "ok", id: "ticket-1" }]
    );

    await ExpoPushService.sendToUser(parent.id, { title: "t", body: "b" });
    const removed = await ExpoPushService.checkReceipts([{ id: "ticket-1", token: tokenOf(1) }]);

    assert.equal(removed, 1);
    assert.equal(await DevicePushToken.countDocuments({}), 0);
    assert.ok(calls.some((c) => c.url.endsWith("/getReceipts")));
  });

  it("keeps a token when Expo rejects a message for another reason", async () => {
    const parent = await seedParent("Message Too Big");
    await ExpoPushService.register(parent.id, { token: tokenOf(1), platform: "android" });
    stubExpo(() => [{ status: "error", message: "too big", details: { error: "MessageTooBig" } }]);
    await ExpoPushService.sendToUser(parent.id, { title: "t", body: "b" });
    assert.equal(await DevicePushToken.countDocuments({}), 1);
  });

  it("does not throw when Expo is unreachable", async () => {
    const parent = await seedParent("Offline");
    await ExpoPushService.register(parent.id, { token: tokenOf(1), platform: "android" });
    setExpoFetchForTests(async () => {
      throw new Error("network down");
    });
    const result = await ExpoPushService.sendToUser(parent.id, { title: "t", body: "b" });
    assert.deepEqual(result, { sent: 0, removed: 0 });
    assert.equal(
      await DevicePushToken.countDocuments({}),
      1,
      "the token is kept for the next attempt"
    );
  });

  it("is switched off by EXPO_PUSH_ENABLED=false", async () => {
    const parent = await seedParent("Switched Off");
    await ExpoPushService.register(parent.id, { token: tokenOf(1), platform: "android" });
    const calls = stubExpo();
    process.env.EXPO_PUSH_ENABLED = "false";
    const result = await ExpoPushService.sendToUser(parent.id, { title: "t", body: "b" });
    assert.deepEqual(result, { sent: 0, removed: 0 });
    assert.equal(calls.length, 0);
  });
});

describe("through NotificationService", () => {
  it("pushes to the phone with the notification type, and not when the parent turned that push off", async () => {
    const { NotificationService } = require("../client/services/NotificationService");
    const on = await seedParent("Push On");
    const off = await seedParent("Push Off", { push: { rankingUpdates: false } });
    for (const [parent, n] of [
      [on, 1],
      [off, 2],
    ] as const) {
      await ExpoPushService.register(parent.id, { token: tokenOf(n), platform: "android" });
    }
    const calls = stubExpo();

    for (const parent of [on, off]) {
      await NotificationService.send({
        userId: parent.id,
        type: "RANKING_DIGEST",
        title: "This week's ranking",
        message: "A new list is out",
        data: { dependentId: "abc" },
      });
    }

    const sends = calls.filter((c) => c.url.endsWith("/send"));
    assert.equal(sends.length, 1, "only the parent who left ranking push on is messaged");
    const message = sends[0]!.body[0];
    assert.equal(message.to, tokenOf(1));
    assert.equal(message.data.type, "RANKING_DIGEST");
    assert.equal(message.data.dependentId, "abc");
  });
});

describe("indexes", () => {
  it("matches what migration 72 creates, because the deployed server has autoIndex off", async () => {
    const live = await DevicePushToken.collection.indexes();
    for (const spec of DEVICE_PUSH_TOKEN_INDEXES) {
      const found = live.find((i: { name: string }) => i.name === spec.name);
      assert.ok(found, `model defines ${spec.name}`);
      assert.deepEqual(found.key, spec.key);
      assert.equal(Boolean(found.unique), Boolean(spec.options.unique));
      assert.equal(found.expireAfterSeconds, spec.options.expireAfterSeconds);
    }
  });
});

describe("phone payload for scheduled notifications", () => {
  const { phonePushData } = require("../client/services/ScheduledNotificationService");

  it("carries only what the app needs to open the right screen", () => {
    const digest = phonePushData("RANKING_DIGEST", {
      asOnDate: "2026-09-07",
      players: [
        { regNo: "990001", name: "Test Child", standings: new Array(50).fill({ listLabel: "x" }) },
        { regNo: "990002" },
      ],
    });
    assert.deepEqual(digest, { type: "RANKING_DIGEST", regNo: "990001" });

    const one = phonePushData("OPPORTUNITY_ALERT", {
      items: [{ slug: "state-scholarship", title: "long", text: "long" }],
    });
    assert.deepEqual(one, { type: "OPPORTUNITY_ALERT", slug: "state-scholarship", count: 1 });

    const many = phonePushData("OPPORTUNITY_ALERT", { items: [{ slug: "a" }, { slug: "b" }] });
    assert.deepEqual(many, { type: "OPPORTUNITY_ALERT", count: 2 });

    assert.deepEqual(phonePushData("PLAN_CHECKIN", undefined), { type: "PLAN_CHECKIN" });
  });

  it("stays far below Expo's message size limit however long the lists are", () => {
    const players = Array.from({ length: 200 }, (_, i) => ({
      regNo: String(990000 + i),
      standings: new Array(20).fill({ listLabel: "Boys Under-12" }),
    }));
    assert.ok(JSON.stringify(phonePushData("RANKING_DIGEST", { players })).length < 200);
  });
});
