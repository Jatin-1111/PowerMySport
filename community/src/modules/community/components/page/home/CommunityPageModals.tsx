"use client";

import { AnimatePresence } from "framer-motion";
import { CommunityMemberProfileModal } from "@/modules/community/components/CommunityMemberProfileModal";
import { MobileMessageActions } from "@/modules/community/components/chat/MobileMessageActions";
import { ReportModal } from "@/modules/community/components/chat/ReportModal";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";

type Props = { page: CommunityPageViewModel };

export default function CommunityPageModals({ page }: Props) {
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
  } = page;

  return (
    <>
      <CommunityMemberProfileModal
        isOpen={isMemberProfileOpen}
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
    </>
  );
}
