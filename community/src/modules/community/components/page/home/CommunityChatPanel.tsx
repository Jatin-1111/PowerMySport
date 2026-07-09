"use client";

import {
  ChevronLeft,
  ImagePlus,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  X,
  Loader2,
  Send,
  MoreVertical,
  Check,
  Pencil,
  Smile,
  Paperclip,
  CheckCheck,
  Trash2,
  ArrowUp,
  Pin,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageBubble } from "@/modules/community/components/chat/MessageBubble";
import EmojiPicker from "@/modules/community/components/chat/EmojiPicker";
import CommunityChatEmptyState from "@/modules/community/components/page/home/CommunityChatEmptyState";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";
import { useRef, useEffect, useLayoutEffect, useCallback, useState } from "react";
import { getCommunitySocket } from "@/lib/realtime/socket";
import { getMessageTimestamp, formatLastSeen } from "@/modules/community/utils/chatUtils";

type Props = { page: CommunityPageViewModel };

export default function CommunityChatPanel({ page }: Props) {
  const {
    workspaceView,
    selectedConversationPhotoUrl,
    selectedConversationDisplayName,
    selectedConversationAvatarChar,
    selectedConversation,
    setIsConversationSidebarOpen,
    setSidebarMode,
    setWorkspaceView,
    showGroupMembersPanel,
    setShowGroupMembersPanel,
    selectedConversationIsPending,
    selectedConversationNeedsMyApproval,
    handleAcceptRequest,
    handleRejectRequest,
    messages,
    profile,
    setMobileActionMessageId,
    retryFailedMessage,
    handleBeginEditMessage,
    handleDeleteMessage,
    handleCopyMessage,
    copiedMessageId,
    editingMessageId,
    isMutatingMessageId,
    messagesEndRef,
    editingMessageDraft,
    setEditingMessageDraft,
    handleSaveEditedMessage,
    handleCancelEditMessage,
    newMessage,
    setNewMessage,
    canSendSelectedConversationMessage,
    isSending,
    handleSendMessage,
    handleSendImageMessage,
    isUploadingImage,
    pendingImageFile,
    setPendingImageFile,
    imageInputRef,
    hasMoreMessages,
    isLoadingMoreMessages,
    loadMoreMessages,
    typingUsers,
    scrollContainerRef,
    showChatDetailsSidebar,
    setShowChatDetailsSidebar,
    showEmojiPicker,
    setShowEmojiPicker,
    handleMarkAllAsRead,
    handleMarkConversationAsUnread,
    pinnedMessages,
    pinMessageLocal,
    setForwardingMessages,
    setSelectChatsMode,
  } = page;

  const previousScrollHeightRef = useRef<number>(0);
  const previousScrollTopRef = useRef<number>(0);
  const typingEmitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaRows, setTextareaRows] = useState(1);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  const [isMessageSelectionMode, setIsMessageSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null);

  const currentConversationIdRef = useRef<string | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const hasCalculatedUnreadRef = useRef<string | null>(null);

  // Reset first unread message ID when changing conversation
  useEffect(() => {
    setFirstUnreadMessageId(null);
    hasCalculatedUnreadRef.current = null;
  }, [selectedConversation?.id]);

  // Find the first unread message ONLY ONCE per conversation
  useEffect(() => {
    if (
      messages.length > 0 &&
      profile?.userId &&
      selectedConversation?.id &&
      messages[0].conversationId === selectedConversation.id && // Ensure messages match current chat
      hasCalculatedUnreadRef.current !== selectedConversation.id
    ) {
      const firstUnread = messages.find(
        (m) => m.senderId !== profile.userId && !m.readBy?.includes(profile.userId)
      );
      if (firstUnread) {
        setFirstUnreadMessageId(firstUnread.id);
      }
      hasCalculatedUnreadRef.current = selectedConversation.id;
    }
  }, [messages, profile?.userId, selectedConversation?.id]);

  // Close header menu on click outside
  const handleClickOutsideHeaderMenu = useCallback((e: MouseEvent) => {
    if (
      headerMenuRef.current &&
      !headerMenuRef.current.contains(e.target as Node)
    ) {
      setShowHeaderMenu(false);
    }
  }, []);

  // Preserve scroll position when prepending older messages, and auto-scroll to bottom
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (isLoadingMoreMessages) {
      const currentHeight = container.scrollHeight;
      if (currentHeight > previousScrollHeightRef.current) {
        const heightDifference =
          currentHeight - previousScrollHeightRef.current;
        container.scrollTop = previousScrollTopRef.current + heightDifference;
      }
      return;
    }

    const messagesMatchConversation =
      messages.length === 0 ||
      messages[0].conversationId === selectedConversation?.id;
    if (!messagesMatchConversation) return;

    const isNewConversation =
      currentConversationIdRef.current !== selectedConversation?.id;
    const lastMessageId =
      messages.length > 0 ? messages[messages.length - 1].id : null;
    const isNewMessage = lastMessageId !== lastMessageIdRef.current;

    if (isNewConversation || isNewMessage) {
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        250;
      const isMyMessage =
        messages.length > 0 &&
        messages[messages.length - 1].senderId === profile?.userId;

      if (isNewConversation || isAtBottom || isMyMessage) {
        container.scrollTop = container.scrollHeight;
      }

      currentConversationIdRef.current = selectedConversation?.id || null;
      lastMessageIdRef.current = lastMessageId;
    }
  }, [
    messages,
    isLoadingMoreMessages,
    selectedConversation?.id,
    profile?.userId,
  ]);



  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    previousScrollHeightRef.current = container.scrollHeight;
    previousScrollTopRef.current = container.scrollTop;
    if (
      container.scrollTop < 100 &&
      hasMoreMessages &&
      !isLoadingMoreMessages
    ) {
      void loadMoreMessages();
    }
  };

  const handleSend = () => {
    if (typingEmitTimeoutRef.current)
      clearTimeout(typingEmitTimeoutRef.current);
    const socket = getCommunitySocket();
    if (selectedConversation) {
      socket.emit("community:typingStop", {
        conversationId: selectedConversation.id,
      });
    }
    if (pendingImageFile) {
      void handleSendImageMessage(pendingImageFile, newMessage.trim());
      setPendingImageFile(null);
    } else {
      handleSendMessage();
    }
    setTextareaRows(1);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleMessageChange = useCallback(
    (val: string) => {
      setNewMessage(val);

      const lineCount = (val.match(/\n/g) || []).length + 1;
      setTextareaRows(Math.min(lineCount, 5));

      if (!selectedConversation) return;
      const socket = getCommunitySocket();
      if (val.trim().length > 0) {
        socket.emit("community:typingStart", {
          conversationId: selectedConversation.id,
        });
        if (typingEmitTimeoutRef.current)
          clearTimeout(typingEmitTimeoutRef.current);
        typingEmitTimeoutRef.current = setTimeout(() => {
          socket.emit("community:typingStop", {
            conversationId: selectedConversation.id,
          });
        }, 2000);
      } else {
        socket.emit("community:typingStop", {
          conversationId: selectedConversation.id,
        });
      }
    },
    [setNewMessage, selectedConversation],
  );

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      setNewMessage((prev: string) => prev + emoji);
      setShowEmojiPicker(false);
      textareaRef.current?.focus();
    },
    [setNewMessage, setShowEmojiPicker],
  );

  const currentlyTypingUsers = selectedConversation
    ? typingUsers[selectedConversation.id] || []
    : [];
  const isSomeoneTyping = currentlyTypingUsers.length > 0;
  const isGroup = selectedConversation?.conversationType === "GROUP";
  const hasContent = newMessage.trim().length > 0 || !!pendingImageFile;

  // Last seen for DM
  const lastSeenText =
    !isGroup && selectedConversation?.otherParticipant?.lastSeenAt
      ? formatLastSeen(selectedConversation.otherParticipant.lastSeenAt)
      : null;

  // Empty state — no conversation selected
  if (!selectedConversation) {
    return (
      <div
        className={`h-full min-h-0 min-w-0 flex-col overflow-hidden ${workspaceView === "CHAT" ? "flex" : "hidden md:flex"}`}
      >
        <CommunityChatEmptyState
          onBack={() => {
            setIsConversationSidebarOpen(true);
            setSidebarMode("INBOX");
            setWorkspaceView("DIRECTORY");
          }}
        />
      </div>
    );
  }

  return (
    <motion.section
      className={`relative h-full min-h-0 min-w-0 flex-col overflow-hidden chat-bg ${workspaceView === "CHAT" ? "flex" : "hidden md:flex"}`}
    >
      {/* ── Header ── */}
      <div className="z-20 shrink-0 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl px-3 py-2.5 sm:px-4 shadow-[0_1px_12px_rgba(0,0,0,0.03)] supports-[backdrop-filter]:bg-white/70">
        <div className="flex items-center gap-3">
          {/* Back button (mobile only) */}
          <button
            onClick={() => {
              setIsConversationSidebarOpen(true);
              setSidebarMode("INBOX");
              setWorkspaceView("DIRECTORY");
            }}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition md:hidden"
            aria-label="Back"
          >
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>

          {/* Clickable Avatar + Name */}
          <button
            onClick={() => setShowChatDetailsSidebar(!showChatDetailsSidebar)}
            className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-80 transition"
          >
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-bold uppercase text-slate-700 ring-2 ring-white shadow-sm">
              {selectedConversationPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedConversationPhotoUrl}
                  alt={selectedConversationDisplayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                selectedConversationAvatarChar
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-semibold text-slate-900 leading-tight tracking-tight">
                {selectedConversationDisplayName}
              </h2>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                {lastSeenText ? (
                  <span className="text-slate-600">{lastSeenText}</span>
                ) : isGroup ? (
                  "Group chat"
                ) : (
                  "Direct message"
                )}
              </p>
            </div>
          </button>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-0.5 relative">
            {isGroup && (
              <button
                onClick={() => setShowGroupMembersPanel(!showGroupMembersPanel)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition"
                aria-label={
                  showGroupMembersPanel ? "Hide members" : "Show members"
                }
              >
                {showGroupMembersPanel ? (
                  <PanelRightClose size={18} />
                ) : (
                  <PanelRightOpen size={18} />
                )}
              </button>
            )}

            {/* Three-dot menu */}
            <button
              onClick={() => setShowHeaderMenu((prev) => !prev)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition"
              aria-label="More options"
            >
              <MoreVertical size={18} />
            </button>

            {/* Header dropdown menu */}
            <AnimatePresence>
              {showHeaderMenu && (
                <motion.div
                  ref={headerMenuRef}
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-slate-200/60 bg-white/95 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] overflow-hidden"
                >
                  <button
                    onClick={() => {
                      handleMarkAllAsRead();
                      setShowHeaderMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition border-b border-slate-100"
                  >
                    <CheckCheck size={15} className="text-turf-green" />
                    Mark all as Read
                  </button>
                  <button
                    onClick={() => {
                      setShowHeaderMenu(false);
                      setIsMessageSelectionMode(!isMessageSelectionMode);
                      if (isMessageSelectionMode) {
                        setSelectedMessageIds([]);
                      }
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    <Check size={15} className="text-power-orange" />
                    {isMessageSelectionMode ? "Cancel Selection" : "Select Messages"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Pending request banner */}
        <AnimatePresence>
          {selectedConversationIsPending && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2.5 overflow-hidden"
            >
              <div className="rounded-[14px] border border-orange-200/60 bg-gradient-to-r from-orange-50/80 to-amber-50/80 px-3.5 py-2.5 shadow-sm backdrop-blur-md">
                {selectedConversationNeedsMyApproval ? (
                  <>
                    <p className="font-600 text-orange-900 text-[14px]">Message request</p>
                    <p className="mt-0.5 text-[12px] text-orange-800/80">
                      Do you want to accept this conversation request?
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={handleAcceptRequest}
                        className="rounded-xl bg-gradient-to-b from-power-orange to-orange-600 px-4 py-1.5 text-[12px] font-semibold text-white shadow-md shadow-orange-500/20 hover:from-orange-500 hover:to-orange-700 transition active:scale-95"
                      >
                        Accept
                      </button>
                      <button
                        onClick={handleRejectRequest}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition active:scale-95"
                      >
                        Decline
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-[12px] font-medium text-orange-800/80">
                    Request sent. You can still message while waiting for a
                    reply.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pinned Message Banner */}
      <AnimatePresence>
        {selectedConversation && pinnedMessages[selectedConversation.id] && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="z-10 shrink-0 overflow-hidden border-b border-slate-200/50 bg-slate-50/90 backdrop-blur"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Pin size={12} className="shrink-0 text-power-orange fill-power-orange" />
                <p className="truncate text-xs font-medium text-slate-700">
                  <span className="font-semibold text-power-orange mr-1">Pinned:</span>
                  {messages.find(m => m.id === pinnedMessages[selectedConversation.id])?.content || "Message"}
                </p>
              </div>
              <button
                onClick={() => pinMessageLocal(selectedConversation.id, pinnedMessages[selectedConversation.id])}
                className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages area ────────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-4 sm:px-4 sm:pt-5 space-y-1"
      >
        {/* Load more spinner */}
        <AnimatePresence>
          {isLoadingMoreMessages && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex justify-center py-3"
            >
              <div className="flex items-center gap-2 rounded-full border border-slate-200/60 bg-white/80 backdrop-blur-md px-4 py-1.5 shadow-sm text-xs font-medium text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-power-orange" />
                Loading older messages…
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message list */}
        {messages.map((message, index) => {
          const prevMessage = messages[index - 1];
          const showDateSeparator =
            !prevMessage ||
            new Date(message.createdAt).toDateString() !==
            new Date(prevMessage.createdAt).toDateString();
            
          const isFirstUnread = message.id === firstUnreadMessageId;

          return (
            <div key={message.id}>
              {showDateSeparator && (
                <div className="flex items-center gap-3 py-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300/40 to-slate-300/40" />
                  <span className="shrink-0 rounded-full border border-slate-200/50 bg-white/80 backdrop-blur-md px-3 py-1 text-[10px] font-semibold tracking-wide text-slate-500 shadow-sm">
                    {new Date(message.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year:
                        new Date(message.createdAt).getFullYear() !==
                          new Date().getFullYear()
                          ? "numeric"
                          : undefined,
                    })}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-300/40 to-slate-300/40" />
                </div>
              )}
              {isFirstUnread && (
                <div className="flex items-center gap-3 py-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-power-orange/40 to-power-orange/40" />
                  <span className="shrink-0 rounded-full border border-orange-200/60 bg-orange-50 px-3 py-1 text-[10px] font-semibold tracking-wide text-power-orange shadow-sm">
                    New Messages
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent via-power-orange/40 to-power-orange/40" />
                </div>
              )}
              <MessageBubble
                message={message}
                isOwnMessage={message.senderId === profile?.userId}
                isGroupConversation={isGroup}
                profileUserId={profile?.userId}
                onOpenMobileActions={(m) => setMobileActionMessageId(m.id)}
                onRetry={retryFailedMessage}
                onEdit={handleBeginEditMessage}
                onDelete={handleDeleteMessage}
                onCopy={handleCopyMessage}
                isCopied={copiedMessageId === message.id}
                isEditing={editingMessageId === message.id}
                isMutating={isMutatingMessageId === message.id}
                isPinned={selectedConversation ? pinnedMessages[selectedConversation.id] === message.id : false}
                onPin={(m) => pinMessageLocal(selectedConversation!.id, m.id)}
                onForward={(m) => {
                  setForwardingMessages([m]);
                  setSelectChatsMode(true);
                  if (window.innerWidth < 768) {
                    page.setWorkspaceView("DIRECTORY");
                  }
                }}
                onMarkUnread={() => handleMarkConversationAsUnread(selectedConversation!.id)}
                isSelectMode={isMessageSelectionMode}
                isSelected={selectedMessageIds.includes(message.id)}
                onToggleSelect={(id) => {
                  setSelectedMessageIds((prev) =>
                    prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
                  );
                }}
                onClickName={isGroup ? (m) => {
                  if (m.senderId && page.handleOpenMemberProfile) {
                    page.handleOpenMemberProfile(m.senderId);
                  }
                } : undefined}
              />
            </div>
          );
        })}

        {/* Typing indicator */}
        <AnimatePresence>
          {isSomeoneTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex items-end gap-2 justify-start mt-2"
            >
              <div className="inline-flex items-center gap-2 rounded-[18px] rounded-bl-[6px] border border-slate-200/60 bg-white/90 backdrop-blur-sm px-4 py-2.5 shadow-sm">
                <div className="flex gap-1.5 items-center">
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* ── Edit banner ──────────────────────────────────────────── */}
      <AnimatePresence>
        {editingMessageId && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-orange-200/50 bg-gradient-to-b from-orange-50/50 to-white/50 backdrop-blur-xl shrink-0"
          >
            <div className="px-4 py-3 sm:px-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-power-orange">
                  <Pencil size={14} />
                  Editing message
                </div>
                <button
                  onClick={handleCancelEditMessage}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600 transition"
                >
                  <X size={16} />
                </button>
              </div>
              <textarea
                value={editingMessageDraft}
                onChange={(e) => setEditingMessageDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSaveEditedMessage();
                  }
                  if (e.key === "Escape") handleCancelEditMessage();
                }}
                rows={2}
                className="w-full resize-none rounded-[14px] border border-slate-200 bg-white/80 px-4 py-2.5 text-sm focus:border-power-orange focus:bg-white focus:outline-none focus:ring-4 focus:ring-power-orange/10 transition shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
              <div className="mt-2 flex gap-2 justify-end">
                <button
                  onClick={handleCancelEditMessage}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditedMessage}
                  disabled={isMutatingMessageId === editingMessageId}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-power-orange to-orange-600 px-4 py-1.5 text-[12px] font-semibold text-white shadow-md shadow-orange-500/20 hover:from-orange-500 hover:to-orange-700 disabled:opacity-50 active:scale-95 transition"
                >
                  <Check size={13} /> Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Composer ── */}
      <div className="z-20 shrink-0 border-t border-slate-200/40 bg-white/90 backdrop-blur-2xl px-3 py-2.5 sm:px-4 shadow-[0_-2px_16px_rgba(0,0,0,0.02)] supports-[backdrop-filter]:bg-white/70">
        {/* Hidden file input */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setPendingImageFile(file);
            e.target.value = "";
          }}
        />

        {/* Pending image preview */}
        <AnimatePresence>
          {pendingImageFile && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="mb-2.5"
            >
              <div className="relative inline-block rounded-[16px] border border-slate-200/80 bg-white/50 p-1 shadow-sm backdrop-blur-md">
                <button
                  onClick={() => setPendingImageFile(null)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-slate-800 text-white shadow-md hover:bg-slate-700 transition active:scale-90"
                >
                  <X size={12} />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(pendingImageFile)}
                  alt="Preview"
                  className="h-24 w-auto max-w-[180px] rounded-[12px] object-cover shadow-sm"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input row: Emoji | Input | Attach | Send */}
        <div className="flex items-center gap-2">
          {/* Emoji button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={!canSendSelectedConversationMessage}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-power-orange active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Emoji"
            >
              <Smile size={20} strokeWidth={2} />
            </button>
            <AnimatePresence>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Textarea */}
          <div className="relative flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => handleMessageChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSendSelectedConversationMessage && hasContent)
                    handleSend();
                }
              }}
              placeholder={
                !selectedConversation
                  ? "Select a conversation"
                  : pendingImageFile
                    ? "Add a caption…"
                    : "Type a message..."
              }
              disabled={!canSendSelectedConversationMessage || isUploadingImage}
              rows={textareaRows}
              className="w-full resize-none rounded-[20px] border border-slate-200/80 bg-slate-50/60 px-4 py-2 text-[14px] leading-relaxed focus:border-power-orange/50 focus:bg-white focus:outline-none focus:ring-3 focus:ring-power-orange/10 disabled:cursor-not-allowed disabled:opacity-60 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              style={{
                maxHeight: "9rem",
                overflowY: textareaRows >= 5 ? "auto" : "hidden",
              }}
            />
          </div>

          {/* Attach image button */}
          <button
            type="button"
            disabled={
              !canSendSelectedConversationMessage ||
              isSending ||
              isUploadingImage
            }
            onClick={() => imageInputRef.current?.click()}
            aria-label="Attach image"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-power-orange active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUploadingImage ? (
              <RotateCcw size={18} className="animate-spin text-power-orange" />
            ) : (
              <Paperclip size={19} strokeWidth={2} />
            )}
          </button>

          {/* Send button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            disabled={
              isSending ||
              isUploadingImage ||
              !canSendSelectedConversationMessage ||
              !hasContent
            }
            onClick={handleSend}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-power-orange to-orange-500 text-white shadow-[0_2px_8px_rgba(233,115,22,0.3)] hover:from-orange-500 hover:to-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 transition-all"
            aria-label="Send message"
          >
            {isSending ? (
              <RotateCcw size={16} className="animate-spin" />
            ) : (
              <ArrowUp size={18} className="translate-x-[0.5px]" strokeWidth={2.5} />
            )}
          </motion.button>
        </div>
      </div>

      {/* Message Selection Forward Bar */}
      <AnimatePresence>
        {isMessageSelectionMode && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="absolute bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] flex gap-2"
          >
            <button
              onClick={() => {
                setIsMessageSelectionMode(false);
                setSelectedMessageIds([]);
              }}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              disabled={selectedMessageIds.length === 0}
              onClick={() => {
                const selectedMsgs = messages.filter(m => selectedMessageIds.includes(m.id));
                page.setForwardingMessages(selectedMsgs);
                page.setSelectChatsMode(true);
                if (window.innerWidth < 768) {
                  page.setWorkspaceView("DIRECTORY");
                }
                setIsMessageSelectionMode(false);
                setSelectedMessageIds([]);
              }}
              className="flex-1 rounded-lg bg-power-orange py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              Forward
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
