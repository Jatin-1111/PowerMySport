"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shield, ChevronLeft } from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import {
  BlockedUser,
  CommunityProfile,
  CommunityUserSearchResult,
  MessagePrivacy,
} from "@/modules/community/types";
import { toast } from "@/lib/toast";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";

const privacyOptions: Array<{ value: MessagePrivacy; label: string }> = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "REQUEST_ONLY", label: "Request only" },
  { value: "NONE", label: "Nobody" },
];

export default function PrivacyPage() {
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [aliasDraft, setAliasDraft] = useState("");
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockSearch, setBlockSearch] = useState("");
  const [searchResults, setSearchResults] = useState<
    CommunityUserSearchResult[]
  >([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isLoadingBlockedUsers, setIsLoadingBlockedUsers] = useState(false);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAlias, setIsSavingAlias] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const session = await communityService.ensureSession();
        if (!isCommunityEligibleRole(session.role)) {
          redirectToMainLogin();
          return;
        }
        const data = await communityService.getProfile();
        setProfile(data);
        setAliasDraft(data.anonymousAlias || "");
        setIsLoadingBlockedUsers(true);
        const blocked = await communityService.getBlockedUsers();
        setBlockedUsers(blocked);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load privacy settings",
        );
      } finally {
        setIsLoadingBlockedUsers(false);
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const updateProfile = async (payload: {
    isIdentityPublic?: boolean;
    messagePrivacy?: MessagePrivacy;
    readReceiptsEnabled?: boolean;
    lastSeenVisible?: boolean;
    anonymousAlias?: string;
  }) => {
    if (!profile) return;

    const previous = profile;
    setProfile({ ...previous, ...payload });
    try {
      const updated = await communityService.updateProfile(payload);
      setProfile(updated);
    } catch (error) {
      setProfile(previous);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update privacy settings",
      );
    }
  };

  const saveAlias = async () => {
    const trimmed = aliasDraft.trim();
    if (!trimmed || trimmed === profile?.anonymousAlias) return;

    setIsSavingAlias(true);
    try {
      await updateProfile({ anonymousAlias: trimmed });
      toast.success("Alias updated");
    } finally {
      setIsSavingAlias(false);
    }
  };

  useEffect(() => {
    const trimmed = blockSearch.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    const timeout = setTimeout(() => {
      const search = async () => {
        try {
          setIsSearchingUsers(true);
          const results = await communityService.searchCommunityUsers(trimmed);
          setSearchResults(results);
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Failed to search users",
          );
        } finally {
          setIsSearchingUsers(false);
        }
      };

      void search();
    }, 250);

    return () => clearTimeout(timeout);
  }, [blockSearch]);

  const isUserBlocked = (userId: string) =>
    blockedUsers.some((user) => user.id === userId);

  const handleBlockUser = async (targetUserId: string) => {
    if (isUserBlocked(targetUserId)) {
      return;
    }

    setBlockingUserId(targetUserId);
    try {
      await communityService.blockUser(targetUserId);
      const updatedBlockedUsers = await communityService.getBlockedUsers();
      setBlockedUsers(updatedBlockedUsers);
      toast.success("User blocked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to block");
    } finally {
      setBlockingUserId(null);
    }
  };

  const handleUnblockUser = async (targetUserId: string) => {
    setUnblockingUserId(targetUserId);
    try {
      await communityService.unblockUser(targetUserId);
      setBlockedUsers((current) =>
        current.filter((user) => user.id !== targetUserId),
      );
      toast.success("User unblocked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unblock");
    } finally {
      setUnblockingUserId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="community-page-shell">
        <div className="community-content-wrap-narrow rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-6">
          <div className="h-6 w-44 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-28 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap-narrow space-y-4">
        <Link href="/" className="community-back-link">
          <ChevronLeft size={14} />
          Back to Community
        </Link>

        <section className="community-card">
          <div className="flex items-center gap-2">
            <Shield size={17} className="text-slate-600" />
            <h1 className="community-section-title">Privacy Settings</h1>
          </div>
          <p className="community-section-copy">
            Configure your identity and messaging preferences.
          </p>

          <div className="mt-5 space-y-4 sm:space-y-5">
            <label className="block text-sm sm:text-base">
              <span className="mb-1 block text-slate-500">Anonymous alias</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={aliasDraft}
                  onChange={(event) => setAliasDraft(event.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm shadow-xs focus:border-power-orange focus:outline-none"
                />
                <button
                  onClick={() => void saveAlias()}
                  disabled={isSavingAlias || !aliasDraft.trim()}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-power-orange px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 sm:min-w-28"
                >
                  {isSavingAlias ? "Saving" : "Save"}
                </button>
              </div>
            </label>

            <label className="flex items-center justify-between gap-3 text-sm sm:text-base">
              <span className="text-slate-500">Show my real identity</span>
              <input
                type="checkbox"
                checked={profile?.isIdentityPublic || false}
                onChange={(event) =>
                  void updateProfile({ isIdentityPublic: event.target.checked })
                }
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm sm:text-base">
              <span className="text-slate-500">Read receipts</span>
              <input
                type="checkbox"
                checked={profile?.readReceiptsEnabled || false}
                onChange={(event) =>
                  void updateProfile({
                    readReceiptsEnabled: event.target.checked,
                  })
                }
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm sm:text-base">
              <span className="text-slate-500">Show last seen</span>
              <input
                type="checkbox"
                checked={profile?.lastSeenVisible || false}
                onChange={(event) =>
                  void updateProfile({ lastSeenVisible: event.target.checked })
                }
              />
            </label>

            <label className="block text-sm sm:text-base">
              <span className="mb-1 block text-slate-500">
                Who can message me
              </span>
              <select
                className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm shadow-xs focus:border-power-orange focus:outline-none"
                value={profile?.messagePrivacy || "EVERYONE"}
                onChange={(event) =>
                  void updateProfile({
                    messagePrivacy: event.target.value as MessagePrivacy,
                  })
                }
              >
                {privacyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="community-card">
          <h2 className="text-base font-semibold text-slate-900">
            Blocked Users
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Blocked users cannot start conversations with you.
          </p>

          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-500">Block a user</span>
              <input
                value={blockSearch}
                onChange={(event) => setBlockSearch(event.target.value)}
                placeholder="Search users by name"
                className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm shadow-xs focus:border-power-orange focus:outline-none"
              />
            </label>

            {isSearchingUsers && (
              <p className="text-xs text-slate-500">Searching users...</p>
            )}

            {!isSearchingUsers && blockSearch.trim().length >= 2 && (
              <div className="space-y-2 rounded-xl border border-border/70 bg-slate-50/70 p-3">
                {searchResults.length === 0 ? (
                  <p className="text-xs text-slate-500">No users found.</p>
                ) : (
                  searchResults.map((user) => {
                    const blocked = isUserBlocked(user.id);
                    const isBlocking = blockingUserId === user.id;

                    return (
                      <div
                        key={user.id}
                        className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-white px-3 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {user.displayName}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <p className="text-xs text-slate-500">
                              {user.isIdentityPublic
                                ? "Identity visible"
                                : "Anonymous profile"}
                            </p>
                            {user.role && (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                {user.role === "COACH" ? "Coach" : "Player"}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => void handleBlockUser(user.id)}
                          disabled={blocked || isBlocking}
                          className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-power-orange/40 px-3 py-2 text-xs font-medium text-power-orange transition hover:bg-power-orange/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {blocked
                            ? "Blocked"
                            : isBlocking
                              ? "Blocking"
                              : "Block"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="mt-5 space-y-2">
            <h3 className="text-sm font-medium text-slate-800">
              Current blocked list
            </h3>
            {isLoadingBlockedUsers ? (
              <p className="text-xs text-slate-500">Loading blocked users...</p>
            ) : blockedUsers.length === 0 ? (
              <p className="text-xs text-slate-500">No blocked users yet.</p>
            ) : (
              blockedUsers.map((user) => {
                const isUnblocking = unblockingUserId === user.id;
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-slate-50/70 px-3 py-2"
                  >
                    <p className="truncate text-sm text-slate-800">
                      {user.name}
                    </p>
                    <button
                      onClick={() => void handleUnblockUser(user.id)}
                      disabled={isUnblocking}
                      className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isUnblocking ? "Unblocking" : "Unblock"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
