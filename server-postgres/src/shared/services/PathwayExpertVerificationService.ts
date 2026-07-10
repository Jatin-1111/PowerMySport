import prisma from "../../lib/prisma";
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
  const expert = await prisma.expert.findUnique({
    where: { userId: expertUserId },
    select: { id: true, sports: true },
  });
  if (!expert) throw new Error("Expert profile not found");

  const slugs = expertSportSlugs(expert.sports);
  if (slugs.length === 0) return [];

  // TODO(prisma): the Mongo $group ($first sportName/category/overview,
  // $max isVerified, $sum lookupCount, count) is done in code — Prisma
  // groupBy cannot return non-grouped "first" columns nor _max on a Boolean.
  // "$first" without a sort is arbitrary in Mongo; here it is the first row
  // returned by findMany, which is functionally equivalent.
  const pathways = await prisma.sportPathway.findMany({
    where: { sportSlug: { in: slugs } },
    select: {
      sportSlug: true,
      sportName: true,
      category: true,
      overview: true,
      isVerified: true,
      lookupCount: true,
    },
  });

  const groupedMap = new Map<string, GroupedPathway>();
  for (const p of pathways) {
    const g = groupedMap.get(p.sportSlug);
    if (!g) {
      groupedMap.set(p.sportSlug, {
        _id: p.sportSlug,
        sportName: p.sportName,
        category: p.category ?? undefined,
        overview: p.overview,
        isVerified: p.isVerified ? 1 : 0,
        lookupCount: p.lookupCount,
        stateVariants: 1,
      });
    } else {
      g.isVerified = Math.max(g.isVerified, p.isVerified ? 1 : 0);
      g.lookupCount += p.lookupCount;
      g.stateVariants += 1;
    }
  }
  const grouped: GroupedPathway[] = Array.from(groupedMap.values());
  if (grouped.length === 0) return [];

  const verifications = await prisma.pathwayExpertVerification.findMany({
    where: { sportSlug: { in: grouped.map((g) => g._id) } },
    select: { sportSlug: true, expertId: true },
  });

  const countBySlug = new Map<string, number>();
  const mineBySlug = new Set<string>();
  for (const v of verifications) {
    countBySlug.set(v.sportSlug, (countBySlug.get(v.sportSlug) || 0) + 1);
    if (v.expertId === expert.id) mineBySlug.add(v.sportSlug);
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
  const expert = await prisma.expert.findUnique({
    where: { userId: expertUserId },
  });
  if (!expert) throw new Error("Expert profile not found");

  // Was `.populate("userId", "name")` — Expert.userId is a String FK, so fetch
  // the owning user directly for the display name.
  const user = await prisma.user.findUnique({
    where: { id: expert.userId },
    select: { name: true },
  });

  assertExpertOwnsSport(expert.sports || [], sportSlug);

  // Any state variant will do — we only need the canonical display name.
  const anyVariant = await prisma.sportPathway.findFirst({
    where: { sportSlug },
    select: { sportName: true },
  });
  if (!anyVariant) throw new Error("No pathway exists yet for this sport");

  const expertName = user?.name || "Expert";
  const noteValue = note?.trim();

  // Mongo used $set + conditional $unset(note). In Postgres `note` is a
  // nullable column, so "clear note when none supplied" == set it to null.
  const verification = await prisma.pathwayExpertVerification.upsert({
    where: { sportSlug_expertId: { sportSlug, expertId: expert.id } },
    create: {
      sportSlug,
      sportName: anyVariant.sportName,
      expertId: expert.id,
      expertName,
      expertPhotoUrl: expert.photoUrl,
      verifiedAt: new Date(),
      note: noteValue ?? null,
    },
    update: {
      sportName: anyVariant.sportName,
      expertName,
      expertPhotoUrl: expert.photoUrl,
      verifiedAt: new Date(),
      note: noteValue ?? null,
    },
  });
  return verification;
};

/** Remove this expert's own verification credit for a sport. */
export const removePathwayExpertVerification = async (
  sportSlug: string,
  expertUserId: string,
) => {
  const expert = await prisma.expert.findUnique({
    where: { userId: expertUserId },
    select: { id: true },
  });
  if (!expert) throw new Error("Expert profile not found");
  await prisma.pathwayExpertVerification.deleteMany({
    where: { sportSlug, expertId: expert.id },
  });
};
