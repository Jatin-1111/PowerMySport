"use client";

import { useEffect, useState } from "react";
import { CommunityMemberProfile } from "@/modules/community/types";
import { communityService } from "@/modules/community/services/community";
import { MessageSquare } from "lucide-react";
import DependentSummaryList from "@/modules/community/components/DependentSummaryList";
import CommunityDialog from "@/modules/community/components/CommunityDialog";

interface PlayerDetailsModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onChat: (userId: string) => void;
}

export default function PlayerDetailsModal({
  userId,
  isOpen,
  onClose,
  onChat,
}: PlayerDetailsModalProps) {
  const [profile, setProfile] = useState<CommunityMemberProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && userId) {
      const fetchProfile = async () => {
        setLoading(true);
        setError("");
        try {
          const data = await communityService.getPlayerProfile(userId);
          setProfile(data);
        } catch (err) {
          console.error("Failed to fetch player profile", err);
          setError("We could not load this profile. Please try again.");
        } finally {
          setLoading(false);
        }
      };
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [isOpen, userId]);

  // Absent on a response cached before children were published, so treat the
  // missing case exactly like the empty one.
  const hasDependents = Boolean(profile?.dependents?.length);

  if (!isOpen || !userId) return null;

  const roleLabel =
    profile?.role === "Parent" ? "Parent" : profile?.role === "Coach" ? "Coach" : "Player";

  const facts = profile
    ? [
        ...(profile.city ? [{ label: "Location", value: profile.city }] : []),
        ...(profile.age != null ? [{ label: "Age", value: String(profile.age) }] : []),
      ]
    : [];

  return (
    <CommunityDialog
      isOpen={isOpen}
      onClose={onClose}
      title={profile?.displayName || "Profile"}
      kicker={
        profile
          ? [
              roleLabel,
              profile.alias ? `@${profile.alias}` : "",
              profile.isIdentityPublic ? "" : "Anonymous",
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      footer={
        !loading && profile ? (
          <>
            <button
              type="button"
              onClick={() => {
                onChat(profile.id);
                onClose();
              }}
              className="btn-motion bg-power-orange-solid flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700"
            >
              <MessageSquare size={16} aria-hidden="true" /> Send message
            </button>
            <p className="text-ink-muted mt-3 text-center text-sm">
              Messages stay between you and this parent.
            </p>
          </>
        ) : null
      }
    >
      {loading ? (
        <div aria-busy="true" aria-label="Loading profile" className="space-y-3 py-2">
          <div className="bg-ink/10 h-5 w-1/2 animate-pulse rounded-sm" />
          <div className="bg-ink/10 h-16 animate-pulse rounded-sm" />
        </div>
      ) : error ? (
        <p role="alert" className="text-base font-medium text-red-700">
          {error}
        </p>
      ) : profile ? (
        <div className="flex items-start gap-5">
          <div className="bg-paper-deep text-ink-muted font-editorial flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-4xl font-light">
            {profile.photoUrl ? (
              <img src={profile.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (profile.displayName || "?").charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            {/* Who this parent is, in the only terms that help: a stranger's
                name answers nothing a parent is weighing when they decide
                whether to message. "Tennis, U-14, Chandigarh" answers all of it. */}
            {hasDependents ? (
              <DependentSummaryList dependents={profile.dependents} />
            ) : (
              <>
                {facts.length > 0 && (
                  <dl className="border-hairline border-t">
                    {facts.map((fact) => (
                      <div
                        key={fact.label}
                        className="border-hairline flex items-baseline justify-between gap-4 border-b py-3"
                      >
                        <dt className="text-ink-muted text-base">{fact.label}</dt>
                        <dd className="text-ink text-base font-semibold">{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {profile.sports && profile.sports.length > 0 && (
                  <p className="text-ink-body mt-3 text-base">
                    <span className="text-ink-muted">Sports: </span>
                    {profile.sports.join(", ")}
                  </p>
                )}
                {facts.length === 0 && !(profile.sports && profile.sports.length > 0) && (
                  <p className="text-ink-body text-base">No details shared yet.</p>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </CommunityDialog>
  );
}
