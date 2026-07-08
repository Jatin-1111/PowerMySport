"use client";

import { AnimatePresence } from "framer-motion";
import { CommunityMemberProfileModal } from "@/modules/community/components/CommunityMemberProfileModal";
import { MobileMessageActions } from "@/modules/community/components/chat/MobileMessageActions";
import { ReportModal } from "@/modules/community/components/chat/ReportModal";
import { ChatAddModal } from "./ChatAddModal";
import { BlockedUsersModal } from "./BlockedUsersModal";
import { DeleteMessageModal } from "@/modules/community/components/chat/DeleteMessageModal";
import { COMMUNITY_DIRECTORY_VIEW_KEY, resolveSidebarQueryState } from "@/modules/community/constants/communityPage";
import { useSearchParams } from "next/navigation";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";

type Props = { page: CommunityPageViewModel };

export default function CommunityPageModals({ page }: Props) {
  const searchParams = useSearchParams();
  const urlDirectoryView = searchParams.get("directory")?.toUpperCase();
  const directoryView = urlDirectoryView === "GROUPS" ? "GROUPS" : "CONTACTS";
  const {
    isMemberProfileOpen,
    isLoadingMemberProfile,
    memberProfileError,
    selectedMemberProfile,
    handleCloseMemberProfile,
    handleMessageSelectedMember,
    mobileActionMessage,
    profile,
    setMobileActionMessageId,
    handleCopyMessage,
    retryFailedMessage,
    handleBeginEditMessage,
    handleDeleteMessage,
    reportModal,
    setReportModal,
    isSubmittingReport,
    handleSubmitReportWrapper,
    showAddChatModal,
    setShowAddChatModal,
    showBlockedUsersModal,
    setShowBlockedUsersModal,
    blockedUserIds,
    toggleBlockUserLocal,
    messageToDelete,
    setMessageToDelete,
    confirmDeleteMessage,
    isMutatingMessageId,
  } = page;

  return (
    <>
      <CommunityMemberProfileModal
        isOpen={isMemberProfileOpen && !page.selectedConversation}
        isLoading={isLoadingMemberProfile}
        error={memberProfileError}
        profile={selectedMemberProfile}
        onClose={handleCloseMemberProfile}
        onMessage={handleMessageSelectedMember}
      />

      <AnimatePresence>
        {mobileActionMessage && (
          <MobileMessageActions
            message={mobileActionMessage}
            profileUserId={profile?.userId}
            onClose={() => setMobileActionMessageId(null)}
            onCopy={handleCopyMessage}
            onRetry={retryFailedMessage}
            onEdit={handleBeginEditMessage}
            onDelete={handleDeleteMessage}
            onMarkUnread={() => {
              if (mobileActionMessage.conversationId) {
                page.handleMarkConversationAsUnread(mobileActionMessage.conversationId);
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reportModal && (
          <ReportModal
            targetType={reportModal.targetType}
            targetId={reportModal.targetId}
            isSubmitting={isSubmittingReport}
            onClose={() => setReportModal(null)}
            onSubmit={handleSubmitReportWrapper}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {messageToDelete && (
          <DeleteMessageModal
            isDeleting={isMutatingMessageId === messageToDelete.id}
            onClose={() => setMessageToDelete(null)}
            onConfirm={confirmDeleteMessage}
          />
        )}
      </AnimatePresence>

      <ChatAddModal
        isOpen={showAddChatModal}
        onClose={() => setShowAddChatModal(false)}
        mode={directoryView}
        page={page}
      />

      <BlockedUsersModal
        isOpen={showBlockedUsersModal}
        onClose={() => setShowBlockedUsersModal(false)}
        blockedUserIds={blockedUserIds}
        onUnblock={toggleBlockUserLocal}
      />
    </>
  );
}
