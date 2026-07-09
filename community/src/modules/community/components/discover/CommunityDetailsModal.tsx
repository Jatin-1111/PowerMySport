"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CommunityGroupSummary } from "@/modules/community/types";
import {
  X,
  Users,
  MapPin,
  Target,
  Shield,
  LogIn,
  MessageSquare,
} from "lucide-react";

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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-[201] w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-900/5">
              {/* Header / Hero Banner */}
              <div className="relative h-32 bg-orange-50 overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-black/40"
                >
                  <X size={16} />
                </button>
                {community.isAdmin && onEdit && onDelete && (
                  <div className="absolute right-14 top-4 z-10 flex gap-2">
                    <button
                      onClick={() => onEdit(community)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-black/40"
                      title="Edit Community"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                    </button>
                    <button
                      onClick={() => onDelete(community.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-red-500/80"
                      title="Delete Community"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Profile Avatar Overlap */}
              <div className="relative px-6 pb-6 pt-0 sm:px-8">
                <div className="absolute -top-12 left-6 flex h-24 w-24 items-center justify-center rounded-[1.5rem] border-4 border-white bg-orange-100 font-title text-4xl font-bold text-power-orange/60 shadow-sm sm:left-8">
                  {community.name.charAt(0).toUpperCase()}
                </div>

                <div className="mt-14 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-title text-2xl font-bold tracking-tight text-slate-900">
                      {community.name}
                    </h2>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        <Shield size={12} />
                        {community.audience === "PLAYERS_ONLY"
                          ? "Players Only"
                          : community.audience === "COACHES_ONLY"
                            ? "Coaches Only"
                            : "Public"}
                      </span>
                      {community.isMember && (
                        <span className="inline-flex shrink-0 items-center rounded-md bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white uppercase tracking-wide">
                          Member
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* About & Stats */}
                <div className="mt-6 space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      About
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                      {community.description || "No description provided."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-500">
                        <Users size={14} />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                          Members
                        </p>
                        <p className="font-semibold text-slate-900 text-sm">
                          {community.memberCount}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                        <Target size={14} />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                          Sport
                        </p>
                        <p className="font-semibold text-slate-900 text-sm truncate max-w-[80px]">
                          {community.sport || "Any"}
                        </p>
                      </div>
                    </div>

                    {community.city && (
                      <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3 col-span-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                          <MapPin size={14} />
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                            Location
                          </p>
                          <p className="font-semibold text-slate-900 text-sm">
                            {community.city}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:px-8 sm:py-5">
                {community.isMember ? (
                  <button
                    onClick={() => {
                      onChat(community.id);
                      onClose();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-power-orange/90 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-power-orange"
                  >
                    <MessageSquare size={16} /> Open Chat
                  </button>
                ) : (
                  <button
                    onClick={() => onJoin(community.id)}
                    disabled={isJoining}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-power-orange/90 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-power-orange disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <LogIn size={16} />{" "}
                    {isJoining ? "Joining..." : "Join Community"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
