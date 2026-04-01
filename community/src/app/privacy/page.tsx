"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shield, ChevronLeft } from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import { CommunityProfile, MessagePrivacy } from "@/modules/community/types";
import { toast } from "@/lib/toast";
import { redirectToMainLogin } from "@/lib/auth/redirect";

const privacyOptions: Array<{ value: MessagePrivacy; label: string }> = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "REQUEST_ONLY", label: "Request only" },
  { value: "NONE", label: "Nobody" },
];

export default function PrivacyPage() {
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [aliasDraft, setAliasDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAlias, setIsSavingAlias] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const session = await communityService.ensureSession();
        if (session.role !== "PLAYER") {
          redirectToMainLogin();
          return;
        }
        const data = await communityService.getProfile();
        setProfile(data);
        setAliasDraft(data.anonymousAlias || "");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load privacy settings",
        );
      } finally {
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

  if (isLoading) {
    return (
      <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="h-6 w-44 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-28 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ChevronLeft size={14} />
          Back to Community
        </Link>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Shield size={17} className="text-slate-600" />
            <h1 className="text-lg font-semibold text-slate-900">
              Privacy Settings
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Configure your identity and messaging preferences.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-500">Anonymous alias</span>
              <div className="flex gap-2">
                <input
                  value={aliasDraft}
                  onChange={(event) => setAliasDraft(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
                />
                <button
                  onClick={() => void saveAlias()}
                  disabled={isSavingAlias || !aliasDraft.trim()}
                  className="rounded-lg bg-power-orange px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {isSavingAlias ? "Saving" : "Save"}
                </button>
              </div>
            </label>

            <label className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Show my real identity</span>
              <input
                type="checkbox"
                checked={profile?.isIdentityPublic || false}
                onChange={(event) =>
                  void updateProfile({ isIdentityPublic: event.target.checked })
                }
              />
            </label>

            <label className="flex items-center justify-between text-sm">
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

            <label className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Show last seen</span>
              <input
                type="checkbox"
                checked={profile?.lastSeenVisible || false}
                onChange={(event) =>
                  void updateProfile({ lastSeenVisible: event.target.checked })
                }
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-500">
                Who can message me
              </span>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
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
      </div>
    </div>
  );
}
