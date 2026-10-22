import { describe, expect, it } from "vitest";
import type { ConversationMessage } from "../types";
import { insertByCreatedAt, mergeServerMessages } from "./mergeMessages";

const message = (id: string, at: string, extra: Partial<ConversationMessage> = {}) =>
  ({
    id,
    conversationId: "c1",
    senderId: "a",
    content: id,
    createdAt: at,
    readBy: ["a"],
    deliveredTo: [],
    ...extra,
  }) as ConversationMessage;

describe("mergeServerMessages", () => {
  it("does not roll a read tick back when the response predates the read", () => {
    const local = [message("m1", "2026-10-22T06:39:00Z", { readBy: ["a", "b"] })];
    const stale = [message("m1", "2026-10-22T06:39:00Z", { readBy: ["a"] })];

    const [merged] = mergeServerMessages(local, stale);

    expect(merged!.readBy).toEqual(["a", "b"]);
  });

  it("keeps a message the response has not listed yet", () => {
    const local = [message("m1", "2026-10-22T06:39:00Z"), message("m2", "2026-10-22T06:40:00Z")];
    const stale = [message("m1", "2026-10-22T06:39:00Z")];

    expect(mergeServerMessages(local, stale).map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("keeps an unsent optimistic message in time order", () => {
    const local = [message("temp-1", "2026-10-22T06:41:00Z", { messageStatus: "SENDING" })];
    const server = [message("m1", "2026-10-22T06:39:00Z"), message("m3", "2026-10-22T06:42:00Z")];

    expect(mergeServerMessages(local, server).map((m) => m.id)).toEqual(["m1", "temp-1", "m3"]);
  });

  it("takes edits and deletions from the server", () => {
    const local = [message("m1", "2026-10-22T06:39:00Z", { content: "old" })];
    const server = [message("m1", "2026-10-22T06:39:00Z", { content: "new", isDeleted: true })];

    const [merged] = mergeServerMessages(local, server);

    expect(merged!.content).toBe("new");
    expect(merged!.isDeleted).toBe(true);
  });

  it("returns the server page as-is when nothing is held locally", () => {
    const server = [message("m1", "2026-10-22T06:39:00Z")];

    expect(mergeServerMessages([], server)).toEqual(server);
  });
});

describe("insertByCreatedAt", () => {
  it("appends a newer message", () => {
    const list = [message("m1", "2026-10-22T06:39:00Z")];
    expect(insertByCreatedAt(list, message("m2", "2026-10-22T06:40:00Z")).map((m) => m.id)).toEqual(
      ["m1", "m2"]
    );
  });

  it("places a late arrival where it was created", () => {
    const list = [message("m1", "2026-10-22T06:39:00Z"), message("m3", "2026-10-22T06:41:00Z")];
    expect(insertByCreatedAt(list, message("m2", "2026-10-22T06:40:00Z")).map((m) => m.id)).toEqual(
      ["m1", "m2", "m3"]
    );
  });

  it("appends when the timestamp cannot be read", () => {
    const list = [message("m1", "2026-10-22T06:39:00Z")];
    expect(insertByCreatedAt(list, message("m2", "not a date")).map((m) => m.id)).toEqual([
      "m1",
      "m2",
    ]);
  });
});
