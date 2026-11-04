"use client";

import { toast } from "@/lib/toast";
import { communityService } from "@/modules/community/services/community";
import ConnectRequestModal from "@/modules/community/components/ConnectRequestModal";
import {
  useConnectRequest,
  type StartedConversation,
} from "@/modules/community/hooks/useConnectRequest";
import { CommunityMemberProfile } from "@/modules/community/types";
import DependentSummaryList from "@/modules/community/components/DependentSummaryList";
import { ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
    "day"
  );
};

const calculateAgeFromDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const ageDate = new Date(Date.now() - date.getTime());
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

export default function MemberProfilePage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const userId = Array.isArray(params?.userId) ? params.userId[0] : params?.userId;

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

        const message = loadError instanceof Error ? loadError.message : "Please try again";
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
  const dependents = useMemo(() => profile?.dependents || [], [profile?.dependents]);
  const age = profile?.age ?? calculateAgeFromDate(profile?.dob);

  // Opens the chat once it exists: straight away for someone who accepts
  // messages from everyone, after the request's message is sent otherwise.
  const connect = useConnectRequest((conversation: StartedConversation) => {
    window.localStorage.setItem(COMMUNITY_SELECTED_CONVERSATION_KEY, conversation.id);
    toast.success(
      conversation.status === "PENDING" ? "Message request sent" : "Conversation opened"
    );
    router.push(`/chats?conversation=${conversation.id}`);
  });

  const handleStartConversation = async () => {
    if (!profile) {
      return;
    }

    setIsMessaging(true);
    try {
      await connect.start(profile.id, {
        name: profile.displayName,
        privacy: profile.messagePrivacy,
      });
    } catch (messageError) {
      const message =
        messageError instanceof Error
          ? messageError.message
          : "We could not start the conversation";
      toast.error(message);
    } finally {
      setIsMessaging(false);
    }
  };

  const messagingLabel =
    profile?.messagePrivacy === "NONE"
      ? "Messaging is off"
      : profile?.messagePrivacy === "REQUEST_ONLY"
        ? "Accepts message requests"
        : "Open to messages";

  const facts = profile
    ? [
        { label: "Joined", value: formatDate(profile.createdAt) || "Not shown" },
        {
          label: "Last active",
          value: profile.lastActiveAt
            ? `${formatDateTime(profile.lastActiveAt)} (${getLocalDateString(profile.lastActiveAt)})`
            : "Not shown",
        },
        { label: "Identity", value: profile.isIdentityPublic ? "Public" : "Alias only" },
        { label: "Messages", value: messagingLabel.replace("Messaging is off", "Off") },
        { label: "Last seen", value: profile.lastSeenVisible ? "Shared" : "Hidden" },
        { label: "Read receipts", value: profile.readReceiptsEnabled ? "On" : "Off" },
      ]
    : [];

  return (
    <div className="bg-paper min-h-[calc(100vh-72px)] w-full">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <Link
          href="/"
          className="text-ink-body hover:text-ink inline-flex min-h-11 items-center gap-1.5 text-base font-medium transition-colors duration-200"
        >
          <ArrowLeft size={18} strokeWidth={1.5} aria-hidden="true" />
          Back to community
        </Link>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-700/30 bg-red-50 px-4 py-3 text-base text-red-800"
          >
            <span className="font-semibold">We could not load this profile.</span> {error}
          </p>
        )}

        <header className="bg-paper-deep mt-4 rounded-3xl p-6 sm:p-10">
          {isLoading ? (
            <div aria-busy="true" aria-label="Loading profile" className="flex items-center gap-6">
              <div className="bg-ink/10 h-24 w-24 shrink-0 animate-pulse rounded-2xl" />
              <div className="flex-1 space-y-3">
                <div className="bg-ink/10 h-9 w-2/3 animate-pulse rounded-sm" />
                <div className="bg-ink/10 h-4 w-1/2 animate-pulse rounded-sm" />
              </div>
            </div>
          ) : profile ? (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
              <div className="bg-paper text-ink-muted font-editorial flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-5xl font-light">
                {profile.photoUrl ? (
                  <img
                    src={profile.photoUrl}
                    alt={profile.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (profile.displayName || "?").charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-ink-body text-base">
                  {[
                    profile.role === "Coach"
                      ? "Coach"
                      : profile.role === "Parent"
                        ? "Parent"
                        : "Player",
                    profile.alias && profile.alias !== profile.displayName
                      ? `Known as ${profile.alias}`
                      : "",
                    profile.city || "",
                    age !== null ? `${age} years old` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <h1 className="font-editorial text-ink mt-2 text-balance text-4xl font-light leading-[1.08] sm:text-5xl">
                  {profile.displayName}
                </h1>
                <p className="text-ink-body mt-3 text-base">{messagingLabel}</p>

                <button
                  type="button"
                  onClick={() => void handleStartConversation()}
                  disabled={isMessaging || profile.messagePrivacy === "NONE"}
                  className="btn-motion bg-power-orange-solid mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-7 text-base font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MessageSquare size={16} aria-hidden="true" />
                  {isMessaging ? "Opening" : "Message"}
                </button>
              </div>
            </div>
          ) : (
            <h1 className="font-editorial text-ink text-4xl font-light">Member profile</h1>
          )}
        </header>

        {profile && (
          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.2fr),minmax(280px,0.8fr)]">
            <section aria-labelledby="member-plays-for">
              <h2 id="member-plays-for" className="font-editorial text-ink text-3xl font-light">
                {dependents.length ? "Who they play for" : "Public sports"}
              </h2>
              {dependents.length ? (
                <DependentSummaryList dependents={dependents} className="mt-4" />
              ) : sports.length ? (
                <ul className="border-hairline mt-4 border-t">
                  {sports.map((sport) => (
                    <li key={sport} className="border-hairline text-ink border-b py-3 text-base">
                      {sport}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-body mt-4 text-base">No public sports listed.</p>
              )}
            </section>

            <section aria-labelledby="member-shares">
              <h2 id="member-shares" className="font-editorial text-ink text-3xl font-light">
                What they share
              </h2>
              <dl className="border-hairline mt-4 border-t">
                {facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="border-hairline flex items-baseline justify-between gap-4 border-b py-3"
                  >
                    <dt className="text-ink-muted text-base">{fact.label}</dt>
                    <dd className="text-ink text-right text-base font-medium">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        )}
      </div>
      <ConnectRequestModal request={connect} />
    </div>
  );
}
