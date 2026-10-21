"use client";

import { CommunityMemberProfile } from "../types";
import DependentSummaryList from "./DependentSummaryList";
import CommunityDialog from "./CommunityDialog";
import { MessageSquare } from "lucide-react";
import { formatLastSeen } from "@/modules/community/utils/chatUtils";

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

/** A member's profile as another parent sees it, opened from chat or Q&A. */
export function CommunityMemberProfileModal({
  isOpen,
  isLoading,
  error,
  profile,
  onClose,
  onMessage,
}: CommunityMemberProfileModalProps) {
  const calculatedAge = calculateAgeFromDate(profile?.dob);
  const age = profile?.age ?? calculatedAge;

  const messaging =
    profile?.messagePrivacy === "NONE"
      ? "Off"
      : profile?.messagePrivacy === "REQUEST_ONLY"
        ? "Requests only"
        : "Open";

  const facts = profile
    ? [
        ...(profile.city ? [{ label: "Location", value: profile.city }] : []),
        ...(age !== null ? [{ label: "Age", value: String(age) }] : []),
        ...(profile.createdAt ? [{ label: "Joined", value: formatDate(profile.createdAt) }] : []),
        ...(profile.lastActiveAt
          ? [{ label: "Last active", value: formatDateTime(profile.lastActiveAt) }]
          : []),
        { label: "Identity", value: profile.isIdentityPublic ? "Public" : "Alias only" },
        { label: "Messages", value: messaging },
        { label: "Read receipts", value: profile.readReceiptsEnabled ? "On" : "Off" },
      ]
    : [];

  return (
    <CommunityDialog
      isOpen={isOpen}
      onClose={onClose}
      title={profile?.displayName || (isLoading ? "Loading profile" : "Member profile")}
      kicker={
        profile
          ? [
              profile.role === "Coach" ? "Coach" : "Player",
              profile.alias && profile.alias !== profile.displayName
                ? `Known as ${profile.alias}`
                : "",
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      footer={
        profile ? (
          <>
            <button
              type="button"
              onClick={onMessage}
              disabled={profile.messagePrivacy === "NONE"}
              className="btn-motion bg-power-orange-solid flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageSquare size={16} aria-hidden="true" />
              {profile.messagePrivacy === "NONE" ? "Messaging is off" : "Message"}
            </button>
            {profile.lastSeenVisible && profile.lastSeenAt ? (
              <p className="text-ink-muted mt-3 text-center text-sm">
                {formatLastSeen(profile.lastSeenAt)}
              </p>
            ) : null}
          </>
        ) : null
      }
    >
      {isLoading ? (
        <div aria-busy="true" aria-label="Loading profile" className="space-y-3">
          <div className="bg-ink/10 h-5 w-1/2 animate-pulse rounded-sm" />
          <div className="bg-ink/10 h-24 animate-pulse rounded-sm" />
        </div>
      ) : error ? (
        <p role="alert" className="text-base font-medium text-red-700">
          {error}
        </p>
      ) : profile ? (
        <>
          <div className="flex items-start gap-5">
            <div className="bg-paper-deep text-ink-muted font-editorial flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-4xl font-light">
              {profile.photoUrl ? (
                <img src={profile.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                (profile.displayName || "?").charAt(0).toUpperCase()
              )}
            </div>
            <dl className="border-hairline min-w-0 flex-1 border-t">
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className="border-hairline flex items-baseline justify-between gap-4 border-b py-2.5"
                >
                  <dt className="text-ink-muted text-base">{fact.label}</dt>
                  <dd className="text-ink text-right text-base font-medium">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-6">
            {profile.dependents?.length ? (
              <DependentSummaryList dependents={profile.dependents} />
            ) : profile.sports?.length ? (
              <p className="text-ink-body text-base">
                <span className="text-ink-muted">Sports: </span>
                {profile.sports.join(", ")}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </CommunityDialog>
  );
}

export default CommunityMemberProfileModal;
