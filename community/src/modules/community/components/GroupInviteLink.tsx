"use client";

import { useCallback, useMemo, useState } from "react";
import { communityService } from "../services/community";
import { Copy, Check, Share2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { motion, useReducedMotion } from "framer-motion";

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
  const prefersReducedMotion = useReducedMotion();
  const canUseNativeShare = useMemo(
    () => typeof window !== "undefined" && "share" in navigator,
    [],
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
        toast.success("Invite link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
        return true;
      } catch {
        toast.error(
          "Invite link generated, but automatic copy was blocked. Use the Copy Link button.",
        );
        return false;
      }
    },
    [buildInviteLink],
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
        error instanceof Error ? error.message : "Failed to load invite code";
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
    const text = `Join the "${groupName}" community group!`;

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
  }, [
    buildInviteLink,
    canUseNativeShare,
    copyInviteLink,
    groupName,
    inviteCode,
    loadInviteCode,
  ]);

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur"
    >
      <div className="flex items-center gap-2">
        <Share2 size={16} className="text-slate-600" />
        <h3 className="text-base font-semibold tracking-tight">
          Invite Members
        </h3>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Share this link to invite others to join the group
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50/80 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!inviteCode && !error && (
        <button
          onClick={() => void loadInviteCode()}
          disabled={isLoading}
          className="mt-4 w-full rounded-lg border border-border bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
        >
          {isLoading ? "Loading..." : "Generate Invite Link"}
        </button>
      )}

      {inviteCode && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <code className="flex-1 break-all text-sm text-slate-600">
              {buildInviteLink(inviteCode)}
            </code>
            <button
              onClick={() => void copyToClipboard()}
              className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
              title={copied ? "Copied!" : "Copy invite link"}
            >
              {copied ? (
                <Check size={16} className="text-turf-green" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void copyToClipboard()}
              className="flex-1 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            >
              <Copy size={14} className="mr-2 inline" />
              Copy Link
            </button>
            {canUseNativeShare && (
              <button
                onClick={() => void openShareDialog()}
                className="flex-1 rounded-xl bg-power-orange px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
              >
                <Share2 size={14} className="mr-2 inline" />
                Share
              </button>
            )}
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3">
            <p className="text-xs text-blue-700">
              ℹ️ Share this link with anyone to let them join the group
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
