"use client";

import { useCallback, useEffect, useState } from "react";
import { communityService } from "../services/community";
import { Users, UserCircle2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export interface GroupMember {
  id: string;
  name: string;
  displayName: string;
  photoUrl?: string | null;
  isIdentityPublic: boolean;
  alias: string;
}

interface GroupMembersListProps {
  groupId: string;
  onMemberClick?: (member: GroupMember) => void;
}

export function GroupMembersList({
  groupId,
  onMemberClick,
}: GroupMembersListProps) {
  const prefersReducedMotion = useReducedMotion();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await communityService.getGroupMembers(groupId);
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      const message = "Failed to load members";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  if (isLoading) {
    return (
      <div className="rounded-[1.5rem] border border-border/80 bg-white/90 p-5 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.4)]">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-slate-600" />
          <h3 className="text-base font-semibold tracking-tight">
            Group Members
          </h3>
        </div>
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl bg-slate-100/90"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-[1.5rem] border border-border/80 bg-white/90 p-5 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.4)] backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-slate-600" />
          <h3 className="text-base font-semibold tracking-tight">
            Group Members
          </h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {members.length}
          </span>
        </div>
        <button
          onClick={() => void loadMembers()}
          disabled={isLoading}
          className="text-xs font-medium text-slate-500 transition hover:text-slate-700 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <p className="mt-1 text-sm text-slate-500">
        All members in this community group
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50/80 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {members.length > 0 ? (
          members.map((member) => (
            <motion.button
              key={member.id}
              onClick={() => onMemberClick?.(member)}
              whileHover={
                prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
              className="w-full rounded-xl border border-border bg-white p-3 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-power-orange"
            >
              <div className="flex items-center gap-3">
                {member.photoUrl && member.isIdentityPublic ? (
                  <img
                    src={member.photoUrl}
                    alt={member.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                    <UserCircle2 size={20} className="text-slate-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900">
                    {member.displayName}
                  </div>
                  {!member.isIdentityPublic && member.alias && (
                    <div className="text-xs text-slate-500">{member.alias}</div>
                  )}
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    member.isIdentityPublic
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {member.isIdentityPublic ? "Public" : "Private"}
                </span>
              </div>
            </motion.button>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-slate-50/80 p-8 text-center">
            <Users size={32} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              No members yet
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
