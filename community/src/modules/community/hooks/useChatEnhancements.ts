"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import {
  COMMUNITY_PINNED_KEY,
  COMMUNITY_MUTED_KEY,
} from "@/modules/community/constants/communityPage";
import { setCachedMessages } from "@/lib/db/chatDB";
import { ConversationItem, ConversationMessage } from "@/modules/community/types";

/**
 * Client-side, localStorage-backed chat enhancements (pin/mute/select/clear/
 * delete/mark read) plus the small pieces of UI state that go with them.
 */
export function useChatEnhancements(
  selectedConversationId: string | null,
  selectedConversation: ConversationItem | null | undefined,
  setSelectedConversationId: React.Dispatch<React.SetStateAction<string | null>>,
  setMessages: React.Dispatch<React.SetStateAction<ConversationMessage[]>>,
  setConversations: React.Dispatch<React.SetStateAction<ConversationItem[]>>
) {
  const [pinnedConversationIds, setPinnedConversationIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(COMMUNITY_PINNED_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [mutedConversationIds, setMutedConversationIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(COMMUNITY_MUTED_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const mutedConversationIdsRef = useRef<string[]>(mutedConversationIds);
  useEffect(() => {
    mutedConversationIdsRef.current = mutedConversationIds;
  }, [mutedConversationIds]);

  const [conversationSearchQuery, setConversationSearchQuery] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectChatsMode, setSelectChatsMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);

  const toggleChatSelection = useCallback((chatId: string) => {
    setSelectedChatIds((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  }, []);

  const clearChatSelection = useCallback(() => {
    setSelectedChatIds([]);
    setSelectChatsMode(false);
  }, []);

  const handleTogglePinConversation = useCallback((conversationId: string) => {
    setPinnedConversationIds((prev) => {
      const next = prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId];
      try {
        localStorage.setItem(COMMUNITY_PINNED_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const handleToggleMuteConversation = useCallback((conversationId: string) => {
    setMutedConversationIds((prev) => {
      const next = prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId];
      try {
        localStorage.setItem(COMMUNITY_MUTED_KEY, JSON.stringify(next));
      } catch {}
      toast.success(
        next.includes(conversationId) ? "Notifications muted" : "Notifications unmuted"
      );
      return next;
    });
  }, []);

  const handleMarkAllAsRead = useCallback(() => {
    if (!selectedConversation) return;
    // Optimistically set unread count to 0
    setConversations((current) =>
      (Array.isArray(current) ? current : []).map((c) =>
        c.id === selectedConversation.id && c.unreadCount !== 0 ? { ...c, unreadCount: 0 } : c
      )
    );
    toast.success("Marked all as read");
  }, [selectedConversation, setConversations]);

  const handleMarkConversationAsUnread = useCallback(
    (conversationId: string) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 1 } : c))
      );
      toast.success("Marked as unread");
    },
    [setConversations]
  );

  const handleClearChat = useCallback(
    async (conversationId: string) => {
      if (selectedConversationId === conversationId) {
        setMessages([]);
      }
      try {
        await setCachedMessages(conversationId, []);
      } catch {}
      toast.success("Chat cleared");
    },
    [selectedConversationId, setMessages]
  );

  const handleDeleteChat = useCallback(
    async (conversationId: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
        setMessages([]);
      }
      try {
        await setCachedMessages(conversationId, []);
      } catch {}
      toast.success("Chat deleted");
    },
    [selectedConversationId, setConversations, setSelectedConversationId, setMessages]
  );

  return {
    pinnedConversationIds,
    mutedConversationIds,
    mutedConversationIdsRef,
    conversationSearchQuery,
    setConversationSearchQuery,
    showEmojiPicker,
    setShowEmojiPicker,
    selectChatsMode,
    setSelectChatsMode,
    selectedChatIds,
    toggleChatSelection,
    clearChatSelection,
    handleTogglePinConversation,
    handleToggleMuteConversation,
    handleMarkAllAsRead,
    handleMarkConversationAsUnread,
    handleClearChat,
    handleDeleteChat,
  };
}
