import assert from "node:assert/strict";
import test, { mock } from "node:test";
import type { Server } from "socket.io";
import { setupCommunitySocket } from "../community/sockets/communitySocket";
import { CommunityService } from "../community/services/CommunityService";
import * as presence from "../shared/services/UserPresenceService";

/**
 * A reader with read receipts switched off must not tell the other side they
 * read. The history endpoint already hid it; the realtime `messagesRead` event
 * went to the whole conversation room regardless, so the setting did nothing
 * for anyone watching live.
 */

type Handler = (...args: unknown[]) => unknown;
type Emit = { room: string; event: string; payload: Record<string, unknown> };

const connectAndMarkRead = async (readReceiptsShared: boolean) => {
  const emitted: Emit[] = [];
  let onConnection: Handler | undefined;
  const namespace = {
    use() {},
    on(event: string, handler: Handler) {
      if (event === "connection") onConnection = handler;
    },
    to: (room: string) => ({
      emit: (event: string, payload: Record<string, unknown>) =>
        void emitted.push({ room, event, payload }),
    }),
  };
  setupCommunitySocket({ of: () => namespace } as unknown as Server);

  const handlers = new Map<string, Handler>();
  const socket = {
    id: "socket-1",
    data: { userId: "reader-1" },
    handshake: { auth: {}, headers: {} },
    join() {},
    leave() {},
    emit() {},
    to: () => ({ emit() {} }),
    on: (event: string, handler: Handler) => void handlers.set(event, handler),
  };
  onConnection!(socket);

  mock.method(CommunityService, "markConversationRead", async () => ({
    conversationId: "conv-1",
    participantIds: ["reader-1", "other-1"],
    readerId: "reader-1",
    messageIds: ["m1", "m2"],
    readReceiptsShared,
  }));
  await (handlers.get("community:markRead")!(
    { conversationId: "conv-1" },
    () => {}
  ) as Promise<void>);

  return emitted.filter((entry) => entry.event === "community:messagesRead");
};

test("shares the read event with the conversation when receipts are on", async (t) => {
  t.mock.method(CommunityService, "touchLastSeen", async () => undefined);
  t.mock.method(CommunityService, "listRecentConversationIdsForRealtime", async () => []);
  t.mock.method(presence, "markUserOnline", async () => undefined);

  const events = await connectAndMarkRead(true);

  assert.deepEqual(
    events.map((entry) => entry.room),
    ["conversation:conv-1"]
  );
});

test("keeps the read event to the reader's own tabs when receipts are off", async (t) => {
  t.mock.method(CommunityService, "touchLastSeen", async () => undefined);
  t.mock.method(CommunityService, "listRecentConversationIdsForRealtime", async () => []);
  t.mock.method(presence, "markUserOnline", async () => undefined);

  const events = await connectAndMarkRead(false);

  assert.deepEqual(
    events.map((entry) => entry.room),
    ["user:reader-1"],
    "nothing reaches the conversation room"
  );
});

test.after(() => mock.reset());
