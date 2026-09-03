"use client";

import { useCallback, useRef, useState } from "react";
import type { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { communityService } from "@/modules/community/services/community";
import { CommunityMemberProfile } from "@/modules/community/types";
import { GroupMember } from "@/modules/community/components/GroupMembersList";

export function useMemberProfile(
  router: ReturnType<typeof useRouter>,
  handleStartConversation: (targetUserId: string) => Promise<void>,
  setShowChatDetailsSidebar: (value: boolean) => void
) {
  const memberProfileRequestIdRef = useRef<string | null>(null);
  const [isMemberProfileOpen, setIsMemberProfileOpen] = useState(false);
  const [isLoadingMemberProfile, setIsLoadingMemberProfile] = useState(false);
  const [memberProfileError, setMemberProfileError] = useState<string | null>(null);
  const [selectedMemberProfile, setSelectedMemberProfile] = useState<CommunityMemberProfile | null>(
    null
  );

  const resetMemberProfile = useCallback(() => {
    memberProfileRequestIdRef.current = null;
    setIsMemberProfileOpen(false);
    setIsLoadingMemberProfile(false);
    setMemberProfileError(null);
    setSelectedMemberProfile(null);
  }, []);

  const handleCloseMemberProfile = useCallback(() => {
    resetMemberProfile();
  }, [resetMemberProfile]);

  const handleOpenMemberProfile = useCallback(
    async (memberId: string) => {
      memberProfileRequestIdRef.current = memberId;
      setIsMemberProfileOpen(true);
      setShowChatDetailsSidebar(true);
      setIsLoadingMemberProfile(true);
      setMemberProfileError(null);
      setSelectedMemberProfile(null);

      try {
        const profileData = await communityService.getPlayerProfile(memberId);
        if (memberProfileRequestIdRef.current === memberId) setSelectedMemberProfile(profileData);
      } catch (e) {
        if (memberProfileRequestIdRef.current === memberId) {
          setMemberProfileError(e instanceof Error ? e.message : "Failed to load profile");
          toast.error(e instanceof Error ? e.message : "Failed to load profile");
        }
      } finally {
        if (memberProfileRequestIdRef.current === memberId) setIsLoadingMemberProfile(false);
      }
    },
    [setShowChatDetailsSidebar]
  );

  const handleMemberClick = (member: GroupMember) => router.push(`/members/${member.id}`);

  const handleMessageSelectedMember = useCallback(() => {
    if (!selectedMemberProfile) return;
    handleCloseMemberProfile();
    void handleStartConversation(selectedMemberProfile.id);
  }, [handleCloseMemberProfile, handleStartConversation, selectedMemberProfile]);

  return {
    isMemberProfileOpen,
    isLoadingMemberProfile,
    memberProfileError,
    selectedMemberProfile,
    resetMemberProfile,
    handleCloseMemberProfile,
    handleOpenMemberProfile,
    handleMemberClick,
    handleMessageSelectedMember,
  };
}
