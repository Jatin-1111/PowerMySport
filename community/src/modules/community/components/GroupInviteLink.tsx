"use client";

import { useCallback, useMemo, useState } from "react";
import { communityService } from "../services/community";
import { Copy, Check, Share2 } from "lucide-react";
import { toast } from "@/lib/toast";

interface GroupInviteLinkProps {
  groupId: string;
  groupName: string;
}

const isValidInviteCode = (value: unknown): value is string => {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value !== "undefined" &&
    value !== "null"
  );
};

export function GroupInviteLink({ groupId, groupName }: GroupInviteLinkProps) {
  const canUseNativeShare = useMemo(
    () => typeof window !== "undefined" && "share" in navigator,
    []
  );
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const buildInviteLink = useCallback((code: string) => {
    return `${window.location.origin}/community/join/${encodeURIComponent(code)}`;
  }, []);

  const copyInviteLink = useCallback(
    async (code: string) => {
      const inviteLink = buildInviteLink(code);

      try {
        await navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        toast.success("Invite link copied");
        setTimeout(() => setCopied(false), 2000);
        return true;
      } catch {
        toast.error("We could not copy the link. Select it and copy it by hand.");
        return false;
      }
    },
    [buildInviteLink]
  );

  const loadInviteCode = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await communityService.getGroupInviteCode(groupId);
      if (!isValidInviteCode(data.inviteCode)) {
        throw new Error("Invite code was not returned by the server");
      }

      setInviteCode(data.inviteCode);
      void copyInviteLink(data.inviteCode);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "We could not create the invite link";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [copyInviteLink, groupId]);

  const copyToClipboard = useCallback(async () => {
    if (!isValidInviteCode(inviteCode)) return;

    await copyInviteLink(inviteCode);
  }, [copyInviteLink, inviteCode]);

  const openShareDialog = useCallback(async () => {
    if (!isValidInviteCode(inviteCode)) {
      await loadInviteCode();
      return;
    }

    const inviteLink = buildInviteLink(inviteCode);
    const title = `Join ${groupName} on PowerMySport Community`;
    const text = `Join the "${groupName}" community group.`;

    if (canUseNativeShare) {
      try {
        await navigator.share({
          title,
          text,
          url: inviteLink,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      await copyInviteLink(inviteCode);
    }
  }, [buildInviteLink, canUseNativeShare, copyInviteLink, groupName, inviteCode, loadInviteCode]);

  const link =
    "text-ink decoration-ink/30 hover:decoration-ink inline-flex min-h-11 items-center gap-2 text-base font-semibold underline underline-offset-4 transition-colors duration-200";

  return (
    <section aria-labelledby="invite-title" className="bg-paper-deep rounded-2xl p-6">
      <h3 id="invite-title" className="font-editorial text-ink text-2xl font-normal">
        Invite members
      </h3>
      <p className="text-ink-body mt-1 text-base leading-relaxed">
        Anyone with this link can join the group.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-700/30 bg-red-50 px-4 py-3 text-base text-red-800"
        >
          {error}
        </p>
      )}

      {!inviteCode && !error && (
        <button
          type="button"
          onClick={() => void loadInviteCode()}
          disabled={isLoading}
          className="btn-motion border-ink text-ink hover:bg-ink mt-4 inline-flex min-h-11 items-center rounded-md border px-5 text-base font-semibold hover:text-white disabled:opacity-60"
        >
          {isLoading ? "Creating link" : "Create invite link"}
        </button>
      )}

      {inviteCode && (
        <div className="mt-4">
          <code className="text-ink-body block break-all rounded-md border border-[#d9d3c8] bg-white px-4 py-3 text-sm">
            {buildInviteLink(inviteCode)}
          </code>
          <div className="mt-3 flex flex-wrap items-center gap-x-6">
            <button type="button" onClick={() => void copyToClipboard()} className={link}>
              {copied ? (
                <Check size={16} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Copy size={16} strokeWidth={1.5} aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy link"}
            </button>
            {canUseNativeShare && (
              <button type="button" onClick={() => void openShareDialog()} className={link}>
                <Share2 size={16} strokeWidth={1.5} aria-hidden="true" />
                Share
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
