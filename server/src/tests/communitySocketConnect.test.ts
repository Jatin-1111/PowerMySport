import assert from "node:assert/strict";
import test, { mock } from "node:test";
import type { Server } from "socket.io";
import { setupCommunitySocket } from "../community/sockets/communitySocket";
import { CommunityService } from "../community/services/CommunityService";
import * as presence from "../shared/services/UserPresenceService";

/**
 * An event sent right after connecting used to be dropped: the `connection`
 * handler awaited the database (last seen, presence, the recent-conversation
 * lookup) before registering any `socket.on`, so for those first few hundred
 * milliseconds nothing was listening and the emit vanished with no ack. The
 * client replays its room joins and flushes queued sends at exactly that moment.
 *
 * These tests hold the database calls open forever and check the handlers are
 * already registered, which fails against the old ordering.
 */

const EXPECTED_HANDLERS = [
  "community:sendMessage",
  "community:markRead",
  "community:joinConversation",
  "community:editMessage",
  "community:deleteMessage",
  "community:reactToMessage",
  "community:typingStart",
  "community:subscribe",
  "disconnect",
];

type Handler = (...args: unknown[]) => unknown;

const connectFakeSocket = () => {
  let onConnection: Handler | undefined;
  const namespace = {
    use() {},
    on(event: string, handler: Handler) {
      if (event === "connection") onConnection = handler;
    },
    to: () => ({ emit() {} }),
  };
  setupCommunitySocket({ of: () => namespace } as unknown as Server);

  const registered = new Map<string, Handler>();
  const joined: string[] = [];
  const socket = {
    id: "socket-1",
    data: { userId: "user-1" },
    handshake: { auth: {}, headers: {} },
    join: (room: string) => void joined.push(room),
    leave() {},
    emit() {},
    to: () => ({ emit() {} }),
    on: (event: string, handler: Handler) => void registered.set(event, handler),
  };

  assert.ok(onConnection, "setupCommunitySocket registered a connection handler");
  const result = onConnection(socket);
  return { registered, joined, result };
};

test("socket handlers exist before any database call resolves", async (t) => {
  const never = new Promise<never>(() => {});
  t.mock.method(CommunityService, "touchLastSeen", () => never);
  t.mock.method(CommunityService, "listRecentConversationIdsForRealtime", () => never);
  t.mock.method(presence, "markUserOnline", () => never);

  const { registered, joined } = connectFakeSocket();

  // Checked synchronously: nothing has had a chance to resolve.
  for (const name of EXPECTED_HANDLERS) {
    assert.ok(registered.has(name), `${name} is registered immediately after connection`);
  }
  assert.ok(joined.includes("user:user-1"), "the personal room is joined without waiting");
});

test("recent conversations are still joined once the lookup resolves", async (t) => {
  t.mock.method(CommunityService, "touchLastSeen", async () => undefined);
  t.mock.method(CommunityService, "listRecentConversationIdsForRealtime", async () => ["c1", "c2"]);
  t.mock.method(presence, "markUserOnline", async () => undefined);

  const { joined } = connectFakeSocket();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.ok(joined.includes("conversation:c1"));
  assert.ok(joined.includes("conversation:c2"));
});

test("a socket that drops immediately is marked offline only after it was marked online", async (t) => {
  const order: string[] = [];
  let releaseOnline: () => void = () => {};
  t.mock.method(CommunityService, "touchLastSeen", async () => undefined);
  t.mock.method(CommunityService, "listRecentConversationIdsForRealtime", async () => []);
  t.mock.method(presence, "markUserOnline", async () => {
    await new Promise<void>((resolve) => (releaseOnline = resolve));
    order.push("online");
  });
  t.mock.method(presence, "markUserOffline", async () => void order.push("offline"));

  const { registered } = connectFakeSocket();
  const disconnecting = registered.get("disconnect")!() as Promise<void>;
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(order, [], "offline waits for the online write to finish");

  releaseOnline();
  await disconnecting;
  assert.deepEqual(order, ["online", "offline"]);
});

test.after(() => mock.reset());
