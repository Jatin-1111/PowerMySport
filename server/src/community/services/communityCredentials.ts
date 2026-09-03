import { Coach } from "../../client/models/Coach";
import { Expert } from "../../client/models/ExpertProfile";

export type CommunityCredentialKind = "VERIFIED_EXPERT" | "VERIFIED_COACH";

export interface CommunityCredential {
  kind: CommunityCredentialKind;
  /** Badge text. Kept server-side so the wording cannot drift between the feed,
   *  the thread and the JSON-LD. */
  title: string;
}

/**
 * Who has actually been verified.
 *
 * Community used to badge an author "Verified Coach" purely because their user
 * role was `Coach` — so anyone who signed up as a coach and never submitted a
 * document appeared, on a public page, to have been vetted. That is a
 * credential claim the platform had not earned the right to make.
 *
 * The real sources are `Coach.isVerified` and an `ExpertProfile` that an admin
 * approved AND that is live. Both are checked; nothing else counts.
 *
 * Expert outranks coach when someone is both, because expert approval is the
 * stricter review.
 */
export const resolveCommunityCredentials = async (
  userIds: string[]
): Promise<Map<string, CommunityCredential>> => {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Map();
  }

  const [experts, coaches] = await Promise.all([
    Expert.find({
      userId: { $in: unique },
      verificationStatus: "APPROVED",
      isActive: true,
    })
      .select("userId")
      .lean(),
    Coach.find({ userId: { $in: unique }, isVerified: true })
      .select("userId")
      .lean(),
  ]);

  const credentials = new Map<string, CommunityCredential>();

  // Coaches first so an approved expert overwrites the weaker claim.
  for (const coach of coaches) {
    credentials.set(String(coach.userId), {
      kind: "VERIFIED_COACH",
      title: "Verified Coach",
    });
  }

  for (const expert of experts) {
    credentials.set(String(expert.userId), {
      kind: "VERIFIED_EXPERT",
      title: "Verified Expert",
    });
  }

  return credentials;
};
