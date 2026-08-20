import assert from "node:assert/strict";
import test from "node:test";
import type { Server } from "socket.io";
import {
  assertSubscribableRoom,
  BLOG_FEED_ROOM,
  blogRoom,
  emitCommunityBlogEvent,
  emitCommunityGroupEvent,
  emitCommunityQnaEvent,
  emitCommunityUserEvent,
  QNA_FEED_ROOM,
  qnaPostRoom,
  setCommunityRealtimeSocketInstance,
} from "../community/services/CommunityRealtimeService";

interface Emitted {
  rooms: string[] | string;
  event: string;
  payload: Record<string, unknown>;
}

/** Minimal stand-in for the socket.io Server, capturing what `.to().emit()`
 *  was handed. A namespace-wide `.emit()` with no `.to()` records `rooms: []`,
 *  which is exactly the regression this file exists to catch. */
const createFakeIo = (sink: Emitted[]) => {
  const namespace = {
    to(rooms: string[] | string) {
      return {
        emit(event: string, payload: Record<string, unknown>) {
          sink.push({ rooms, event, payload });
        },
      };
    },
    emit(event: string, payload: Record<string, unknown>) {
      sink.push({ rooms: [], event, payload });
    },
  };

  return { of: () => namespace } as unknown as Server;
};

const setup = () => {
  const sink: Emitted[] = [];
  setCommunityRealtimeSocketInstance(createFakeIo(sink));
  return sink;
};

const roomsOf = (entry: Emitted): string[] =>
  Array.isArray(entry.rooms) ? entry.rooms : [entry.rooms];

const POST_ID = "64b7f0c2a1d4e5f60718293a";
const BLOG_ID = "64b7f0c2a1d4e5f60718293b";

test("qna events never broadcast namespace-wide", () => {
  const sink = setup();

  emitCommunityQnaEvent("community:qnaPostCreated", { postId: POST_ID }, [
    QNA_FEED_ROOM,
  ]);
  emitCommunityQnaEvent(
    "community:qnaAnswerCreated",
    { postId: POST_ID },
    [QNA_FEED_ROOM, qnaPostRoom(POST_ID)],
  );

  assert.equal(sink.length, 2);
  for (const entry of sink) {
    assert.ok(
      roomsOf(entry).length > 0,
      `${entry.event} was emitted without a room`,
    );
  }
});

test("answer edits reach the detail room only, not the feed", () => {
  const sink = setup();

  emitCommunityQnaEvent("community:qnaAnswerUpdated", { postId: POST_ID }, [
    qnaPostRoom(POST_ID),
  ]);

  assert.deepEqual(roomsOf(sink[0]!), [`qna:post:${POST_ID}`]);
});

test("blog likes address the parent blog's room", () => {
  const sink = setup();

  emitCommunityBlogEvent(
    "community:blogLiked",
    { targetType: "COMMENT", blogId: BLOG_ID },
    [blogRoom(BLOG_ID)],
  );

  assert.deepEqual(roomsOf(sink[0]!), [`blog:${BLOG_ID}`]);
});

test("an empty room list emits nothing at all", () => {
  const sink = setup();

  // The blogLiked call site passes `[]` when it cannot resolve a parent blog.
  // That must drop the event, not fall back to telling everyone.
  emitCommunityBlogEvent("community:blogLiked", { targetType: "COMMENT" }, []);

  assert.equal(sink.length, 0);
});

test("group and user events stay on their own rooms", () => {
  const sink = setup();

  emitCommunityGroupEvent("g1", "community:groupMembersUpdated", {});
  emitCommunityUserEvent("u1", "community:reportUpdated", {});

  assert.deepEqual(roomsOf(sink[0]!), ["group:g1"]);
  assert.deepEqual(roomsOf(sink[1]!), ["user:u1"]);
});

test("emitted payloads carry a timestamp", () => {
  const sink = setup();

  emitCommunityBlogEvent("community:blogCreated", { blogId: BLOG_ID }, [
    BLOG_FEED_ROOM,
  ]);

  assert.equal(typeof sink[0]!.payload.timestamp, "string");
});

test("subscribable rooms are limited to the public qna and blog surfaces", () => {
  assert.ok(assertSubscribableRoom(QNA_FEED_ROOM));
  assert.ok(assertSubscribableRoom(BLOG_FEED_ROOM));
  assert.ok(assertSubscribableRoom(qnaPostRoom(POST_ID)));
  assert.ok(assertSubscribableRoom(blogRoom(BLOG_ID)));
});

test("access-checked rooms cannot be joined via community:subscribe", () => {
  // The whole point of the allowlist: a client must not be able to name a
  // conversation or group room here and skip the access check those rooms get
  // in their own join handlers.
  assert.equal(assertSubscribableRoom(`conversation:${POST_ID}`), false);
  assert.equal(assertSubscribableRoom(`group:${POST_ID}`), false);
  assert.equal(assertSubscribableRoom(`user:${POST_ID}`), false);
  assert.equal(assertSubscribableRoom(""), false);
  assert.equal(assertSubscribableRoom("qna:post:not-an-object-id"), false);
  assert.equal(assertSubscribableRoom("blog:*"), false);
  assert.equal(assertSubscribableRoom("qna:feed:extra"), false);
});
