"use client";

import { useState, useCallback, useRef } from "react";
import { useAsync } from "@/lib/hooks/useAsync";

export interface Conversation {
  id: string;
  participantId?: string;
  participantName?: string;
  participantDisplayName?: string;
  participantPhotoUrl?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  isGroup?: boolean;
  groupId?: string;
  groupName?: string;
  groupPhotoUrl?: string;
  [key: string]: any;
}

interface UseConversationStateOptions {
  onConversationsLoaded?: (conversations: Conversation[]) => void;
  onError?: (error: Error) => void;
}

/**
 * Custom hook to consolidate conversation list state management.
 * Replaces scattered useState + useEffect with unified loading/filtering/pagination logic.
 */
export function useConversationState(
  fetchConversations: (
    page: number,
    filters: ConversationFilters,
  ) => Promise<{
    conversations: Conversation[];
    pagination: { hasMore: boolean; page: number };
  }>,
  options: UseConversationStateOptions = {},
) {
  // Core data state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Filter/search state
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [hasConversationFilters, setHasConversationFilters] = useState(false);

  // Loading states consolidated into one async operation per logical flow
  const initialLoadAsync = useAsync(
    async (signal) => {
      const result = await fetchConversations(1, {
        search: searchQuery,
        groupId: groupFilter,
      });
      return result;
    },
    [searchQuery, groupFilter, fetchConversations],
    {
      onSuccess: (result) => {
        setConversations(result.conversations);
        setPage(1);
        setHasMore(result.pagination.hasMore);
        options.onConversationsLoaded?.(result.conversations);
      },
      onError: options.onError,
    },
  );

  const loadMoreAsync = useAsync(
    async (signal) => {
      const result = await fetchConversations(page + 1, {
        search: searchQuery,
        groupId: groupFilter,
      });
      return result;
    },
    [],
    {
      manual: true,
      onSuccess: (result) => {
        setConversations((prev) => [...prev, ...result.conversations]);
        setPage((prev) => prev + 1);
        setHasMore(result.pagination.hasMore);
      },
      onError: options.onError,
    },
  );

  const handleLoadMore = useCallback(async () => {
    if (!loadMoreAsync.isLoading && hasMore) {
      await loadMoreAsync.execute();
    }
  }, [loadMoreAsync, hasMore]);

  const handleFilterChange = useCallback(
    (search: string, group: string | null) => {
      setSearchQuery(search);
      setGroupFilter(group);
      setHasConversationFilters(!!(search || group));
    },
    [],
  );

  const handleSelectConversation = useCallback(
    (conversationId: string | null) => {
      setSelectedConversationId(conversationId);
    },
    [],
  );

  const handleDeleteConversation = useCallback(
    (conversationId: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
      }
    },
    [selectedConversationId],
  );

  return {
    // Data
    conversations,
    selectedConversationId,
    page,
    hasMore,

    // Filters
    searchQuery,
    groupFilter,
    hasConversationFilters,

    // Loading states (unified)
    isLoading: initialLoadAsync.isLoading,
    isLoadingMore: loadMoreAsync.isLoading,
    error: initialLoadAsync.error || loadMoreAsync.error,

    // Actions
    handleFilterChange,
    handleSelectConversation,
    handleDeleteConversation,
    handleLoadMore,
    refetch: initialLoadAsync.execute,
  };
}

export interface ConversationFilters {
  search?: string;
  groupId?: string | null;
}
