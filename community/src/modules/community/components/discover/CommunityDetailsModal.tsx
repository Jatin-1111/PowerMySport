"use client";

import { CommunityGroupSummary } from "@/modules/community/types";
import { MessageSquare, LogIn, Pencil, Trash2 } from "lucide-react";
import CommunityDialog from "@/modules/community/components/CommunityDialog";

interface CommunityDetailsModalProps {
  community: CommunityGroupSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onJoin: (groupId: string) => void;
  onChat: (groupId: string) => void;
  isJoining: boolean;
  onDelete?: (groupId: string) => void;
  onEdit?: (community: CommunityGroupSummary) => void;
}

const iconBtn =
  "text-ink-body hover:bg-paper-deep hover:text-ink flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-200";

export default function CommunityDetailsModal({
  community,
  isOpen,
  onClose,
  onJoin,
  onChat,
  isJoining,
  onDelete,
  onEdit,
}: CommunityDetailsModalProps) {
  if (!isOpen || !community) return null;

  const facts = [
    { label: "Members", value: String(community.memberCount) },
    { label: "Sport", value: community.sport || "Any sport" },
    ...(community.city ? [{ label: "City", value: community.city }] : []),
  ];

  return (
    <CommunityDialog
      isOpen={isOpen}
      onClose={onClose}
      title={community.name}
      kicker={community.isMember ? "You are a member" : "Community"}
      headerActions={
        community.isAdmin && onEdit && onDelete ? (
          <>
            <button
              type="button"
              onClick={() => onEdit(community)}
              aria-label="Edit community"
              className={iconBtn}
            >
              <Pencil size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(community.id)}
              aria-label="Delete community"
              className={`${iconBtn} hover:text-red-700`}
            >
              <Trash2 size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </>
        ) : null
      }
      footer={
        community.isMember ? (
          <button
            type="button"
            onClick={() => {
              onChat(community.id);
              onClose();
            }}
            className="btn-motion bg-power-orange-solid flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700"
          >
            <MessageSquare size={16} aria-hidden="true" /> Open chat
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onJoin(community.id)}
            disabled={isJoining}
            className="btn-motion bg-ink hover:bg-ink-hover flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-6 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn size={16} aria-hidden="true" /> {isJoining ? "Joining" : "Join community"}
          </button>
        )
      }
    >
      {community.profilePicture ? (
        <img
          src={community.profilePicture}
          alt=""
          className="bg-paper-deep mb-6 aspect-[16/9] w-full rounded-2xl object-cover saturate-[0.85]"
        />
      ) : null}

      <p className="text-ink-body text-lg leading-relaxed">
        {community.description || "This community has no description yet."}
      </p>

      <dl className="border-hairline mt-6 border-t">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="border-hairline flex items-baseline justify-between gap-4 border-b py-3"
          >
            <dt className="text-ink-muted text-base">{fact.label}</dt>
            <dd className="text-ink text-base font-semibold tabular-nums">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </CommunityDialog>
  );
}
