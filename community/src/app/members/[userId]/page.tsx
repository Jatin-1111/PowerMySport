"use client";

import { toast } from "@/lib/toast";
import { communityService } from "@/modules/community/services/community";
import { CommunityMemberProfile } from "@/modules/community/types";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Clock3,
  MessageSquare,
  Shield,
  UserCircle2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const COMMUNITY_SELECTED_CONVERSATION_KEY = "community:selectedConversationId";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateFormatter.format(date);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateTimeFormatter.format(date);
};

const getLocalDateString = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
    -Math.max(1, Math.floor((Date.now() - date.getTime()) / 86400000)),
    "day",
  );
};

export default function MemberProfilePage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const userId = Array.isArray(params?.userId)
    ? params.userId[0]
    : params?.userId;

  const [profile, setProfile] = useState<CommunityMemberProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMessaging, setIsMessaging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      if (!userId) {
        setError("Missing member id");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const data = await communityService.getPlayerProfile(userId);
        if (!isActive) {
          return;
        }

        setProfile(data);
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load member profile";
        setError(message);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [userId]);

  const sports = useMemo(() => profile?.sports || [], [profile?.sports]);

  const handleStartConversation = async () => {
    if (!profile) {
      return;
    }

    setIsMessaging(true);
    try {
      const conversation = await communityService.startConversation(profile.id);
      window.localStorage.setItem(
        COMMUNITY_SELECTED_CONVERSATION_KEY,
        conversation.id,
      );
      toast.success("Conversation opened");
      router.push("/");
    } catch (messageError) {
      const message =
        messageError instanceof Error
          ? messageError.message
          : "Failed to start conversation";
      toast.error(message);
    } finally {
      setIsMessaging(false);
    }
  };

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative isolate flex min-h-[calc(100vh-72px)] w-full overflow-hidden bg-slate-50"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(219,234,254,0.9),transparent_38%),radial-gradient(circle_at_top_right,rgba(255,237,213,0.85),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,1))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-white/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-slate-100 to-transparent" />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
          >
            <ArrowLeft size={16} />
            Back to community
          </Link>
          <div className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:w-auto">
            Member profile
          </div>
        </div>

        <section className="relative overflow-hidden rounded-3xl border border-border bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.92))] p-5 text-white shadow-xl sm:rounded-4xl sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(233,115,22,0.2),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(26,163,88,0.12),transparent_35%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.6fr),minmax(280px,0.9fr)] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
                Community identity
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">
                {profile?.displayName ||
                  (isLoading ? "Loading profile" : "Member profile")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-200 sm:text-base">
                See a member’s public sports, privacy level, and activity
                context without exposing more than they chose to share.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {profile && (
                  <>
                    <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                      {profile.role === "COACH" ? "Coach" : "Player"}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                      {profile.isIdentityPublic
                        ? "Public identity"
                        : "Private identity"}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                      {profile.messagePrivacy === "NONE"
                        ? "Messaging off"
                        : profile.messagePrivacy === "REQUEST_ONLY"
                          ? "Message requests"
                          : "Open messages"}
                    </span>
                  </>
                )}
              </div>

              {error && (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/95 p-4 text-rose-700 shadow-sm">
                  <p className="font-medium">Could not load profile</p>
                  <p className="mt-1 text-sm">{error}</p>
                </div>
              )}
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-4 backdrop-blur-sm sm:p-5">
              {isLoading ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="h-16 w-16 animate-pulse rounded-full bg-white/10" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/10" />
                      <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/10" />
                      <div className="h-3 w-3/5 animate-pulse rounded-full bg-white/10" />
                    </div>
                  </div>
                  <div className="h-28 animate-pulse rounded-2xl bg-white/10" />
                </div>
              ) : profile ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-4 rounded-2xl bg-white/95 p-4 text-slate-900 shadow-sm sm:flex-row sm:items-center">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
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
                        <h2 className="text-lg font-semibold tracking-tight">
                          {profile.displayName}
                        </h2>
                        {profile.isIdentityPublic ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                            <BadgeCheck size={12} />
                            Visible
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
                          ? `Known as ${profile.alias}`
                          : "Community member"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => void handleStartConversation()}
                    disabled={isMessaging || profile.messagePrivacy === "NONE"}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-power-orange px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <MessageSquare size={16} />
                    {isMessaging ? "Opening..." : "Message member"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {profile && (
          <section className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Joined
              </p>
              <p className="mt-2 text-base font-semibold text-slate-900 sm:text-lg">
                {formatDate(profile.createdAt) || "Unavailable"}
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Last active
              </p>
              <p className="mt-2 text-base font-semibold text-slate-900 sm:text-lg">
                {profile.lastActiveAt
                  ? formatDateTime(profile.lastActiveAt)
                  : "Unavailable"}
              </p>
              {profile.lastActiveAt && (
                <p className="mt-1 text-sm text-slate-500">
                  {getLocalDateString(profile.lastActiveAt)}
                </p>
              )}
            </div>
            <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Read receipts
              </p>
              <p className="mt-2 text-base font-semibold text-slate-900 sm:text-lg">
                {profile.readReceiptsEnabled ? "Enabled" : "Disabled"}
              </p>
            </div>
          </section>
        )}

        {profile && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr),minmax(320px,0.8fr)]">
            <section className="rounded-4xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-power-orange">
                    Public sports
                  </p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                    Sports the member shares
                  </h3>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {sports.length ? (
                  sports.map((sport) => (
                    <span
                      key={sport}
                      className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
                    >
                      {sport}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No public sports listed.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-4xl border border-border bg-[linear-gradient(180deg,rgba(233,115,22,0.06),rgba(255,255,255,0.98))] p-6 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900">
                <Clock3 size={18} className="text-power-orange" />
                <h3 className="text-xl font-semibold tracking-tight">
                  Privacy summary
                </h3>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>
                  Identity visibility:{" "}
                  {profile.isIdentityPublic ? "public" : "private"}.
                </p>
                <p>
                  Messaging:{" "}
                  {profile.messagePrivacy === "NONE"
                    ? "disabled"
                    : profile.messagePrivacy === "REQUEST_ONLY"
                      ? "message requests only"
                      : "open to start a conversation"}
                  .
                </p>
                <p>
                  Last seen: {profile.lastSeenVisible ? "shared" : "hidden"}.
                </p>
              </div>
            </section>
          </div>
        )}
      </div>
    </motion.div>
  );
}
