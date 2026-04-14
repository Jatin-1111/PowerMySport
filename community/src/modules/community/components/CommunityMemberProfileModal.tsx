"use client";

import { CommunityMemberProfile } from "../types";
import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  MessageSquare,
  Shield,
  UserCircle2,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface CommunityMemberProfileModalProps {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  profile: CommunityMemberProfile | null;
  onClose: () => void;
  onMessage: () => void;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const formatDate = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return dateFormatter.format(date);
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return timeFormatter.format(date);
};

export function CommunityMemberProfileModal({
  isOpen,
  isLoading,
  error,
  profile,
  onClose,
  onMessage,
}: CommunityMemberProfileModalProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-60 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.section
            initial={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 0, y: 24, scale: 0.98 }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 18, scale: 0.98 }
            }
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-white shadow-2xl"
          >
            <div className="relative overflow-hidden border-b border-border bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.94))] px-5 py-5 text-white sm:px-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(233,115,22,0.18),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(26,163,88,0.12),transparent_36%)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                    Community member profile
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {profile?.displayName || "Member profile"}
                  </h3>
                  {profile && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                        {profile.role === "COACH" ? "Coach" : "Player"}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                        {profile.isIdentityPublic
                          ? "Public identity"
                          : "Private identity"}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/90 transition hover:bg-white/15"
                  aria-label="Close profile"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-5 sm:p-6">
              {isLoading ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 rounded-2xl border border-border bg-slate-50 p-4">
                    <div className="h-16 w-16 animate-pulse rounded-full bg-slate-200" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-200" />
                      <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-100" />
                      <div className="h-3 w-3/5 animate-pulse rounded-full bg-slate-100" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                  </div>
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
                  <p className="font-medium">Could not load profile</p>
                  <p className="mt-1 text-sm">{error}</p>
                </div>
              ) : profile ? (
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 rounded-2xl border border-border bg-slate-50 p-4 sm:flex-row sm:items-center">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white bg-white shadow-sm">
                      {profile.photoUrl ? (
                        <img
                          src={profile.photoUrl}
                          alt={profile.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserCircle2 size={34} className="text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold tracking-tight text-slate-900">
                          {profile.displayName}
                        </h4>
                        {profile.isIdentityPublic ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                            <BadgeCheck size={12} />
                            Visible name
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                            <Shield size={12} />
                            Alias only
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {profile.alias !== profile.displayName
                          ? `Known in community as ${profile.alias}`
                          : "Community profile details"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                        {profile.createdAt && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1">
                            <CalendarDays size={12} />
                            Joined {formatDate(profile.createdAt)}
                          </span>
                        )}
                        {profile.lastActiveAt && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1">
                            <Clock3 size={12} />
                            Active {formatDateTime(profile.lastActiveAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={onMessage}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-power-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      <MessageSquare size={16} />
                      Message
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Role
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {profile.role === "COACH" ? "Coach" : "Player"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Privacy
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {profile.messagePrivacy === "NONE"
                          ? "No messages"
                          : profile.messagePrivacy === "REQUEST_ONLY"
                            ? "Message requests"
                            : "Open messages"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Read receipts
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {profile.readReceiptsEnabled ? "Enabled" : "Disabled"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Public sports
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {profile.sports.length ? (
                        profile.sports.map((sport) => (
                          <span
                            key={sport}
                            className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                          >
                            {sport}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">
                          No public sports listed.
                        </span>
                      )}
                    </div>
                  </div>

                  {profile.lastSeenVisible && profile.lastSeenAt && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Last seen at {formatDateTime(profile.lastSeenAt)}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
