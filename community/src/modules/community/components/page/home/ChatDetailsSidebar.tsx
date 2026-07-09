"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Shield,
  MapPin,
  Clock3,
  BadgeCheck,
  UserCircle2,
  MessageSquare,
  BellOff,
  Bell,
  Ban,
  Flag,
  LogOut,
  UserPlus,
  Users,
} from "lucide-react";
import { GroupMembersList } from "@/modules/community/components/GroupMembersList";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";
import { getAvatarCharacter, getLastSeenTimestamp } from "@/modules/community/utils/chatUtils";

type Props = { page: CommunityPageViewModel };

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateFormatter.format(date);
};

export default function ChatDetailsSidebar({ page }: Props) {
  const {
    showDetailsSidebar,
    selectedConversation,
    setShowChatDetailsSidebar,
    selectedConversationDisplayName,
    selectedConversationPhotoUrl,
    selectedConversationAvatarChar,
    mutedConversationIds,
    handleToggleMuteConversation,
    handleOpenReportModal,
    handleLeaveGroup,
    isLeavingGroupId,
    handleMemberClick,
    selectedMemberProfile,
    isLoadingMemberProfile,
    handleOpenMemberProfile,
    handleCloseMemberProfile,
    handleToggleConversationBlock,
    isTogglingBlockUser,
    selectedConversationIsBlocked,
    handleMessageSelectedMember,
  } = page;

  const [membersCount, setMembersCount] = useState(0);

  const isViewingMember = !!selectedMemberProfile;
  const isGroup = selectedConversation?.conversationType === "GROUP" && !isViewingMember;
  const isMuted = selectedConversation
    ? mutedConversationIds.includes(selectedConversation.id)
    : false;

  // Use server-authoritative blocked state
  const isBlocked = !isGroup && selectedConversationIsBlocked;

  return (
    <AnimatePresence initial={false}>
      {showDetailsSidebar && selectedConversation && (
        <>
          {/* Backdrop for mobile */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (isViewingMember) {
                handleCloseMemberProfile();
              } else {
                setShowChatDetailsSidebar(false);
              }
            }}
            className="absolute inset-0 z-40 bg-slate-900/40 xl:hidden"
          />
          <motion.section
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-y-0 right-0 z-50 w-[92vw] max-w-sm overflow-y-auto border-l border-white/40 bg-white/95 backdrop-blur-2xl shadow-[-8px_0_30px_rgba(0,0,0,0.06)] xl:w-[340px] xl:max-w-none flex flex-col supports-[backdrop-filter]:bg-white/85"
          >
            {/* Close button */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-none">
              <h3 className="text-sm font-normal text-slate-600">
                {isViewingMember ? "Contact Info" : isGroup ? "Group Info" : "Contact Info"}
              </h3>
              <button
                onClick={() => {
                  if (isViewingMember) {
                    handleCloseMemberProfile();
                  } else {
                    setShowChatDetailsSidebar(false);
                  }
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/60 bg-white/60 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
                aria-label={isViewingMember ? "Back" : "Close"}
              >
                <X size={15} />
              </button>
            </div>

            {/* Profile Header */}
            <div className="flex flex-col items-center px-4 pt-3 pb-5 border-b border-slate-100 flex-none">
              {/* Avatar */}
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden ring-4 ring-white shadow-lg text-2xl font-bold uppercase text-slate-600">
                {isViewingMember && selectedMemberProfile ? (
                  selectedMemberProfile.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedMemberProfile.photoUrl}
                      alt={selectedMemberProfile.displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserCircle2 size={40} className="text-slate-400" />
                  )
                ) : selectedConversationPhotoUrl ? (
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

              <h2 className="mt-3 text-lg font-bold text-slate-900 tracking-tight text-center">
                {isViewingMember && selectedMemberProfile
                  ? selectedMemberProfile.displayName
                  : selectedConversationDisplayName}
              </h2>

              {!isGroup && !isViewingMember && (
                <p className="text-[12px] text-slate-500 mt-0.5">
                  {selectedConversation.otherParticipant.isIdentityPublic
                    ? "Public profile"
                    : "Anonymous profile"}
                </p>
              )}

              {isViewingMember && selectedMemberProfile && (
                <div className="flex flex-col items-center mt-2 w-full">
                  <p className="text-[12px] text-slate-500">
                    {selectedMemberProfile.isIdentityPublic
                      ? "Public profile"
                      : "Alias only"}
                  </p>
                  <button
                    onClick={handleMessageSelectedMember}
                    className="mt-3 flex w-full max-w-[200px] items-center justify-center gap-2 rounded-lg bg-power-orange py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-95"
                  >
                    <MessageSquare size={16} />
                    Message
                  </button>
                </div>
              )}

              {isGroup && !isViewingMember && selectedConversation.group && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Users size={13} className="text-slate-400" />
                  <span className="text-[13px] font-medium text-slate-600">
                    {selectedConversation.group.memberCount} members
                  </span>
                </div>
              )}

              {/* Last seen for DM */}
              {!isGroup && !isViewingMember && selectedConversation.otherParticipant.lastSeenAt && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Clock3 size={12} className="text-slate-400" />
                  <p className="text-sm text-slate-500">
                    Last seen{" "}
                    {getLastSeenTimestamp(
                      selectedConversation.otherParticipant.lastSeenAt,
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* ── DM or Member Profile Details ── */}
            {(!isGroup || isViewingMember) && (
              <div className="px-4 py-4 space-y-3 flex-none border-b border-slate-100">
                {/* Role */}
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
                    <BadgeCheck size={16} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Role
                    </p>
                    <p className="text-[13px] font-medium text-slate-800">
                      {isViewingMember && selectedMemberProfile
                        ? selectedMemberProfile.role === "Coach"
                          ? "Coach"
                          : "Player"
                        : "Player"}
                    </p>
                  </div>
                </div>

                {/* Privacy */}
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
                    <Shield size={16} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Privacy
                    </p>
                    <p className="text-[13px] font-medium text-slate-800">
                      {isViewingMember && selectedMemberProfile
                        ? selectedMemberProfile.isIdentityPublic
                          ? "Public identity"
                          : "Private identity"
                        : selectedConversation.otherParticipant?.isIdentityPublic
                          ? "Public identity"
                          : "Private identity"}
                    </p>
                  </div>
                </div>

                {isViewingMember && selectedMemberProfile?.city && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">
                      <MapPin size={16} className="text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Location
                      </p>
                      <p className="text-[13px] font-medium text-slate-800">
                        {selectedMemberProfile.city}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Group Details ── */}
            {isGroup && selectedConversation.group && (
              <div className="flex-1 min-h-0 flex flex-col">
                {/* Group info */}
                <div className="px-4 py-3 border-b border-slate-100 flex-none">
                  <div className="flex items-center gap-2 text-[12px] text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium">
                      {selectedConversation.group.sport || "General"}
                    </span>
                    {selectedConversation.group.city && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium">
                        <MapPin size={10} />
                        {selectedConversation.group.city}
                      </span>
                    )}
                  </div>
                </div>

                {/* Members list */}
                <div className="px-4 pt-3 pb-1 flex-none">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[13px] font-semibold text-slate-800">
                      Members ({membersCount})
                    </h4>
                    <button
                      onClick={() => {
                        if (page.setSidebarMode) page.setSidebarMode("TOOLS");
                        if (page.setGroupToolsMode) page.setGroupToolsMode("INVITE");
                        if (page.setInviteGroupId) page.setInviteGroupId(selectedConversation.group!.id);
                        if (page.setShowChatDetailsSidebar) page.setShowChatDetailsSidebar(false);
                        if (window.innerWidth < 1280 && page.setWorkspaceView) {
                          page.setWorkspaceView("DIRECTORY");
                        }
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-power-orange hover:opacity-80 transition"
                    >
                      <UserPlus size={13} /> Invite
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-3">
                  <GroupMembersList
                    groupId={selectedConversation.group.id}
                    onMemberClick={handleMemberClick}
                    onMembersCountChange={setMembersCount}
                  />
                </div>
              </div>
            )}

            {/* ── Action Buttons ── */}
            <div className="px-4 py-4 border-t border-slate-100 flex-none space-y-2">
              {/* Mute */}
              <button
                onClick={() =>
                  handleToggleMuteConversation(selectedConversation.id)
                }
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                {isMuted ? (
                  <>
                    <Bell size={16} className="text-slate-500" />
                    Unmute Notifications
                  </>
                ) : (
                  <>
                    <BellOff size={16} className="text-slate-500" />
                    Mute Notifications
                  </>
                )}
              </button>

              {/* Group-specific: Leave */}
              {isGroup && (
                <button
                  onClick={() =>
                    selectedConversation.group &&
                    void handleLeaveGroup(selectedConversation.group.id)
                  }
                  disabled={
                    isLeavingGroupId === selectedConversation.group?.id
                  }
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                >
                  <LogOut size={16} />
                  Leave Group
                </button>
              )}

              {/* DM-specific: Block */}
              {!isGroup && (
                <button
                  onClick={() => void handleToggleConversationBlock()}
                  disabled={isTogglingBlockUser}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                >
                  <Ban size={16} />
                  {isTogglingBlockUser
                    ? "Please wait…"
                    : isBlocked
                    ? "Unblock User"
                    : "Block User"}
                </button>
              )}

              {/* Report */}
              <button
                onClick={() =>
                  handleOpenReportModal(
                    isGroup ? "GROUP" : "MESSAGE",
                    isGroup
                      ? selectedConversation.group?.id || selectedConversation.id
                      : selectedConversation.id,
                  )
                }
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-600 hover:bg-rose-50 transition"
              >
                <Flag size={16} />
                Report
              </button>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}
