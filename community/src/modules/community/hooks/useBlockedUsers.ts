"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { communityService } from "@/modules/community/services/community";
import { BlockedUser, CommunityProfile } from "@/modules/community/types";

export function useBlockedUsers(
  setProfile: React.Dispatch<React.SetStateAction<CommunityProfile | null>>
) {
  const [blockedUsersList, setBlockedUsersList] = useState<BlockedUser[]>([]);
  const [isLoadingBlockedUsers, setIsLoadingBlockedUsers] = useState(false);
  const [showBlockedUsersModal, setShowBlockedUsersModal] = useState(false);

  const loadBlockedUsers = useCallback(async () => {
    setIsLoadingBlockedUsers(true);
    try {
      const users = await communityService.getBlockedUsers();
      setBlockedUsersList(users);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load blocked users");
    } finally {
      setIsLoadingBlockedUsers(false);
    }
  }, []);

  const handleUnblockUserById = useCallback(
    async (targetUserId: string) => {
      try {
        await communityService.unblockUser(targetUserId);
        setBlockedUsersList((current) => current.filter((user) => user.id !== targetUserId));
        setProfile((current) =>
          current
            ? {
                ...current,
                blockedUsers: (current.blockedUsers || []).filter((id) => id !== targetUserId),
              }
            : current
        );
        toast.success("User unblocked");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to unblock user");
      }
    },
    [setProfile]
  );

  useEffect(() => {
    if (showBlockedUsersModal) {
      void loadBlockedUsers();
    }
  }, [showBlockedUsersModal, loadBlockedUsers]);

  return {
    blockedUsersList,
    isLoadingBlockedUsers,
    showBlockedUsersModal,
    setShowBlockedUsersModal,
    loadBlockedUsers,
    handleUnblockUserById,
  };
}
