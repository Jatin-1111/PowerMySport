"use client";

import {
  Activity,
  Compass,
  Flag,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Trash,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { GroupInviteLink } from "@/modules/community/components/GroupInviteLink";
import { ConversationListItem } from "@/modules/community/components/chat/ConversationListItem";
import { getAvatarCharacter, formatUserMeta } from "@/modules/community/utils/chatUtils";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";

type Props = { page: CommunityPageViewModel };

export default function CommunityDirectoryPanel({ page }: Props) {
  const {
    workspaceView,
    sidebarMode,
    setSidebarMode,
    directoryView,
    setDirectoryView,
    setGroupToolsMode,
    groupToolsMode,
    toolsSteps,
    playerSearchQuery,
    setPlayerSearchQuery,
    isSearchingPlayers,
    playerSearchResults,
    handleStartConversation,
    groupMode,
    setGroupMode,
    isCreateGroupOpen,
    setIsCreateGroupOpen,
    newGroupName,
    setNewGroupName,
    newGroupSport,
    setNewGroupSport,
    handleCreateGroup,
    isCreatingGroup,
    groupSearchQuery,
    setGroupSearchQuery,
    isSearchingGroups,
    toolVisibleGroups,
    getGroupConversationByGroupId,
    handleOpenConversation,
    handleJoinGroup,
    handleOpenReportModal,
    isLeavingGroupId,
    handleLeaveGroup,
    isDeletingGroupId,
    handleDeleteGroup,
    inviteGroupId,
    conversationModeOptions,
    conversationMode,
    setConversationMode,
    managedConversations,
    selectedConversationId,
    hasConversationFilters,
    hasMoreConversations,
    handleLoadMoreConversations,
    isLoadingMoreConversations,
  } = page;

  return (
    <motion.section
      className={`flex flex-col h-full min-h-0 border-r border-slate-200 bg-white p-3.5 pb-24 sm:p-4 md:pb-4 lg:p-4 ${workspaceView === "DIRECTORY" ? "flex" : "hidden md:flex"}`}
    >
      {/* ── Fixed Header ── */}
      <div className="flex-none">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-600" />
            <h2 className="text-base font-semibold tracking-tight">
              Conversations
            </h2>
          </div>
          
          {/* Inbox / Tools Toggle */}
          <div className="flex rounded-lg border border-border bg-slate-50 p-0.5 shadow-xs">
            {["INBOX", "TOOLS"].map((mode) => (
              <button
                key={mode}
                onClick={() => setSidebarMode(mode as "INBOX" | "TOOLS")}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition ${sidebarMode === mode ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-800"}`}
              >
                {mode === "INBOX" ? "Inbox" : "Tools"}
              </button>
            ))}
          </div>
        </div>

        {/* DM / Groups Toggle Switch */}
        <div className="mt-3 flex w-44 items-center gap-1 rounded-xl border border-border bg-slate-50 p-0.5 shadow-xs">
          <button
            onClick={() => setDirectoryView("CONTACTS")}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 px-2 text-[11px] font-semibold transition ${directoryView === "CONTACTS" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            <MessageSquare size={12} /> DM
          </button>
          <button
            onClick={() => setDirectoryView("GROUPS")}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 px-2 text-[11px] font-semibold transition ${directoryView === "GROUPS" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            <Users size={12} /> Groups
          </button>
        </div>
      </div>

      {/* ── Scrollable Body ── */}
      {sidebarMode === "TOOLS" ? (
        <div className="mt-3 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-1">
          <div className="rounded-2xl border border-white/80 bg-[linear-gradient(135deg,#fafdff_0%,#eaf4ff_100%)] p-4 shadow-sm relative overflow-hidden flex-none">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-300/20 blur-2xl" />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-600/80">
                  {directoryView === "GROUPS"
                    ? "Community"
                    : "Direct Messages"}
                </p>
                <h3 className="font-title mt-1 text-lg font-bold text-slate-900">
                  {directoryView === "GROUPS"
                    ? "Group Tools"
                    : "Chat Tools"}
                </h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/60 shadow-sm backdrop-blur-md">
                {directoryView === "GROUPS" ? (
                  <Users size={20} className="text-sky-600" />
                ) : (
                  <MessageSquare
                    size={20}
                    className="text-sky-600"
                  />
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-1">
              {toolsSteps.map((step) => (
                <div
                  key={step.id}
                  className="group relative flex-1"
                >
                  <div
                    className={`h-1.5 w-full rounded-full transition-colors duration-300 ${step.done ? "bg-turf-green" : "bg-white/60 shadow-inner"}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {directoryView === "CONTACTS" ? (
            <div className="space-y-3 rounded-2xl border border-slate-200/60 bg-white/80 p-3 shadow-sm backdrop-blur-md flex-none">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
                Search a user and tap their card to instantly create
                or open a DM thread.
              </div>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={playerSearchQuery}
                  onChange={(e) =>
                    setPlayerSearchQuery(e.target.value)
                  }
                  placeholder="Search by name or alias"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                />
              </div>
              {playerSearchQuery.trim().length >= 2 && (
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-1.5 shadow-inner">
                  {isSearchingPlayers ? (
                    <p className="p-2 text-center text-sm text-slate-500">
                      Searching...
                    </p>
                  ) : playerSearchResults.length ? (
                    playerSearchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() =>
                          void handleStartConversation(user.id)
                        }
                        className="flex w-full items-start gap-3 rounded-lg bg-white px-3 py-2.5 text-left text-sm shadow-sm hover:border-power-orange/30 hover:bg-power-orange/5"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {user.photoUrl ? (
                            <img
                              src={user.photoUrl}
                              alt={user.displayName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getAvatarCharacter(user.displayName)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold text-slate-800">
                              {user.displayName}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                            <span>
                              {user.isIdentityPublic
                                ? "Public"
                                : "Anonymous"}
                            </span>
                            {formatUserMeta(user) && (
                              <span>{formatUserMeta(user)}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-center text-sm text-slate-500">
                      No users found for this search.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl border border-slate-200/60 bg-white/80 p-3 shadow-sm backdrop-blur-md flex-1 min-h-[300px] flex flex-col">
              <div className="relative flex w-52 rounded-xl border border-slate-200/60 bg-slate-100/50 p-0.5 flex-none">
                {[
                  {
                    value: "DISCOVER",
                    label: "Discover",
                    icon: Compass,
                  },
                  {
                    value: "MANAGE",
                    label: "Manage",
                    icon: Settings,
                  },
                  {
                    value: "INVITE",
                    label: "Invite",
                    icon: UserPlus,
                  },
                ].map((item) => {
                  const isActive = groupToolsMode === item.value;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      onClick={() =>
                        setGroupToolsMode(
                          item.value as
                            | "DISCOVER"
                            | "MANAGE"
                            | "INVITE",
                        )
                      }
                      className={`relative flex flex-1 items-center justify-center gap-1 rounded-lg py-1 text-[10px] font-semibold transition-colors z-10 ${isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="groupToolsTab"
                          className="absolute inset-0 z-0 rounded-lg bg-white shadow-xs border border-slate-200/50"
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1">
                        <Icon
                          size={12}
                          className={
                            isActive ? "text-power-orange" : ""
                          }
                        />
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 flex-none">
                <div className="flex gap-1 rounded-lg bg-slate-50 p-0.5 border border-slate-200/60 w-48">
                  {[
                    { value: "ALL", label: "All" },
                    { value: "JOINED", label: "Joined" },
                    { value: "DISCOVER", label: "Discover" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      onClick={() =>
                        setGroupMode(
                          item.value as
                            | "ALL"
                            | "JOINED"
                            | "DISCOVER",
                        )
                      }
                      className={`flex-1 rounded-md py-1 text-[9px] font-bold uppercase tracking-wider transition-all ${groupMode === item.value ? "bg-white text-slate-800 shadow-xs border border-slate-200/50" : "text-slate-500 hover:bg-slate-100"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative flex-none">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={groupSearchQuery}
                  onChange={(e) =>
                    setGroupSearchQuery(e.target.value)
                  }
                  placeholder="Search groups"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                />
              </div>

              <div className="flex-1 overflow-y-auto pr-1 pb-2 space-y-3 mt-3">
                {isSearchingGroups ? (
                  <div className="py-8 text-center">
                    <Activity className="mx-auto h-6 w-6 animate-pulse text-slate-300" />
                  </div>
                ) : toolVisibleGroups.length ? (
                  toolVisibleGroups.map((group) => {
                    const groupConversation =
                      getGroupConversationByGroupId(group.id);
                    return (
                      <motion.div
                        layout
                        key={group.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm hover:border-power-orange/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-slate-100 to-slate-200 font-title text-base font-bold text-slate-600 shadow-inner">
                              {group.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="truncate font-title text-[14px] font-semibold text-slate-900 leading-tight">
                                {group.name}
                              </h4>
                              <p className="text-[11px] font-medium text-slate-500">
                                {group.memberCount} members
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {group.isMember ? (
                              <button
                                onClick={() => {
                                  if (groupConversation)
                                    handleOpenConversation(
                                      groupConversation.id,
                                    );
                                  else {
                                    setDirectoryView("GROUPS");
                                    setGroupSearchQuery(group.name);
                                  }
                                }}
                                className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700"
                              >
                                {groupConversation
                                  ? "Chat"
                                  : "View"}
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() =>
                                    void handleJoinGroup(group.id)
                                  }
                                  className="rounded-lg bg-power-orange px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
                                >
                                  Join
                                </button>
                                <button
                                  onClick={() =>
                                    handleOpenReportModal(
                                      "GROUP",
                                      group.id,
                                    )
                                  }
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                                >
                                  <Flag size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <AnimatePresence>
                          {group.isMember &&
                            groupToolsMode === "MANAGE" && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{
                                  opacity: 1,
                                  height: "auto",
                                }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 border-t border-slate-100 pt-3"
                              >
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      void handleLeaveGroup(
                                        group.id,
                                      )
                                    }
                                    disabled={
                                      isLeavingGroupId === group.id
                                    }
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-60"
                                  >
                                    <LogOut size={14} /> Leave Group
                                  </button>
                                  {group.isAdmin && (
                                    <button
                                      onClick={() =>
                                        void handleDeleteGroup(
                                          group.id,
                                        )
                                      }
                                      disabled={
                                        isDeletingGroupId === group.id
                                      }
                                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-60"
                                    >
                                      <Trash size={14} /> Delete Group
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      handleOpenReportModal(
                                        "GROUP",
                                        group.id,
                                      )
                                    }
                                    className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600 hover:bg-slate-100"
                                  >
                                    <Flag size={14} />
                                  </button>
                                </div>
                              </motion.div>
                            )}
                        </AnimatePresence>
                        <AnimatePresence>
                          {group.isMember &&
                            groupToolsMode === "INVITE" && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{
                                  opacity: 1,
                                  height: "auto",
                                }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 border-t border-slate-100 pt-3"
                              >
                                {group.isAdmin && (
                                  <GroupInviteLink
                                    groupId={group.id}
                                    groupName={group.name}
                                  />
                                )}
                              </motion.div>
                            )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })
                ) : (
                  <p className="text-center text-sm text-slate-500 py-10">
                    No groups found.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col mt-3">
          {/* Dynamic Grid for Filters */}
          <div className={`grid gap-1.5 rounded-xl border border-border bg-slate-50 p-0.5 shadow-xs ${directoryView === "GROUPS" ? "w-36 grid-cols-2" : "w-52 grid-cols-3"}`}>
            {conversationModeOptions.map((item) => (
              <button
                key={item.value}
                onClick={() =>
                  setConversationMode(
                    item.value as "ALL" | "UNREAD" | "REQUESTS",
                  )
                }
                className={`rounded-lg py-1 px-1 text-[10px] font-bold uppercase tracking-wider transition ${conversationMode === item.value ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {managedConversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                isSelected={
                  conversation.id === selectedConversationId
                }
                onOpenConversation={handleOpenConversation}
              />
            ))}
            {!managedConversations.length && (
              <div className="p-4 text-center text-sm text-slate-500">
                {hasConversationFilters
                  ? "No matches for current filters."
                  : "No conversations yet."}
              </div>
            )}
            {!hasConversationFilters && hasMoreConversations && (
              <button
                onClick={() => void handleLoadMoreConversations()}
                disabled={isLoadingMoreConversations}
                className="w-full border border-border bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                {isLoadingMoreConversations
                  ? "Loading..."
                  : "Load more"}
              </button>
            )}
          </div>
        </div>
      )}
    </motion.section>
  );
}
