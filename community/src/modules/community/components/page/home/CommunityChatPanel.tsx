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
  Phone,
  Video,
  MoreVertical,
  Check,
  Pencil,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageBubble } from "@/modules/community/components/chat/MessageBubble";
import CommunityChatEmptyState from "@/modules/community/components/page/home/CommunityChatEmptyState";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";
import { useRef, useLayoutEffect, useCallback, useState } from "react";
import { getCommunitySocket } from "@/lib/realtime/socket";

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
  } = page;

  const previousScrollHeightRef = useRef<number>(0);
  const previousScrollTopRef = useRef<number>(0);
  const typingEmitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaRows, setTextareaRows] = useState(1);

  // Preserve scroll position when prepending older messages
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isLoadingMoreMessages) return;
    const currentHeight = container.scrollHeight;
    if (currentHeight > previousScrollHeightRef.current) {
      const heightDifference = currentHeight - previousScrollHeightRef.current;
      container.scrollTop = previousScrollTopRef.current + heightDifference;
    }
  }, [messages, isLoadingMoreMessages]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    previousScrollHeightRef.current = container.scrollHeight;
    previousScrollTopRef.current = container.scrollTop;
    if (container.scrollTop < 100 && hasMoreMessages && !isLoadingMoreMessages) {
      void loadMoreMessages();
    }
  };

  const handleSend = () => {
    if (typingEmitTimeoutRef.current) clearTimeout(typingEmitTimeoutRef.current);
    const socket = getCommunitySocket();
    if (selectedConversation) {
      socket.emit("community:typingStop", { conversationId: selectedConversation.id });
    }
    if (pendingImageFile) {
      void handleSendImageMessage(pendingImageFile, newMessage.trim());
      setPendingImageFile(null);
    } else {
      handleSendMessage();
    }
    // Reset textarea height after send
    setTextareaRows(1);
    // Refocus the textarea
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleMessageChange = useCallback(
    (val: string) => {
      setNewMessage(val);

      // Auto-resize textarea
      const lineCount = (val.match(/\n/g) || []).length + 1;
      setTextareaRows(Math.min(lineCount, 5));

      if (!selectedConversation) return;
      const socket = getCommunitySocket();
      if (val.trim().length > 0) {
        socket.emit("community:typingStart", { conversationId: selectedConversation.id });
        if (typingEmitTimeoutRef.current) clearTimeout(typingEmitTimeoutRef.current);
        typingEmitTimeoutRef.current = setTimeout(() => {
          socket.emit("community:typingStop", { conversationId: selectedConversation.id });
        }, 2000);
      } else {
        socket.emit("community:typingStop", { conversationId: selectedConversation.id });
      }
    },
    [setNewMessage, selectedConversation],
  );

  const currentlyTypingUsers = selectedConversation
    ? (typingUsers[selectedConversation.id] || [])
    : [];
  const isSomeoneTyping = currentlyTypingUsers.length > 0;
  const isGroup = selectedConversation?.conversationType === "GROUP";
  const hasContent = newMessage.trim().length > 0 || !!pendingImageFile;

  // Empty state — no conversation selected
  if (!selectedConversation) {
    return (
      <div className={`h-full min-h-0 min-w-0 flex-col overflow-hidden ${workspaceView === "CHAT" ? "flex" : "hidden lg:flex"}`}>
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
      className={`h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#efeae2] bg-[radial-gradient(rgba(255,255,255,0.34)_1px,transparent_1px),radial-gradient(rgba(0,0,0,0.03)_1px,transparent_1px)] bg-position-[0_0,11px_11px] bg-size-[22px_22px] ${workspaceView === "CHAT" ? "flex" : "hidden lg:flex"}`}
    >
      {/* ── Header ── (shrink-0, stays at top as flex item) */}
      <div className="z-20 shrink-0 border-b border-slate-200/70 bg-white/95 backdrop-blur-md px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-3">
          {/* Back button (mobile only) */}
          <button
            onClick={() => {
              setIsConversationSidebarOpen(true);
              setSidebarMode("INBOX");
              setWorkspaceView("DIRECTORY");
            }}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition lg:hidden"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Avatar */}
          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-sm font-bold uppercase text-slate-700 ring-2 ring-white shadow-sm">
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

          {/* Name + type */}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-600 text-slate-900 leading-tight">
              {selectedConversationDisplayName}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isGroup ? "Group chat" : "Direct message"}
            </p>
          </div>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-1">
            {isGroup && (
              <button
                onClick={() => setShowGroupMembersPanel(!showGroupMembersPanel)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition"
                aria-label={showGroupMembersPanel ? "Hide members" : "Show members"}
              >
                {showGroupMembersPanel ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
              </button>
            )}
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
              <div className="rounded-xl border border-power-orange/30 bg-power-orange/8 px-3 py-2.5 text-sm text-slate-700">
                {selectedConversationNeedsMyApproval ? (
                  <>
                    <p className="font-600 text-slate-800">Message request</p>
                    <p className="mt-0.5 text-xs text-slate-500">Do you want to accept this conversation request?</p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={handleAcceptRequest}
                        className="rounded-lg bg-power-orange px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 transition"
                      >
                        Accept
                      </button>
                      <button
                        onClick={handleRejectRequest}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Decline
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">
                    Request sent. You can still message while waiting for a reply.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Messages area ────────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-2 sm:px-4 sm:pt-4 space-y-1"
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
              <div className="flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-4 py-1.5 shadow-sm text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
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

          return (
            <div key={message.id}>
              {showDateSeparator && (
                <div className="flex items-center gap-3 py-3">
                  <div className="h-px flex-1 bg-slate-300/50" />
                  <span className="shrink-0 rounded-full bg-white/70 backdrop-blur px-3 py-0.5 text-[11px] font-medium text-slate-500 shadow-sm">
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
                  <div className="h-px flex-1 bg-slate-300/50" />
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
              />
            </div>
          );
        })}

        {/* Typing indicator */}
        <AnimatePresence>
          {isSomeoneTyping && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="flex items-end gap-2 justify-start"
            >
              <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-[5px] bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.1)] border border-slate-100">
                <div className="flex gap-1 items-center">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-[11px] text-slate-400 italic">
                  {currentlyTypingUsers.length === 1 ? "typing" : "multiple typing"}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* ── Edit banner ──────────────────────────────────────────── */}
      <AnimatePresence>
        {editingMessageId && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-power-orange/20 bg-power-orange/6 shrink-0"
          >
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-power-orange">
                  <Pencil size={12} />
                  Editing message
                </div>
                <button
                  onClick={handleCancelEditMessage}
                  className="text-slate-400 hover:text-slate-600 transition"
                >
                  <X size={14} />
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
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20 transition"
              />
              <div className="mt-2 flex gap-2 justify-end">
                <button
                  onClick={handleCancelEditMessage}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditedMessage}
                  disabled={isMutatingMessageId === editingMessageId}
                  className="flex items-center gap-1.5 rounded-lg bg-power-orange px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition"
                >
                  <Check size={12} /> Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Composer ── (shrink-0, stays at bottom as flex item) */}
      <div className="z-20 shrink-0 border-t border-slate-200/80 bg-[#f0f2f5] px-3 pt-2 pb-[calc(0.6rem+env(safe-area-inset-bottom))] sm:px-4">
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
              className="mb-2"
            >
              <div className="relative inline-block rounded-2xl border border-slate-200 bg-white p-1.5 shadow-md">
                <button
                  onClick={() => setPendingImageFile(null)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-white shadow-md hover:bg-slate-700 transition"
                >
                  <X size={13} />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(pendingImageFile)}
                  alt="Preview"
                  className="h-28 w-auto max-w-[200px] rounded-xl object-cover sm:h-32"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input row */}
        <div className="flex items-end gap-2">
          {/* Attach image button */}
          <button
            type="button"
            disabled={!canSendSelectedConversationMessage || isSending || isUploadingImage}
            onClick={() => imageInputRef.current?.click()}
            aria-label="Attach image"
            className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-power-orange active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10"
          >
            {isUploadingImage ? (
              <RotateCcw size={15} className="animate-spin text-power-orange" />
            ) : (
              <ImagePlus size={16} />
            )}
          </button>

          {/* Textarea */}
          <div className="relative flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => handleMessageChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSendSelectedConversationMessage && hasContent) handleSend();
                }
              }}
              placeholder={
                !selectedConversation
                  ? "Select a conversation"
                  : pendingImageFile
                  ? "Add a caption…"
                  : "Type a message…"
              }
              disabled={!canSendSelectedConversationMessage || isUploadingImage}
              rows={textareaRows}
              className="w-full resize-none rounded-3xl border border-slate-200 bg-white px-4 py-2.5 text-sm leading-relaxed focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/15 disabled:cursor-not-allowed disabled:opacity-60 transition shadow-sm"
              style={{ maxHeight: "9rem", overflowY: textareaRows >= 5 ? "auto" : "hidden" }}
            />
          </div>

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
            className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-power-orange text-white shadow-md hover:bg-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 transition sm:h-10 sm:w-10"
            aria-label="Send message"
          >
            {isSending ? (
              <RotateCcw size={15} className="animate-spin" />
            ) : (
              <Send size={16} className="translate-x-[1px]" />
            )}
          </motion.button>
        </div>

        {/* Keyboard hint */}
        <p className="mt-1.5 hidden text-center text-[11px] text-slate-400 sm:block">
          <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift+Enter</kbd> for new line
        </p>
      </div>
    </motion.section>
  );
}
