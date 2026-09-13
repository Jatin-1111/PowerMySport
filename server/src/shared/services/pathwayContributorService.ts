import mongoose from "mongoose";

import { Coach } from "../../client/models/Coach";
import { Expert } from "../../client/models/ExpertProfile";
import type { PathwayContributorDocument } from "../models/PathwayGuide";
import type { PathwayContributorProfileType } from "../validation/pathwayGuideFormat";

// ─── Resolving a pathway's contributor ───────────────────────────────────────
//
// A contributed pathway stores its byline (`name`, `organisation`, `url`) and,
// optionally, a pointer at the writer's platform profile. This turns that
// pointer into the handful of fields the reader actually renders.
//
// Coaches and experts are NOT symmetric, and the reader must not have to know
// that. They live in different collections, are gated on different flags, are
// reached at different routes, and neither stores the person's name — that is on
// the linked `User`. All of that is flattened here into one shape.
//
// ── Why an unresolved profile comes back as no profile at all ──
//
// There are three ways this can end up with nothing to link to: the guide never
// had a profile, the document is gone, or the person is no longer publicly
// bookable (unverified, deactivated, rejected). The first two are obvious. The
// third is the interesting one, and it renders the SAME as the others on
// purpose: a byline with no photo, no badge and no booking button.
//
// Offering "Book a session" for someone the booking flow will refuse is a worse
// outcome than a plain byline, and the guide's own `name`/`organisation` still
// credit them either way. So "not live" and "not linked" collapse to one state
// and the reader gets a single `profile ? … : …` branch.

/** What the public API returns for a resolved, currently-bookable contributor. */
export interface ResolvedContributorProfile {
  type: PathwayContributorProfileType;
  id: string;
  /** Their public profile page. */
  href: string;
  /** Differs by type — an expert sells a consultation, a coach sells sessions. */
  ctaLabel: string;
  photoUrl?: string;
}

export interface ResolvedContributor {
  name: string;
  organisation?: string;
  url?: string;
  blurb?: string;
  /** Absent when there is no link, or the linked person is not bookable today. */
  profile?: ResolvedContributorProfile;
}

/**
 * The same conditions the public discovery listings use.
 *
 * These are duplicated here rather than imported because they are a visibility
 * POLICY, and the policy this file needs is "would a parent find this person on
 * the site at all" — which is what those listings encode. If they diverge, this
 * one should follow, and the test for that is whether the profile link 404s.
 */
const COACH_IS_LIVE = { isVerified: true, verificationStatus: "VERIFIED" } as const;
const EXPERT_IS_LIVE = { isActive: true, verificationStatus: "APPROVED" } as const;

/** A person's display photo, preferring a profile-specific one over the account's. */
type UserLike = { name?: string; photoUrl?: string } | null | undefined;

async function resolveProfile(
  type: PathwayContributorProfileType,
  id: mongoose.Types.ObjectId
): Promise<ResolvedContributorProfile | null> {
  if (type === "coach") {
    const coach = await Coach.findOne({ _id: id, ...COACH_IS_LIVE })
      .select("_id userId")
      .populate<{ userId: UserLike }>("userId", "name photoUrl")
      .lean();
    if (!coach) return null;

    const user = coach.userId as UserLike;
    return {
      type,
      id: String(coach._id),
      href: `/coaches/${String(coach._id)}`,
      ctaLabel: "Book a session",
      ...(user?.photoUrl ? { photoUrl: user.photoUrl } : {}),
    };
  }

  // An expert carries its own `photoUrl` — set during expert onboarding — and
  // falls back to the account photo when that step was skipped.
  // Cast rather than a `populate<>` generic: `ExpertProfile` exports the model
  // as `mongoose.models.Expert || mongoose.model(...)`, whose union type erases
  // the document shape and leaves every field access unresolvable.
  const expert = (await Expert.findOne({ _id: id, ...EXPERT_IS_LIVE })
    .select("_id userId photoUrl")
    .populate("userId", "name photoUrl")
    .lean()) as { _id: mongoose.Types.ObjectId; userId?: UserLike; photoUrl?: string } | null;
  if (!expert) return null;

  const user = expert.userId;
  const photoUrl = expert.photoUrl || user?.photoUrl;
  return {
    type,
    id: String(expert._id),
    href: `/experts/${String(expert._id)}`,
    ctaLabel: "Book a consultation",
    ...(photoUrl ? { photoUrl } : {}),
  };
}

/**
 * Flatten a stored contributor into what the page renders.
 *
 * Returns null only when the guide has no contributor at all — a guide WITH a
 * byline always gets its byline back, whatever happened to the linked account.
 */
export async function resolvePathwayContributor(
  contributor: PathwayContributorDocument | undefined | null
): Promise<ResolvedContributor | null> {
  if (!contributor?.name) return null;

  const base: ResolvedContributor = {
    name: contributor.name,
    ...(contributor.organisation ? { organisation: contributor.organisation } : {}),
    ...(contributor.url ? { url: contributor.url } : {}),
    ...(contributor.blurb ? { blurb: contributor.blurb } : {}),
  };

  if (!contributor.profile?.id) return base;

  // A lookup failure must not cost the page its byline — or the page. This runs
  // inside a cached, publicly-read endpoint, and a contributor whose profile
  // errors should degrade to the unlinked credit, not to a 500.
  try {
    const profile = await resolveProfile(contributor.profile.type, contributor.profile.id);
    return profile ? { ...base, profile } : base;
  } catch {
    return base;
  }
}
