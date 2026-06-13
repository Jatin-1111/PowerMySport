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
                prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
              className="w-full rounded-2xl border border-border bg-white p-3 text-left transition hover:border-power-orange/30 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-power-orange sm:p-3.5"
              aria-label={`View ${member.displayName} profile`}
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
                  <div className="text-sm font-semibold text-slate-900 sm:text-base">
                    {member.displayName}
                  </div>
                  {!member.isIdentityPublic && member.alias && (
                    <div className="text-xs text-slate-500">{member.alias}</div>
                  )}
                  <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Tap to view profile
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      member.isIdentityPublic
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {member.isIdentityPublic ? "Public" : "Private"}
                  </span>
                  <ChevronRight size={14} className="text-slate-300" />
                </div>
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
