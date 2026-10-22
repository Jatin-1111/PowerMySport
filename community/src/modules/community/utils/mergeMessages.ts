import type { ConversationMessage } from "../types";

const union = (a: string[] = [], b: string[] = []): string[] => Array.from(new Set([...a, ...b]));

/**
 * Fold a fetched page of messages into what the screen already holds.
 *
 * The fetch can be older than the state it lands on: a read receipt or a
 * just-sent message arrives over the socket while the request is in flight (or
 * is served from a short-lived cache). Replacing state with the response then
 * rolled a "seen" tick back to "sent" and made a new message vanish. Read and
 * delivery only move forward, and a message the server has not listed yet is
 * kept, so a stale response can add information but never remove it.
 */
export const mergeServerMessages = (
  local: ConversationMessage[],
  server: ConversationMessage[]
): ConversationMessage[] => {
  const localById = new Map(local.map((message) => [message.id, message]));
  const serverIds = new Set(server.map((message) => message.id));

  const merged = server.map((message) => {
    const existing = localById.get(message.id);
    if (!existing) return message;
    return {
      ...message,
      readBy: union(existing.readBy, message.readBy),
      deliveredTo: union(existing.deliveredTo, message.deliveredTo),
    };
  });

  const localOnly = local.filter((message) => !serverIds.has(message.id));
  if (localOnly.length === 0) return merged;

  return [...merged, ...localOnly].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
  );
};

/**
 * Add one message in time order. Live events arrive in the order the server
 * finished handling them, which under load is not the order the messages were
 * created; appending blindly showed a thread that a reload then reshuffled.
 * The common case, a message newer than the last one, stays a plain append.
 */
export const insertByCreatedAt = (
  messages: ConversationMessage[],
  incoming: ConversationMessage
): ConversationMessage[] => {
  const at = Date.parse(incoming.createdAt);
  const last = messages[messages.length - 1];
  if (!last || Number.isNaN(at) || Date.parse(last.createdAt) <= at) {
    return [...messages, incoming];
  }
  const index = messages.findIndex((message) => Date.parse(message.createdAt) > at);
  return [...messages.slice(0, index), incoming, ...messages.slice(index)];
};
