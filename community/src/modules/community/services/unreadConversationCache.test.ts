import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/axios", () => ({ default: { get } }));

import { communityService } from "./community";

/**
 * The nav badge refetches the unread-chats count on socket events. The count
 * is cached, so without clearing it first the refetch returned the old number
 * and the badge stayed up after the conversation had been read.
 */
describe("unread conversation count cache", () => {
  beforeEach(async () => {
    get.mockReset();
    await communityService.clearUnreadConversationCache();
  });

  it("serves a repeated read from the cache", async () => {
    get.mockResolvedValue({ data: { data: { count: 3 } } });

    await communityService.getUnreadConversationCount();
    await communityService.getUnreadConversationCount();

    expect(get).toHaveBeenCalledTimes(1);
  });

  it("returns the fresh number after the cache is cleared", async () => {
    get.mockResolvedValueOnce({ data: { data: { count: 3 } } });
    expect(await communityService.getUnreadConversationCount()).toBe(3);

    get.mockResolvedValueOnce({ data: { data: { count: 0 } } });
    await communityService.clearUnreadConversationCache();

    expect(await communityService.getUnreadConversationCount()).toBe(0);
  });
});
