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
import { formatLastSeen } from "@/modules/community/utils/chatUtils";

type Props = { page: CommunityPageViewModel };

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
    handleCloseMemberProfile,
    handleToggleConversationBlock,
    isTogglingBlockUser,
    selectedConversationIsBlocked,
    handleMessageSelectedMember,
  } = page;

  const [membersCount, setMembersCount] = useState(0);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const isViewingMember = !!selectedMemberProfile;
  const isGroup = selectedConversation?.conversationType === "GROUP" && !isViewingMember;
  const isMuted = selectedConversation
    ? mutedConversationIds.includes(selectedConversation.id)
    : false;

  // Use server-authoritative blocked state
  const isBlocked = !isGroup && selectedConversationIsBlocked;

  return (
    <>
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
              className="absolute inset-y-0 right-0 z-50 flex w-[92vw] max-w-sm flex-col overflow-y-auto border-l border-white/40 bg-white/95 shadow-[-8px_0_30px_rgba(0,0,0,0.06)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/85 xl:w-[340px] xl:max-w-none"
            >
              {/* Close button */}
              <div className="flex flex-none items-center justify-between px-4 pb-2 pt-4">
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
              <div className="flex flex-none flex-col items-center border-b border-slate-100 px-4 pb-5 pt-3">
                <button
                  onClick={() => {
                    const imgToEnlarge =
                      isViewingMember && selectedMemberProfile
                        ? selectedMemberProfile.photoUrl
                        : selectedConversationPhotoUrl;
                    if (imgToEnlarge) setEnlargedImage(imgToEnlarge);
                  }}
                  className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-2xl font-bold uppercase text-slate-600 shadow-lg ring-4 ring-white ${
                    (isViewingMember && selectedMemberProfile?.photoUrl) ||
                    selectedConversationPhotoUrl
                      ? "cursor-pointer transition hover:opacity-90"
                      : ""
                  }`}
                >
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
                </button>

                <h2 className="mt-3 text-center text-lg font-bold tracking-tight text-slate-900">
                  {isViewingMember && selectedMemberProfile
                    ? selectedMemberProfile.displayName
                    : selectedConversationDisplayName}
                </h2>

                {!isGroup && !isViewingMember && (
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    {selectedConversation.otherParticipant.isIdentityPublic
                      ? "Public profile"
                      : "Anonymous profile"}
                  </p>
                )}

                {isViewingMember && selectedMemberProfile && (
                  <div className="mt-2 flex w-full flex-col items-center">
                    <p className="text-[12px] text-slate-500">
                      {selectedMemberProfile.isIdentityPublic ? "Public profile" : "Alias only"}
                    </p>
                    <button
                      onClick={handleMessageSelectedMember}
                      className="bg-power-orange mt-3 flex w-full max-w-[200px] items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-95"
                    >
                      <MessageSquare size={16} />
                      Message
                    </button>
                  </div>
                )}

                {isGroup && !isViewingMember && selectedConversation.group && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Users size={13} className="text-slate-400" />
                    <span className="text-[13px] font-medium text-slate-600">
                      {selectedConversation.group.memberCount} members
                    </span>
                  </div>
                )}

                {/* Last seen for DM */}
                {!isGroup &&
                  !isViewingMember &&
                  selectedConversation.otherParticipant.lastSeenAt && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <Clock3 size={12} className="text-slate-400" />
                      <p className="capitalize-first text-sm text-slate-500">
                        {formatLastSeen(selectedConversation.otherParticipant.lastSeenAt)}
                      </p>
                    </div>
                  )}
              </div>

              {/* ── DM or Member Profile Details ── */}
              {(!isGroup || isViewingMember) && (
                <div className="flex-none space-y-3 border-b border-slate-100 px-4 py-4">
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
                <div className="flex min-h-0 flex-1 flex-col">
                  {/* Group info */}
                  <div className="flex-none border-b border-slate-100 px-4 py-3">
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
                  <div className="flex-none px-4 pb-1 pt-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-semibold text-slate-800">
                        Members ({membersCount})
                      </h4>
                      <button
                        onClick={() => {
                          if (page.setSidebarMode) page.setSidebarMode("TOOLS");
                          if (page.setGroupToolsMode) page.setGroupToolsMode("INVITE");
                          if (page.setInviteGroupId)
                            page.setInviteGroupId(selectedConversation.group!.id);
                          if (page.setShowChatDetailsSidebar) page.setShowChatDetailsSidebar(false);
                          if (window.innerWidth < 1280 && page.setWorkspaceView) {
                            page.setWorkspaceView("DIRECTORY");
                          }
                        }}
                        className="text-power-orange flex items-center gap-1 text-[11px] font-semibold transition hover:opacity-80"
                      >
                        <UserPlus size={13} /> Invite
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
                    <GroupMembersList
                      groupId={selectedConversation.group.id}
                      onMemberClick={handleMemberClick}
                      onMembersCountChange={setMembersCount}
                    />
                  </div>
                </div>
              )}

              {/* ── Action Buttons ── */}
              <div className="flex-none space-y-2 border-t border-slate-100 px-4 py-4">
                {/* Mute */}
                <button
                  onClick={() => handleToggleMuteConversation(selectedConversation.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50"
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
                    disabled={isLeavingGroupId === selectedConversation.group?.id}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
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
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
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
                        : selectedConversation.id
                    )
                  }
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  <Flag size={16} />
                  Report
                </button>
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>

      {/* Enlarged Image Modal */}
      <AnimatePresence>
        {enlargedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setEnlargedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative aspect-square w-full max-w-sm overflow-hidden rounded-full bg-white shadow-2xl sm:max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setEnlargedImage(null)}
                className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70"
              >
                <X size={20} />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enlargedImage}
                alt="Enlarged profile"
                className="h-full w-full object-cover"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
