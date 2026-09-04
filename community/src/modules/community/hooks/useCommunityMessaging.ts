"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCommunitySocket, joinConversationRoom } from "@/lib/realtime/socket";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { toast } from "@/lib/toast";
import { communityService } from "@/modules/community/services/community";
import { uploadChatImage } from "@/modules/community/hooks/useChatImageUpload";
import { useVoiceRecording } from "@/modules/community/hooks/useVoiceRecording";
import { getCachedMessages, setCachedMessages } from "@/lib/db/chatDB";
import {
  CommunityProfile,
  ConversationItem,
  ConversationListResponse,
  ConversationMessage,
  MessageReaction,
} from "@/modules/community/types";
import { isWithinMessageEditWindow } from "@/modules/community/utils/chatUtils";
import {
  CONVERSATION_PAGE_SIZE,
  DISCONNECTED_POLL_BASE_MS,
  DISCONNECTED_POLL_MAX_MS,
} from "@/modules/community/constants/communityPage";

interface UseCommunityMessagingParams {
  selectedConversationId: string | null;
  selectedConversation: ConversationItem | null | undefined;
  selectedConversationIdRef: React.RefObject<string | null>;
  safeConversationsRef: React.RefObject<ConversationItem[]>;
  mutedConversationIdsRef: React.RefObject<string[]>;
  profile: CommunityProfile | null;
  messages: ConversationMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ConversationMessage[]>>;
  setError: (message: string | null) => void;
  setConversations: React.Dispatch<React.SetStateAction<ConversationItem[]>>;
  applyConversationPage: (
    response: ConversationListResponse,
    options?: { append?: boolean; preserveSelection?: boolean }
  ) => void;
  refreshConversationsNow: () => Promise<void>;
  queueConversationRefresh: (delayMs?: number) => void;
}

/**
 * Everything that turns realtime socket events and message send/edit/delete
 * actions into chat UI state: the message list itself, the socket listener
 * effect, optimistic sends for text/image/attachment messages, and the
 * disconnected-polling fallback. Split out of useCommunityPage, which still
 * owns the conversation list, group directory, and page/URL navigation state
 * this depends on (passed in as params rather than duplicated here).
 */
export function useCommunityMessaging({
  selectedConversationId,
  selectedConversation,
  selectedConversationIdRef,
  safeConversationsRef,
  mutedConversationIdsRef,
  profile,
  messages,
  setMessages,
  setError,
  setConversations,
  applyConversationPage,
  refreshConversationsNow,
  queueConversationRefresh,
}: UseCommunityMessagingParams) {
  const [messagePage, setMessagePage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageDraft, setEditingMessageDraft] = useState("");
  const [isMutatingMessageId, setIsMutatingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [mobileActionMessageId, setMobileActionMessageId] = useState<string | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [forwardingMessages, setForwardingMessages] = useState<ConversationMessage[]>([]);
  const [messageToDelete, setMessageToDelete] = useState<ConversationMessage | null>(null);

  // The socket listeners below are bound once, before `profile` has loaded.
  // Reading `profile` from their closure therefore compares against
  // undefined forever, so "is this mine?" checks go through this ref.
  const profileUserIdRef = useRef<string | undefined>(undefined);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isInitialMessageLoadRef = useRef<boolean>(false);
  const disconnectedPollDelayRef = useRef(DISCONNECTED_POLL_BASE_MS);

  useEffect(() => {
    profileUserIdRef.current = profile?.userId;
  }, [profile?.userId]);

  const mobileActionMessage = useMemo(() => {
    if (!mobileActionMessageId) return null;
    return messages.find((m) => m.id === mobileActionMessageId) || null;
  }, [messages, mobileActionMessageId]);

  const optimisticUpdateConversationLatestMessage = useCallback(
    (chatId: string, content: string, type: string = "TEXT") => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === chatId) {
            return {
              ...c,
              latestMessage: {
                content,
                createdAt: new Date().toISOString(),
                senderId: profile?.userId || "me",
                type,
              },
            };
          }
          return c;
        })
      );
    },
    [profile?.userId, setConversations]
  );

  const appendMessage = (incoming: ConversationMessage) => {
    setMessages((current) => {
      const safeCurrent = Array.isArray(current) ? current : [];
      if (safeCurrent.some((m) => m.id === incoming.id)) return safeCurrent;
      const newMessages = [...safeCurrent, incoming];
      void setCachedMessages(incoming.conversationId, newMessages);
      return newMessages;
    });
  };

  const removeMessageById = (messageId: string) => {
    setMessages((current) => {
      const safeCurrent = Array.isArray(current) ? current : [];
      const updated = safeCurrent.filter((m) => m.id !== messageId);
      if (selectedConversationIdRef.current) {
        void setCachedMessages(selectedConversationIdRef.current, updated);
      }
      return updated;
    });
  };

  const updateMessageById = (
    messageId: string,
    updater: (m: ConversationMessage) => ConversationMessage
  ) => {
    setMessages((current) => {
      const safeCurrent = Array.isArray(current) ? current : [];
      const updated = safeCurrent.map((m) => (m.id === messageId ? updater(m) : m));
      if (selectedConversationIdRef.current) {
        void setCachedMessages(selectedConversationIdRef.current, updated);
      }
      return updated;
    });
  };

  const markNotificationsForConversationAsRead = useCallback(async (conversationId: string) => {
    try {
      const allNotifications = await communityService.listCommunityNotifications(
        1,
        100,
        false // unread only
      );

      const relatedNotifications = allNotifications.items.filter(
        (item) => item.data?.conversationId === conversationId && !item.isRead
      );

      await Promise.all(
        relatedNotifications.map((notification) =>
          communityService.markCommunityNotificationRead(notification.id)
        )
      );
    } catch (error) {
      console.debug("Failed to mark notifications as read:", error);
    }
  }, []);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      try {
        // Signal that this is a fresh load — auto-scroll to bottom on first render
        isInitialMessageLoadRef.current = true;

        // Optimistically load from IndexedDB
        const cached = await getCachedMessages(conversationId);
        if (cached && cached.length > 0) {
          setMessages(cached);
        }

        const response = await communityService.getMessages(conversationId, 1);
        const serverMessages = Array.isArray(response.messages) ? response.messages : [];
        setMessages(serverMessages);
        void setCachedMessages(conversationId, serverMessages);

        setMessagePage(1);
        if (response.pagination) {
          setHasMoreMessages(response.pagination.page < response.pagination.totalPages);
        } else {
          setHasMoreMessages(false);
        }

        // Mark related notifications as read
        await markNotificationsForConversationAsRead(conversationId);

        // Optimistically clear unread count for immediate sidebar UI update
        setConversations((current) =>
          Array.isArray(current)
            ? current.map((c) =>
                c.id === conversationId && c.unreadCount !== 0 ? { ...c, unreadCount: 0 } : c
              )
            : current
        );

        const socket = getCommunitySocket();
        if (socket.connected) {
          socket.emit("community:markRead", { conversationId });
        }

        // Defer refresh to allow backend to process markRead
        setTimeout(() => refreshConversationsNow(), 500);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load messages";
        setError(message);
        toast.error(message);
      }
    },
    [refreshConversationsNow, markNotificationsForConversationAsRead, setConversations, setError]
  );

  const loadMoreMessages = useCallback(async () => {
    if (!selectedConversationId || isLoadingMoreMessages || !hasMoreMessages) return;
    setIsLoadingMoreMessages(true);
    try {
      const nextPage = messagePage + 1;
      const response = await communityService.getMessages(selectedConversationId, nextPage);

      const newMessages = Array.isArray(response.messages) ? response.messages : [];
      setMessages((current) => {
        // Prepend new messages, filtering out any duplicates
        const currentIds = new Set(current.map((m) => m.id));
        const filteredNew = newMessages.filter((m) => !currentIds.has(m.id));
        const updated = [...filteredNew, ...current];
        void setCachedMessages(selectedConversationId, updated);
        return updated;
      });

      setMessagePage(nextPage);
      if (response.pagination) {
        setHasMoreMessages(response.pagination.page < response.pagination.totalPages);
      } else {
        setHasMoreMessages(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load older messages");
    } finally {
      setIsLoadingMoreMessages(false);
    }
  }, [selectedConversationId, messagePage, hasMoreMessages, isLoadingMoreMessages]);

  useEffect(() => {
    if (!selectedConversationId || !selectedConversation) {
      setMessages([]);
      return;
    }

    // Clear messages if switching to a new conversation to prevent stale data leaking
    if (selectedConversationIdRef.current !== selectedConversationId) {
      setMessages([]);
    }

    loadMessages(selectedConversationId);
  }, [loadMessages, selectedConversation, selectedConversationId, selectedConversationIdRef]);

  useEffect(() => {
    setMobileActionMessageId(null);
  }, [selectedConversationId]);

  useEffect(() => {
    const socket = getCommunitySocket();
    const handleConnect = () => {
      setIsSocketConnected(true);
      const currentConversationId = selectedConversationIdRef.current;
      if (
        currentConversationId &&
        safeConversationsRef.current.find((c) => c.id === currentConversationId)
      ) {
        joinConversationRoom(currentConversationId);
        void loadMessages(currentConversationId);
      }
      void refreshConversationsNow();
    };
    const handleDisconnect = () => setIsSocketConnected(false);
    const handleNewMessage = (message: ConversationMessage) => {
      if (message.senderId !== profileUserIdRef.current) {
        socket.emit("community:markConversationAsDelivered", {
          conversationId: message.conversationId,
        });
      }

      if (message.conversationId === selectedConversationIdRef.current) {
        appendMessage(message);
        socket.emit("community:markRead", {
          conversationId: message.conversationId,
        });
      } else {
        // Notification for new messages in other chats
        if (
          !mutedConversationIdsRef.current.includes(message.conversationId) &&
          message.senderId !== profileUserIdRef.current
        ) {
          toast.success(`New message from ${message.senderDisplayName || "someone"}`);
        }
      }
      queueConversationRefresh();
    };
    const handleMessagesRead = (payload: {
      conversationId: string;
      readerId: string;
      messageIds: string[];
    }) => {
      if (payload.conversationId !== selectedConversationIdRef.current) return;
      setMessages((current) => {
        const updated = (Array.isArray(current) ? current : []).map((m) => {
          if (!payload.messageIds.includes(m.id)) return m;
          const readBy = m.readBy || [];
          if (readBy.includes(payload.readerId)) return m;
          return { ...m, readBy: [...readBy, payload.readerId] };
        });
        void setCachedMessages(payload.conversationId, updated);
        return updated;
      });
    };
    const handleMessagesDelivered = (payload: {
      conversationId: string;
      readerId: string;
      messageIds: string[];
    }) => {
      if (payload.conversationId !== selectedConversationIdRef.current) return;
      setMessages((current) => {
        const updated = (Array.isArray(current) ? current : []).map((m) => {
          if (!payload.messageIds.includes(m.id)) return m;
          const deliveredTo = m.deliveredTo || [];
          if (deliveredTo.includes(payload.readerId)) return m;
          return { ...m, deliveredTo: [...deliveredTo, payload.readerId] };
        });
        void setCachedMessages(payload.conversationId, updated);
        return updated;
      });
    };
    const handleConversationUpdated = (payload?: { conversationId?: string }) => {
      if (payload?.conversationId) {
        joinConversationRoom(payload.conversationId);
      }
      queueConversationRefresh(100);
    };
    const handleMessageEdited = (message: ConversationMessage) => {
      if (message.conversationId !== selectedConversationIdRef.current) {
        queueConversationRefresh();
        return;
      }
      updateMessageById(message.id, (current) => ({ ...current, ...message }));
      queueConversationRefresh(120);
    };
    const handleMessageReacted = (payload: {
      messageId: string;
      conversationId: string;
      reactions: MessageReaction[];
    }) => {
      // Patch only what changed: a reaction must not disturb scroll position
      // or trigger the page refetch that an edit does.
      if (payload.conversationId !== selectedConversationIdRef.current) {
        return;
      }
      updateMessageById(payload.messageId, (current) => ({
        ...current,
        reactions: payload.reactions,
      }));
    };
    const handleMessageDeleted = (message: ConversationMessage) => {
      if (message.conversationId !== selectedConversationIdRef.current) {
        queueConversationRefresh();
        return;
      }
      updateMessageById(message.id, (current) => ({ ...current, ...message }));
      queueConversationRefresh(120);
    };
    const handleCommunityError = (payload: { message: string }) => setError(payload.message);
    const handleConnectError = (connectError: Error) => {
      setIsSocketConnected(false);
      if (/unauthorized|authentication/i.test(connectError.message)) redirectToMainLogin();
    };

    const handleUserTyping = (payload: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      const { conversationId, userId, isTyping } = payload;
      if (userId === profileUserIdRef.current) return;

      setTypingUsers((current) => {
        const users = current[conversationId] || [];
        const newUsers = isTyping
          ? Array.from(new Set([...users, userId]))
          : users.filter((id) => id !== userId);
        return { ...current, [conversationId]: newUsers };
      });

      const timeoutKey = `${conversationId}_${userId}`;
      if (typingTimeoutsRef.current[timeoutKey]) {
        clearTimeout(typingTimeoutsRef.current[timeoutKey]);
      }

      if (isTyping) {
        typingTimeoutsRef.current[timeoutKey] = setTimeout(() => {
          setTypingUsers((current) => {
            const users = current[conversationId] || [];
            return {
              ...current,
              [conversationId]: users.filter((id) => id !== userId),
            };
          });
        }, 5000);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("community:newMessage", handleNewMessage);
    socket.on("community:messagesRead", handleMessagesRead);
    socket.on("community:messagesDelivered", handleMessagesDelivered);
    socket.on("community:conversationUpdated", handleConversationUpdated);
    socket.on("community:messageEdited", handleMessageEdited);
    socket.on("community:messageReacted", handleMessageReacted);
    socket.on("community:messageDeleted", handleMessageDeleted);
    socket.on("community:error", handleCommunityError);
    socket.on("connect_error", handleConnectError);
    socket.on("community:userTyping", handleUserTyping);

    if (socket.connected) handleConnect();
    else socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("community:newMessage", handleNewMessage);
      socket.off("community:messagesRead", handleMessagesRead);
      socket.off("community:messagesDelivered", handleMessagesDelivered);
      socket.off("community:conversationUpdated", handleConversationUpdated);
      socket.off("community:messageEdited", handleMessageEdited);
      socket.off("community:messageReacted", handleMessageReacted);
      socket.off("community:messageDeleted", handleMessageDeleted);
      socket.off("community:error", handleCommunityError);
      socket.off("connect_error", handleConnectError);
      socket.off("community:userTyping", handleUserTyping);
    };
  }, [
    queueConversationRefresh,
    loadMessages,
    refreshConversationsNow,
    selectedConversationIdRef,
    safeConversationsRef,
    mutedConversationIdsRef,
    setError,
  ]);

  useEffect(() => {
    if (!selectedConversationId || !selectedConversation) return;
    joinConversationRoom(selectedConversationId);
  }, [selectedConversationId, selectedConversation, isSocketConnected]);

  useEffect(() => {
    if (isSocketConnected || !selectedConversationId || !selectedConversation) {
      disconnectedPollDelayRef.current = DISCONNECTED_POLL_BASE_MS;
      return;
    }
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let isStopped = false;
    const scheduleNext = (delayMs: number) => {
      if (isStopped) return;
      timeoutHandle = setTimeout(async () => {
        try {
          const [messageResponse, conversationResponse] = await Promise.all([
            communityService.getMessages(selectedConversationId),
            communityService.listConversations(1, CONVERSATION_PAGE_SIZE),
          ]);
          setMessages(Array.isArray(messageResponse.messages) ? messageResponse.messages : []);
          applyConversationPage(conversationResponse, {
            preserveSelection: true,
          });
          disconnectedPollDelayRef.current = DISCONNECTED_POLL_BASE_MS;
        } catch {
          disconnectedPollDelayRef.current = Math.min(
            DISCONNECTED_POLL_MAX_MS,
            Math.ceil(disconnectedPollDelayRef.current * 1.8)
          );
        } finally {
          const jitter = Math.floor(Math.random() * 500);
          scheduleNext(disconnectedPollDelayRef.current + jitter);
        }
      }, delayMs);
    };
    scheduleNext(disconnectedPollDelayRef.current);
    return () => {
      isStopped = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
  }, [applyConversationPage, isSocketConnected, selectedConversation, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;

    const container = scrollContainerRef.current;

    // On initial load of a conversation, always jump to the bottom instantly
    if (isInitialMessageLoadRef.current) {
      isInitialMessageLoadRef.current = false;
      messagesEndRef.current?.scrollIntoView({
        behavior: "instant",
        block: "end",
      });
      return;
    }

    // On new messages: only auto-scroll if the user is already near the bottom (within 120px)
    if (container) {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 120) {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    }
  }, [messages, selectedConversationId]);

  const sendMessageWithTransport = useCallback(
    async (
      conversationId: string,
      content: string,
      replyToId?: string
    ): Promise<ConversationMessage> => {
      const socket = getCommunitySocket();
      if (socket.connected) {
        const ack = await new Promise<
          { success: true; data: ConversationMessage } | { success: false; message?: string }
        >((resolve) => {
          const timeoutId = setTimeout(
            () => resolve({ success: false, message: "Message send timed out" }),
            8000
          );
          socket.emit(
            "community:sendMessage",
            { conversationId, content, ...(replyToId ? { replyToId } : {}) },
            (result: unknown) => {
              clearTimeout(timeoutId);
              resolve(
                (result as
                  | { success: true; data: ConversationMessage }
                  | { success: false; message?: string }) || {
                  success: false,
                  message: "Invalid server response",
                }
              );
            }
          );
        });
        if (!ack.success) throw new Error(ack.message || "Failed to send message");
        return { ...ack.data, messageStatus: "SENT" };
      }
      return {
        ...(await communityService.sendMessage(conversationId, content, replyToId)),
        messageStatus: "SENT",
      };
    },
    []
  );

  const editMessageWithTransport = useCallback(
    async (messageId: string, content: string): Promise<ConversationMessage> => {
      const socket = getCommunitySocket();
      if (socket.connected) {
        const ack = await new Promise<
          { success: true; data: ConversationMessage } | { success: false; message?: string }
        >((resolve) => {
          const timeoutId = setTimeout(
            () => resolve({ success: false, message: "Message edit timed out" }),
            8000
          );
          socket.emit("community:editMessage", { messageId, content }, (result: unknown) => {
            clearTimeout(timeoutId);
            resolve(
              (result as
                | { success: true; data: ConversationMessage }
                | { success: false; message?: string }) || {
                success: false,
                message: "Invalid server response",
              }
            );
          });
        });
        if (!ack.success) throw new Error(ack.message || "Failed to edit message");
        return ack.data;
      }
      return communityService.editMessage(messageId, content);
    },
    []
  );

  const deleteMessageWithTransport = useCallback(
    async (messageId: string): Promise<ConversationMessage> => {
      const socket = getCommunitySocket();
      if (socket.connected) {
        const ack = await new Promise<
          { success: true; data: ConversationMessage } | { success: false; message?: string }
        >((resolve) => {
          const timeoutId = setTimeout(
            () => resolve({ success: false, message: "Message delete timed out" }),
            8000
          );
          socket.emit("community:deleteMessage", { messageId }, (result: unknown) => {
            clearTimeout(timeoutId);
            resolve(
              (result as
                | { success: true; data: ConversationMessage }
                | { success: false; message?: string }) || {
                success: false,
                message: "Invalid server response",
              }
            );
          });
        });
        if (!ack.success) throw new Error(ack.message || "Failed to delete message");
        return ack.data;
      }
      return communityService.deleteMessage(messageId);
    },
    []
  );

  const retryFailedMessage = useCallback(
    async (message: ConversationMessage) => {
      if (!message.content?.trim()) return;
      updateMessageById(message.id, (current) => ({
        ...current,
        messageStatus: "SENDING",
      }));
      setIsSending(true);
      try {
        const confirmedMessage = await sendMessageWithTransport(
          message.conversationId,
          message.content
        );
        updateMessageById(message.id, (current) => ({
          ...current,
          ...confirmedMessage,
        }));
        queueConversationRefresh();
      } catch (e) {
        updateMessageById(message.id, (current) => ({
          ...current,
          messageStatus: "FAILED",
        }));
        toast.error(e instanceof Error ? e.message : "Failed to resend message");
      } finally {
        setIsSending(false);
      }
    },
    [queueConversationRefresh, sendMessageWithTransport]
  );

  const handleBeginEditMessage = (message: ConversationMessage) => {
    if (
      message.senderId !== profile?.userId ||
      message.isDeleted ||
      !isWithinMessageEditWindow(message.createdAt)
    )
      return;
    setEditingMessageId(message.id);
    setEditingMessageDraft(message.content);
  };

  const handleCancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingMessageDraft("");
  };

  const handleSaveEditedMessage = async () => {
    if (!editingMessageId) return;
    const nextContent = editingMessageDraft.trim();
    if (!nextContent) return toast.error("Message content cannot be empty");
    setIsMutatingMessageId(editingMessageId);
    try {
      const updated = await editMessageWithTransport(editingMessageId, nextContent);
      updateMessageById(editingMessageId, (current) => ({
        ...current,
        ...updated,
      }));
      setEditingMessageId(null);
      setEditingMessageDraft("");
      queueConversationRefresh();
      toast.success("Message updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update message");
    } finally {
      setIsMutatingMessageId(null);
    }
  };

  const handleDeleteMessage = (message: ConversationMessage) => {
    if (
      message.senderId !== profile?.userId ||
      message.isDeleted ||
      !isWithinMessageEditWindow(message.createdAt)
    )
      return;
    setMessageToDelete(message);
  };

  const confirmDeleteMessage = async () => {
    if (!messageToDelete) return;
    const message = messageToDelete;
    setIsMutatingMessageId(message.id);
    try {
      const deleted = await deleteMessageWithTransport(message.id);
      updateMessageById(message.id, (current) => ({ ...current, ...deleted }));
      if (editingMessageId === message.id) {
        setEditingMessageId(null);
        setEditingMessageDraft("");
      }
      queueConversationRefresh();
      toast.success("Message deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete message");
    } finally {
      setIsMutatingMessageId(null);
      setMessageToDelete(null);
    }
  };

  const handleForwardMessages = async (chatIds: string[]) => {
    if (forwardingMessages.length === 0 || chatIds.length === 0) return;
    try {
      for (const chatId of chatIds) {
        for (const msg of forwardingMessages) {
          optimisticUpdateConversationLatestMessage(
            chatId,
            msg.type === "IMAGE" ? "Image message" : msg.content,
            msg.type
          );
          if (msg.type === "IMAGE") {
            await communityService.sendImageMessage(
              chatId,
              msg.content,
              msg.metadata as { width: number; height: number; caption?: string }
            );
          } else {
            await communityService.sendMessage(chatId, msg.content);
          }
          // Add a small delay between each message to avoid hitting the API rate limit (429 Too Many Requests)
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    } catch (err) {
      console.error("Failed to forward messages:", err);
      throw err;
    }
  };

  const handleCopyMessage = (message: ConversationMessage) => {
    if (!message.content || message.isDeleted) return;
    navigator.clipboard
      .writeText(message.content)
      .then(() => {
        setCopiedMessageId(message.id);
        setTimeout(() => setCopiedMessageId(null), 1600);
        toast.success("Message copied");
      })
      .catch(() => toast.error("Failed to copy"));
  };

  // The message being replied to, if any. Tagged with the conversation it
  // belongs to so switching chats drops it without a state write in an effect
  // — a quote carried into a different conversation would be rejected by the
  // server anyway, since the target lives elsewhere.
  const [replyTarget, setReplyTarget] = useState<{
    conversationId: string;
    message: ConversationMessage;
  } | null>(null);

  const replyingTo =
    replyTarget && replyTarget.conversationId === selectedConversationId
      ? replyTarget.message
      : null;

  const setReplyingTo = useCallback(
    (message: ConversationMessage | null) => {
      setReplyTarget(
        message && selectedConversationId
          ? { conversationId: selectedConversationId, message }
          : null
      );
    },
    [selectedConversationId]
  );

  // A plain function like the other message handlers here: the values it needs
  // are not memoized, so a useCallback would buy nothing and only add a
  // stale-closure warning.
  const handleReactToMessage = async (message: ConversationMessage, emoji: string) => {
    const socket = getCommunitySocket();
    if (!socket.connected) {
      // Reactions are socket-only — there is no HTTP fallback route, and
      // silently doing nothing would read as a broken button.
      toast.error("Reconnecting — try that again in a moment");
      return;
    }

    socket.emit("community:reactToMessage", { messageId: message.id, emoji }, (result: unknown) => {
      const ack = result as
        | {
            success: true;
            data: { messageId: string; reactions: MessageReaction[] };
          }
        | { success: false; message?: string };
      if (!ack?.success) {
        toast.error(ack?.message || "Failed to react");
        return;
      }
      updateMessageById(ack.data.messageId, (current) => ({
        ...current,
        reactions: ack.data.reactions,
      }));
    });
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) return;
    const isPending =
      selectedConversation.status === "PENDING" &&
      selectedConversation.conversationType !== "GROUP";
    const needsMyApproval = isPending && selectedConversation.requestedBy !== profile?.userId;
    if (needsMyApproval) return toast.error("Accept the message request before replying");

    const content = newMessage.trim();
    const optimisticMessageId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticMessage: ConversationMessage = {
      id: optimisticMessageId,
      conversationId: selectedConversation.id,
      conversationType: selectedConversation.conversationType,
      senderId: profile?.userId || "me",
      senderDisplayName: "You",
      content,
      createdAt: new Date().toISOString(),
      messageStatus: "SENDING",
      readBy: profile?.userId ? [profile.userId] : [],
      participantIds: [profile?.userId || "me", selectedConversation.otherParticipant.id],
      ...(replyingTo
        ? {
            replyTo: {
              id: replyingTo.id,
              senderId: replyingTo.senderId,
              senderDisplayName: replyingTo.senderDisplayName,
              type: replyingTo.type || "TEXT",
              content:
                replyingTo.type === "IMAGE" ? "Photo" : (replyingTo.content || "").slice(0, 140),
              isDeleted: Boolean(replyingTo.isDeleted),
            },
          }
        : {}),
    };

    appendMessage(optimisticMessage);
    optimisticUpdateConversationLatestMessage(selectedConversation.id, content, "TEXT");
    setNewMessage("");
    const replyToId = replyingTo?.id;
    setReplyingTo(null);
    setIsSending(true);
    try {
      const confirmedMessage = await sendMessageWithTransport(
        selectedConversation.id,
        content,
        replyToId
      );
      removeMessageById(optimisticMessageId);
      if (confirmedMessage.conversationId === selectedConversation.id)
        appendMessage(confirmedMessage);
      queueConversationRefresh();
    } catch (e) {
      updateMessageById(optimisticMessageId, (message) => ({
        ...message,
        messageStatus: "FAILED",
      }));
      toast.error(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Send an image message. Flow:
   * 1. Immediately show an optimistic bubble with a local blob preview
   * 2. Upload the file to S3 via presigned POST
   * 3. Send the IMAGE message record to the server (socket or HTTP fallback)
   * 4. Swap in the confirmed message; revoke the blob URL
   * 5. On any failure: mark the optimistic message as FAILED
   */
  const handleSendImageMessage = async (file: File, caption?: string) => {
    if (!selectedConversation || isUploadingImage) return;

    setNewMessage("");

    const optimisticId = `temp-img-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    // Create a local preview URL so the user sees the image immediately
    const localPreviewUrl = URL.createObjectURL(file);

    const optimisticMessage = {
      id: optimisticId,
      conversationId: selectedConversation.id,
      conversationType: selectedConversation.conversationType,
      senderId: profile?.userId || "me",
      senderDisplayName: "You",
      content: "", // real key arrives after upload
      type: "IMAGE" as const,
      metadata: caption ? { caption } : undefined,
      localPreviewUrl,
      createdAt: new Date().toISOString(),
      messageStatus: "SENDING" as const,
      readBy: profile?.userId ? [profile.userId] : [],
      participantIds: [profile?.userId || "me", selectedConversation.otherParticipant.id],
    };

    appendMessage(optimisticMessage);
    optimisticUpdateConversationLatestMessage(selectedConversation.id, "Image message", "IMAGE");
    setIsUploadingImage(true);

    try {
      const { s3Key, width, height } = await uploadChatImage(file, selectedConversation.id);

      const socket = getCommunitySocket();
      let confirmedMessage;
      if (socket.connected) {
        const ack = await new Promise<
          | {
              success: true;
              data: ConversationMessage;
            }
          | { success: false; message?: string }
        >((resolve) => {
          const timeoutId = setTimeout(
            () => resolve({ success: false, message: "Image send timed out" }),
            12000
          );
          socket.emit(
            "community:sendMessage",
            {
              conversationId: selectedConversation.id,
              content: s3Key,
              type: "IMAGE",
              metadata: { width, height, caption },
            },
            (result: unknown) => {
              clearTimeout(timeoutId);
              resolve(
                (result as
                  | { success: true; data: ConversationMessage }
                  | { success: false; message?: string }) || {
                  success: false,
                  message: "Invalid server response",
                }
              );
            }
          );
        });
        if (!ack.success) throw new Error(ack.message || "Failed to send image");
        confirmedMessage = { ...ack.data, messageStatus: "SENT" as const };
      } else {
        const sent = await communityService.sendImageMessage(selectedConversation.id, s3Key, {
          width,
          height,
          caption,
        });
        confirmedMessage = { ...sent, messageStatus: "SENT" as const };
      }

      // Swap out optimistic for confirmed; revoke the temporary blob URL
      removeMessageById(optimisticId);
      URL.revokeObjectURL(localPreviewUrl);
      if (confirmedMessage.conversationId === selectedConversation.id) {
        appendMessage(confirmedMessage);
      }

      queueConversationRefresh();
    } catch (e) {
      updateMessageById(optimisticId, (msg) => ({
        ...msg,
        messageStatus: "FAILED" as const,
      }));
      toast.error(e instanceof Error ? e.message : "Failed to send image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  /**
   * Send a document or a voice clip. Mirrors the image flow: optimistic bubble,
   * direct-to-S3 upload against a presigned POST, then persist the message
   * record. The socket path is preferred so other participants see it without
   * a refetch, with the HTTP route as the offline fallback.
   */
  const handleSendAttachment = async (
    file: File,
    kind: "FILE" | "VOICE",
    durationMs?: number,
    waveform?: number[]
  ) => {
    if (!selectedConversation) return;

    const optimisticId = `temp-att-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticMessage: ConversationMessage = {
      id: optimisticId,
      conversationId: selectedConversation.id,
      conversationType: selectedConversation.conversationType,
      senderId: profile?.userId || "me",
      senderDisplayName: "You",
      content: "",
      type: kind,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        ...(durationMs ? { durationMs } : {}),
        ...(waveform?.length ? { waveform } : {}),
      },
      createdAt: new Date().toISOString(),
      messageStatus: "SENDING",
      readBy: profile?.userId ? [profile.userId] : [],
      participantIds: [profile?.userId || "me", selectedConversation.otherParticipant.id],
    };

    appendMessage(optimisticMessage);
    setIsUploadingImage(true);

    try {
      const presign = await communityService.getAttachmentUploadUrl(
        selectedConversation.id,
        file.type,
        kind
      );

      const form = new FormData();
      Object.entries(presign.fields).forEach(([key, value]) => {
        form.append(key, value);
      });
      // The file part must be appended last — S3 ignores any field that comes
      // after it in a multipart POST.
      form.append("file", file);

      const upload = await fetch(presign.url, { method: "POST", body: form });
      if (!upload.ok) {
        throw new Error("Upload failed");
      }

      const metadata = {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        ...(durationMs ? { durationMs } : {}),
        ...(waveform?.length ? { waveform } : {}),
      };

      const socket = getCommunitySocket();
      let confirmedMessage: ConversationMessage;
      if (socket.connected) {
        const ack = await new Promise<
          { success: true; data: ConversationMessage } | { success: false; message?: string }
        >((resolve) => {
          const timeoutId = setTimeout(
            () => resolve({ success: false, message: "Send timed out" }),
            15000
          );
          socket.emit(
            "community:sendMessage",
            {
              conversationId: selectedConversation.id,
              content: presign.key,
              type: kind,
              metadata,
            },
            (result: unknown) => {
              clearTimeout(timeoutId);
              resolve(
                (result as
                  | { success: true; data: ConversationMessage }
                  | { success: false; message?: string }) || {
                  success: false,
                  message: "Invalid server response",
                }
              );
            }
          );
        });
        if (!ack.success) {
          throw new Error(ack.message || "Failed to send attachment");
        }
        confirmedMessage = { ...ack.data, messageStatus: "SENT" as const };
      } else {
        const sent = await communityService.sendAttachmentMessage(
          selectedConversation.id,
          presign.key,
          kind,
          metadata
        );
        confirmedMessage = { ...sent, messageStatus: "SENT" as const };
      }

      removeMessageById(optimisticId);
      if (confirmedMessage.conversationId === selectedConversation.id) {
        appendMessage(confirmedMessage);
      }
      queueConversationRefresh();
    } catch (e) {
      updateMessageById(optimisticId, (msg) => ({
        ...msg,
        messageStatus: "FAILED" as const,
      }));
      toast.error(e instanceof Error ? e.message : "Failed to send attachment");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const { isRecording, toggleVoiceRecording } = useVoiceRecording(handleSendAttachment);

  return {
    loadMessages,
    newMessage,
    setNewMessage,
    isSending,
    editingMessageId,
    editingMessageDraft,
    setEditingMessageDraft,
    isMutatingMessageId,
    copiedMessageId,
    mobileActionMessageId,
    setMobileActionMessageId,
    mobileActionMessage,
    isSocketConnected,
    isUploadingImage,
    typingUsers,
    messagesEndRef,
    scrollContainerRef,
    hasMoreMessages,
    isLoadingMoreMessages,
    loadMoreMessages,
    retryFailedMessage,
    handleBeginEditMessage,
    handleCancelEditMessage,
    handleSaveEditedMessage,
    handleDeleteMessage,
    handleCopyMessage,
    handleSendMessage,
    handleReactToMessage,
    handleSendAttachment,
    isRecording,
    toggleVoiceRecording,
    replyingTo,
    setReplyingTo,
    handleSendImageMessage,
    pendingImageFile,
    setPendingImageFile,
    imageInputRef,
    forwardingMessages,
    setForwardingMessages,
    handleForwardMessages,
    messageToDelete,
    setMessageToDelete,
    confirmDeleteMessage,
  };
}
