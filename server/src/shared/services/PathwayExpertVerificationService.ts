import { Expert } from "../../client/models/ExpertProfile";
import { SportPathway } from "../models/SportPathway";
import { PathwayExpertVerification } from "../models/PathwayExpertVerification";
import { toSlug } from "./PathwayService";

const expertSportSlugs = (sports: string[]): string[] =>
  (sports || []).map((s) => toSlug(s));

interface GroupedPathway {
  _id: string;
  sportName: string;
  category?: string;
  overview: string;
  isVerified: number;
  lookupCount: number;
  stateVariants: number;
}

/**
 * The sports an expert is qualified to verify — one row per sport (not per
 * state variant), aggregated across every SportPathway document that shares
 * that sportSlug. Enforced here (not just client-side) so an expert can't
 * verify sports outside their claimed expertise via a direct API call.
 */
export const listPathwaysForExpertVerification = async (
  expertUserId: string,
) => {
  const expert = await Expert.findOne({ userId: expertUserId })
    .select("sports")
    .lean();
  if (!expert) throw new Error("Expert profile not found");

  const slugs = expertSportSlugs(expert.sports);
  if (slugs.length === 0) return [];

  const grouped: GroupedPathway[] = await SportPathway.aggregate([
    { $match: { sportSlug: { $in: slugs } } },
    {
      $group: {
        _id: "$sportSlug",
        sportName: { $first: "$sportName" },
        category: { $first: "$category" },
        overview: { $first: "$overview" },
        isVerified: { $max: { $cond: ["$isVerified", 1, 0] } },
        lookupCount: { $sum: "$lookupCount" },
        stateVariants: { $sum: 1 },
      },
    },
  ]);
  if (grouped.length === 0) return [];

  const verifications = await PathwayExpertVerification.find({
    sportSlug: { $in: grouped.map((g) => g._id) },
  })
    .select("sportSlug expertId")
    .lean();

  const countBySlug = new Map<string, number>();
  const mineBySlug = new Set<string>();
  for (const v of verifications) {
    countBySlug.set(v.sportSlug, (countBySlug.get(v.sportSlug) || 0) + 1);
    if (v.expertId.toString() === expert._id.toString())
      mineBySlug.add(v.sportSlug);
  }

  return grouped
    .map((g) => ({
      sportSlug: g._id,
      sportName: g.sportName,
      category: g.category,
      overview: g.overview,
      isVerified: Boolean(g.isVerified),
      lookupCount: g.lookupCount,
      stateVariants: g.stateVariants,
      expertVerificationCount: countBySlug.get(g._id) || 0,
      verifiedByMe: mineBySlug.has(g._id),
    }))
    .sort((a, b) => a.sportName.localeCompare(b.sportName));
};

const assertExpertOwnsSport = (expertSports: string[], sportSlug: string) => {
  const slugs = expertSportSlugs(expertSports);
  if (!slugs.includes(sportSlug)) {
    throw new Error(
      "You can only verify pathways for sports listed on your profile",
    );
  }
};

/** Add/update this expert's verification credit for a sport — applies to every state variant of its pathway. */
export const verifyPathwayAsExpert = async (
  sportSlug: string,
  expertUserId: string,
  note?: string,
) => {
  const expert = await Expert.findOne({ userId: expertUserId }).populate(
    "userId",
    "name",
  );
  if (!expert) throw new Error("Expert profile not found");

  assertExpertOwnsSport(expert.sports || [], sportSlug);

  // Any state variant will do — we only need the canonical display name.
  const anyVariant = await SportPathway.findOne({ sportSlug })
    .select("sportName")
    .lean();
  if (!anyVariant) throw new Error("No pathway exists yet for this sport");

  const expertName =
    (expert.userId as unknown as { name?: string })?.name || "Expert";
  const noteValue = note?.trim();

  const setFields: Record<string, unknown> = {
    sportSlug,
    sportName: anyVariant.sportName,
    expertId: expert._id,
    expertName,
    expertPhotoUrl: expert.photoUrl,
    verifiedAt: new Date(),
  };
  if (noteValue) setFields.note = noteValue;

  const verification = await PathwayExpertVerification.findOneAndUpdate(
    { sportSlug, expertId: expert._id },
    {
      $set: setFields,
      ...(noteValue ? {} : { $unset: { note: "" } }),
    },
    { upsert: true, new: true },
  );
  return verification;
};

/** Remove this expert's own verification credit for a sport. */
export const removePathwayExpertVerification = async (
  sportSlug: string,
  expertUserId: string,
) => {
  const expert = await Expert.findOne({ userId: expertUserId }).select("_id");
  if (!expert) throw new Error("Expert profile not found");
  await PathwayExpertVerification.deleteOne({
    sportSlug,
    expertId: expert._id,
  });
};
