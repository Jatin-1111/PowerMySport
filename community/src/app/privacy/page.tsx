"use client";

import { useEffect, useState } from "react";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
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
  const [searchResults, setSearchResults] = useState<CommunityUserSearchResult[]>([]);
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
          error instanceof Error ? error.message : "We could not load your privacy settings"
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
      toast.error(error instanceof Error ? error.message : "Failed to update privacy settings");
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
          toast.error(error instanceof Error ? error.message : "Failed to search users");
        } finally {
          setIsSearchingUsers(false);
        }
      };

      void search();
    }, 250);

    return () => clearTimeout(timeout);
  }, [blockSearch]);

  const isUserBlocked = (userId: string) => blockedUsers.some((user) => user.id === userId);

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
      setBlockedUsers((current) => current.filter((user) => user.id !== targetUserId));
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
        <div
          aria-busy="true"
          aria-label="Loading privacy settings"
          className="community-content-wrap-narrow space-y-4"
        >
          <div className="bg-ink/10 h-40 animate-pulse rounded-2xl" />
          <div className="bg-ink/10 mt-8 h-8 w-48 animate-pulse rounded-sm" />
          <div className="bg-ink/10 h-16 animate-pulse rounded-sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap-narrow">
        <CommunityPageHeader
          title="Privacy settings"
          subtitle="Choose how you appear to other parents and who can message you."
          badge="Your account"
        />

        <div className="mt-12 space-y-16">
          <section aria-labelledby="privacy-identity">
            <h2 id="privacy-identity" className="font-editorial text-ink text-3xl font-light">
              Identity and messages
            </h2>

            <div className="border-hairline mt-4 border-t py-6">
              <label htmlFor="privacy-alias" className="text-ink block text-lg font-semibold">
                Anonymous alias
              </label>
              <p className="text-ink-body mt-1 text-base">
                The name other parents see when you post anonymously.
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  id="privacy-alias"
                  value={aliasDraft}
                  onChange={(event) => setAliasDraft(event.target.value)}
                  className="text-ink hover:border-ink/45 focus:border-ink h-12 w-full rounded-md border border-[#d9d3c8] bg-white px-4 text-base transition-colors duration-200 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void saveAlias()}
                  disabled={isSavingAlias || !aliasDraft.trim()}
                  className="btn-motion bg-power-orange-solid inline-flex min-h-12 items-center justify-center rounded-md px-7 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 sm:min-w-28"
                >
                  {isSavingAlias ? "Saving" : "Save"}
                </button>
              </div>
            </div>

            <SettingSwitch
              label="Show my real identity"
              description="Other parents see your name and photo instead of your alias."
              checked={profile?.isIdentityPublic || false}
              onChange={(value) => void updateProfile({ isIdentityPublic: value })}
            />
            <SettingSwitch
              label="Read receipts"
              description="People you message can see when you have read their message."
              checked={profile?.readReceiptsEnabled || false}
              onChange={(value) => void updateProfile({ readReceiptsEnabled: value })}
            />
            <SettingSwitch
              label="Show when I was last online"
              description="Shown at the top of a conversation with you."
              checked={profile?.lastSeenVisible || false}
              onChange={(value) => void updateProfile({ lastSeenVisible: value })}
            />

            <div className="border-hairline border-y py-6">
              <label htmlFor="privacy-message" className="text-ink block text-lg font-semibold">
                Who can message me
              </label>
              <select
                id="privacy-message"
                className="text-ink hover:border-ink/45 focus:border-ink mt-3 h-12 w-full rounded-md border border-[#d9d3c8] bg-white px-4 text-base transition-colors duration-200 focus:outline-none sm:max-w-xs"
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
            </div>
          </section>

          <section aria-labelledby="privacy-blocked">
            <h2 id="privacy-blocked" className="font-editorial text-ink text-3xl font-light">
              Blocked users
            </h2>
            <p className="text-ink-body mt-2 text-base">
              Blocked users cannot start conversations with you.
            </p>

            <div className="mt-6">
              <label
                htmlFor="privacy-block-search"
                className="text-ink block text-lg font-semibold"
              >
                Block someone
              </label>
              <input
                id="privacy-block-search"
                value={blockSearch}
                onChange={(event) => setBlockSearch(event.target.value)}
                placeholder="Search users by name"
                className="text-ink placeholder:text-ink-muted hover:border-ink/45 focus:border-ink mt-3 h-12 w-full rounded-md border border-[#d9d3c8] bg-white px-4 text-base transition-colors duration-200 focus:outline-none"
              />

              {isSearchingUsers && <p className="text-ink-muted mt-3 text-sm">Searching</p>}

              {!isSearchingUsers && blockSearch.trim().length >= 2 && (
                <ul className="border-hairline mt-3 border-t">
                  {searchResults.length === 0 ? (
                    <li className="border-hairline text-ink-body border-b py-4 text-base">
                      No users found.
                    </li>
                  ) : (
                    searchResults.map((user) => {
                      const blocked = isUserBlocked(user.id);
                      const isBlocking = blockingUserId === user.id;

                      return (
                        <li
                          key={user.id}
                          className="border-hairline flex flex-wrap items-center justify-between gap-3 border-b py-4"
                        >
                          <div className="min-w-0">
                            <p className="text-ink truncate text-lg font-medium">
                              {user.displayName}
                            </p>
                            <p className="text-ink-muted text-sm">
                              {user.isIdentityPublic ? "Identity visible" : "Anonymous profile"}
                              {user.role ? ` · ${user.role === "Coach" ? "Coach" : "Player"}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleBlockUser(user.id)}
                            disabled={blocked || isBlocking}
                            className="btn-motion border-ink text-ink hover:bg-ink inline-flex min-h-11 items-center rounded-md border px-5 text-base font-semibold hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {blocked ? "Blocked" : isBlocking ? "Blocking" : "Block"}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </div>

            <h3 className="font-editorial text-ink mt-10 text-2xl font-normal">
              Your blocked list
            </h3>
            <ul className="border-hairline mt-3 border-t">
              {isLoadingBlockedUsers ? (
                <li className="border-hairline text-ink-muted border-b py-4 text-base">Loading</li>
              ) : blockedUsers.length === 0 ? (
                <li className="border-hairline text-ink-body border-b py-4 text-base">
                  You have not blocked anyone.
                </li>
              ) : (
                blockedUsers.map((user) => {
                  const isUnblocking = unblockingUserId === user.id;
                  return (
                    <li
                      key={user.id}
                      className="border-hairline flex items-center justify-between gap-3 border-b py-4"
                    >
                      <p className="text-ink truncate text-lg font-medium">{user.name}</p>
                      <button
                        type="button"
                        onClick={() => void handleUnblockUser(user.id)}
                        disabled={isUnblocking}
                        className="text-ink decoration-ink/30 hover:decoration-ink min-h-11 text-base font-semibold underline underline-offset-4 transition-colors duration-200 disabled:opacity-50"
                      >
                        {isUnblocking ? "Unblocking" : "Unblock"}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

/** A labelled on/off setting as a ruled row with a square switch. */
function SettingSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="border-hairline flex cursor-pointer items-start justify-between gap-6 border-t py-6">
      <span>
        <span className="text-ink block text-lg font-semibold">{label}</span>
        <span className="text-ink-body mt-1 block text-base">{description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`peer-focus-visible:outline-ink relative mt-1 h-6 w-11 shrink-0 rounded-md transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${
          checked ? "bg-ink" : "bg-[#cfc8bc]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-[4px] bg-white transition-transform duration-200 ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
  );
}
