import { get, set } from "idb-keyval";
import type { ConversationMessage } from "@/modules/community/types";

const buildKey = (conversationId: string) => `chat_messages_${conversationId}`;

/**
 * Retrieves the cached messages for a given conversation.
 */
export async function getCachedMessages(
  conversationId: string,
): Promise<ConversationMessage[]> {
  try {
    if (typeof window === "undefined") return [];
    const data = await get<ConversationMessage[]>(buildKey(conversationId));
    return data || [];
  } catch (error) {
    console.error("[chatDB] Failed to get messages", error);
    return [];
  }
}

/**
 * Overwrites the cached messages for a given conversation.
 */
export async function setCachedMessages(
  conversationId: string,
  messages: ConversationMessage[],
): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    await set(buildKey(conversationId), messages);
  } catch (error) {
    console.error("[chatDB] Failed to set messages", error);
  }
}

/**
 * Appends or updates a message in the local cache.
 */
export async function upsertCachedMessage(
  conversationId: string,
  message: ConversationMessage,
): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    const messages = await getCachedMessages(conversationId);
    const existingIndex = messages.findIndex((m) => m.id === message.id);

    if (existingIndex >= 0) {
      messages[existingIndex] = message;
    } else {
      messages.push(message);
    }

    await setCachedMessages(conversationId, messages);
  } catch (error) {
    console.error("[chatDB] Failed to upsert message", error);
  }
}

export async function deleteCachedMessage(
  conversationId: string,
  messageId: string,
): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    const messages = await getCachedMessages(conversationId);
    await setCachedMessages(
      conversationId,
      messages.filter((m) => m.id !== messageId),
    );
  } catch (error) {
    console.error("[chatDB] Failed to delete message", error);
  }
}
