"use client";

import { useEffect } from "react";
import { communityService } from "../services/community";
import { ChevronRight, Users, UserCircle2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useAsync } from "@/lib/hooks/useAsync";
import { getCommunitySocket } from "@/lib/realtime/socket";

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
  onMembersCountChange?: (count: number) => void;
}

export function GroupMembersList({
  groupId,
  onMemberClick,
  onMembersCountChange,
}: GroupMembersListProps) {
  const prefersReducedMotion = useReducedMotion();

  const { data, isLoading, error, execute } = useAsync(
    async (signal) => {
      const data = await communityService.getGroupMembers(groupId);
      return Array.isArray(data) ? data : [];
    },
    [groupId],
    { onError: () => {} },
  );

  const members = data ?? [];

  useEffect(() => {
    if (data) {
      onMembersCountChange?.(data.length);
    }
  }, [data, onMembersCountChange]);

  useEffect(() => {
    const socket = getCommunitySocket();
    if (!socket.connected) {
      socket.connect();
    }

    const handleUpdate = () => {
      void execute();
    };

    socket.emit("community:joinGroupRoom", groupId);
    socket.on("community:groupMembersUpdated", handleUpdate);

    return () => {
      socket.off("community:groupMembersUpdated", handleUpdate);
      socket.emit("community:leaveGroupRoom", groupId);
    };
  }, [groupId, execute]);

  if (isLoading) {
    return (
      <div className="py-2">
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
      className="py-2"
    >
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-3">
          <p className="text-sm text-red-700">
            {error.message || "Failed to load members"}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {members.length > 0 ? (
          members.map((member) => (
            <motion.button
              key={member.id}
              onClick={() => onMemberClick?.(member)}
              whileHover={
                prefersReducedMotion ? undefined : { backgroundColor: "rgba(248, 250, 252, 0.8)" }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors hover:bg-slate-50"
              aria-label={`View ${member.displayName} profile`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {member.photoUrl && member.isIdentityPublic ? (
                  <img
                    src={member.photoUrl}
                    alt={member.name}
                    className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-slate-100"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                    <UserCircle2 size={18} />
                  </div>
                )}
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[13px] font-semibold text-slate-900">
                    {member.displayName}
                  </div>
                  {!member.isIdentityPublic && member.alias && (
                    <div className="truncate text-[11px] text-slate-500">{member.alias}</div>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    member.isIdentityPublic
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : "bg-slate-50 text-slate-500 border border-slate-200"
                  }`}
                >
                  {member.isIdentityPublic ? "Public" : "Private"}
                </span>
                <ChevronRight size={14} className="text-slate-300" />
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
