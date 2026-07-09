"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Search,
  Users,
  X,
  MoreVertical,
  Plus,
  Check,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { ConversationListItem } from "@/modules/community/components/chat/ConversationListItem";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";

type Props = { page: CommunityPageViewModel };

export default function CommunityDirectoryPanel({ page }: Props) {
  const {
    workspaceView,
    directoryView,
    setDirectoryView,
    handleOpenConversation,
    conversationModeOptions,
    conversationMode,
    setConversationMode,
    managedConversations,
    selectedConversationId,
    hasConversationFilters,
    hasMoreConversations,
    handleLoadMoreConversations,
    isLoadingMoreConversations,
    // Chat enhancement state
    pinnedConversationIds,
    mutedConversationIds,
    conversationSearchQuery,
    setConversationSearchQuery,
    handleTogglePinConversation,
    handleToggleMuteConversation,
  } = page;

  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  return (
    <motion.section
      className={`flex flex-col h-full min-h-0 border-r border-slate-200/70 bg-white relative ${workspaceView === "DIRECTORY" ? "flex" : "hidden md:flex"}`}
    >
      {/* ── Fixed Header ── */}
      <div className="flex-none px-3 pt-3 pb-1">
        {/* Title Row */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[17px] font-bold tracking-tight text-slate-900">
            Inbox
          </h2>
          <div className="relative">
            <button
              onClick={() => setShowHeaderMenu(!showHeaderMenu)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition"
            >
              <MoreVertical size={16} />
            </button>
            <AnimatePresence>
              {showHeaderMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowHeaderMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scaleY: 0, transformOrigin: "top" }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0 }}
                    className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
                  >

                    <button
                      onClick={() => {
                        setShowHeaderMenu(false);
                        page.setShowBlockedUsersModal(true);
                      }}
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Blocked Users
                    </button>
                    <button
                      onClick={() => {
                        setShowHeaderMenu(false);
                        // Mock mark all read
                      }}
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Mark all as Read
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-2">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={conversationSearchQuery}
            onChange={(e) => setConversationSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-1.5 pl-8 pr-7 text-[12px] focus:border-power-orange/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-power-orange/10 transition"
          />
          {conversationSearchQuery && (
            <button
              onClick={() => setConversationSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* DM / Groups Toggle */}
        <div className="flex items-center gap-1.5">
          <div className="flex w-full items-center gap-0.5 rounded-lg border border-border bg-slate-50 p-0.5 shadow-xs">
            <button
              onClick={() => setDirectoryView("CONTACTS")}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 px-2 text-[11px] font-semibold transition ${directoryView === "CONTACTS" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
            >
              <MessageSquare size={12} /> DMs
            </button>
            <button
              onClick={() => setDirectoryView("GROUPS")}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 px-2 text-[11px] font-semibold transition ${directoryView === "GROUPS" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
            >
              <Users size={12} /> Groups
            </button>
          </div>
        </div>
      </div>

      {/* ── Scrollable Body ── */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* All / Unread Filter Capsules */}
          <div className="px-4 pt-2 pb-2 flex-none">
            <div
              className={`grid gap-0.5 rounded-lg border border-border bg-slate-50 p-0.5 shadow-xs ${directoryView === "GROUPS" ? "w-32 grid-cols-2" : "w-full grid-cols-3"}`}
            >
              {conversationModeOptions.map((item) => (
                <button
                  key={item.value}
                  onClick={() =>
                    setConversationMode(
                      item.value as "ALL" | "UNREAD" | "REQUESTS",
                    )
                  }
                  className={`rounded-md py-1 px-1 text-[10px] font-bold uppercase tracking-wider transition ${conversationMode === item.value ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Pinned section divider */}
            {managedConversations.some((c) =>
              pinnedConversationIds.includes(c.id),
            ) && (
              <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 bg-slate-50/50">
                Pinned
              </div>
            )}
            {managedConversations.map((conversation, index) => {
              const isPinned = pinnedConversationIds.includes(conversation.id);
              const isMuted = mutedConversationIds.includes(conversation.id);

              // Show "All Conversations" divider after pinned section
              const prevConversation = managedConversations[index - 1];
              const showAllDivider =
                index > 0 &&
                prevConversation &&
                pinnedConversationIds.includes(prevConversation.id) &&
                !isPinned;

              return (
                <div key={conversation.id}>
                  {showAllDivider && (
                    <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 bg-slate-50/50">
                      All Conversations
                    </div>
                  )}
                  <div className="group flex items-center">
                    {page.selectChatsMode && (
                      <div className="pl-3 pr-1 py-3 flex items-center justify-center">
                        <button
                          onClick={() => page.toggleChatSelection(conversation.id)}
                          className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                            page.selectedChatIds.includes(conversation.id)
                              ? "bg-power-orange border-power-orange text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {page.selectedChatIds.includes(conversation.id) && <Check size={10} strokeWidth={3} />}
                        </button>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <ConversationListItem
                        conversation={conversation}
                        isSelected={conversation.id === selectedConversationId}
                        isPinned={isPinned}
                        isMuted={isMuted}
                        onOpenConversation={handleOpenConversation}
                        onTogglePin={handleTogglePinConversation}
                        onToggleMute={handleToggleMuteConversation}
                        isSelectMode={page.selectChatsMode}
                        onToggleSelect={page.toggleChatSelection}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {!managedConversations.length && (
              <div className="p-6 text-center">
                <MessageSquare size={32} className="mx-auto text-slate-200 mb-3" />
                <p className="text-sm text-slate-500">
                  {hasConversationFilters
                    ? "No matches for current filters."
                    : "No conversations yet."}
                </p>
              </div>
            )}
            {!hasConversationFilters && hasMoreConversations && (
              <button
                onClick={() => void handleLoadMoreConversations()}
                disabled={isLoadingMoreConversations}
                className="w-full border-t border-slate-100 bg-white px-3 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                {isLoadingMoreConversations ? "Loading..." : "Load more"}
              </button>
            )}
          </div>
        </div>


      {/* FAB */}
      {!page.selectChatsMode && (
        <button
          onClick={() => page.setShowAddChatModal(true)}
          className="absolute bottom-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-power-orange text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition hover:scale-105 active:scale-95"
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {/* Select Chats Mode Send Bar */}
      <AnimatePresence>
        {page.selectChatsMode && page.forwardingMessages.length > 0 && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="absolute bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] flex gap-2"
          >
            <button
              onClick={() => {
                page.setSelectChatsMode(false);
                page.clearChatSelection();
                page.setForwardingMessages([]);
              }}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                try {
                  await page.handleForwardMessages(page.selectedChatIds);
                  const prefix = page.forwardingMessages.length > 1 ? "Messages" : "Message";
                  toast.success(`${prefix} forwarded to ${page.selectedChatIds.length} ${page.selectedChatIds.length === 1 ? "chat" : "chats"}`);
                } catch (err) {
                  toast.error("Failed to forward messages");
                } finally {
                  page.setSelectChatsMode(false);
                  page.clearChatSelection();
                  page.setForwardingMessages([]);
                }
              }}
              disabled={page.selectedChatIds.length === 0}
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
