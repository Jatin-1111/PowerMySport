// @vitest-environment jsdom
//
// One message with no spaces (a pasted URL, a keyboard mash) used to widen the
// whole thread to several screens, which pushed every right-aligned message
// out of view for everyone in the conversation. jsdom has no layout, so this
// pins the three things that stop it: the text may break anywhere, and the
// flex parents are allowed to shrink below their content.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessageBubble } from "@/modules/community/components/chat/MessageBubble";

afterEach(cleanup);

const noop = vi.fn();
const baseMessage = {
  id: "m1",
  conversationId: "c1",
  conversationType: "DM",
  senderId: "u1",
  type: "TEXT",
  senderDisplayName: "Test",
  content: "A".repeat(300),
  metadata: null,
  replyTo: null,
  reactions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  editedAt: null,
  isEdited: false,
  isDeleted: false,
  readBy: [],
  participantIds: ["u1", "u2"],
};

describe("MessageBubble with an unbroken string", () => {
  it.each([true, false])("lets the text wrap anywhere (own=%s)", (isOwnMessage) => {
    render(
      <MessageBubble
        message={baseMessage as never}
        isOwnMessage={isOwnMessage}
        isGroupConversation={false}
        profileUserId="u1"
        onRetry={noop}
        onEdit={noop}
        onDelete={noop}
        onCopy={noop}
        isCopied={false}
        isEditing={false}
        isMutating={false}
      />
    );

    const text = screen.getByText("A".repeat(300));
    expect(text.className).toContain("[overflow-wrap:anywhere]");

    // Every flex ancestor up to the row must be allowed to shrink, or the
    // text's width becomes the row's minimum width.
    const bubbleColumn = text.closest("div[class*='max-w-[82%]']") as HTMLElement;
    expect(bubbleColumn.className).toContain("min-w-0");
    expect((bubbleColumn.parentElement as HTMLElement).className).toContain("min-w-0");
  });
});
