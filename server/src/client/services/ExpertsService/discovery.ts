import { User } from "../../models/User";
import { Expert } from "../../models/ExpertProfile";
import { ExpertSession } from "../../models/ExpertBooking";
import { computeOpenSlots, OpenSlot } from "../ExpertAvailabilityService";
import { toObjectId, escapeRegex, serializeExpert } from "./shared";

// ── Public discovery ─────────────────────────────────────────────────────────

export const listActiveExperts = async (params: {
  sport?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) => {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(60, Math.max(1, params.limit || 30));
  const query: Record<string, unknown> = { isActive: true };
  if (params.sport) query.sports = params.sport;

  if (params.search && params.search.trim()) {
    const rx = new RegExp(escapeRegex(params.search.trim()), "i");
    const matchingUsers = await User.find({ role: "EXPERT", name: rx }).select("_id").lean();
    query.$or = [
      { bio: rx },
      { city: rx },
      { sports: rx },
      { expertise: rx },
      { userId: { $in: matchingUsers.map((u) => u._id) } },
    ];
  }

  const [experts, total] = await Promise.all([
    Expert.find(query)
      .populate("userId", "name email")
      .sort({ rating: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Expert.countDocuments(query),
  ]);

  return {
    data: experts.map(serializeExpert),
    pagination: { total, page, totalPages: Math.ceil(total / limit) },
  };
};

export const getExpertById = async (expertId: string) => {
  const expert = await Expert.findById(expertId).populate("userId", "name email").lean();
  if (!expert || !expert.isActive) throw new Error("Expert not found");
  return serializeExpert(expert);
};

export const getExpertOpenSlots = async (
  expertId: string,
  from?: string,
  to?: string
): Promise<OpenSlot[]> => {
  const expert = await Expert.findById(expertId);
  if (!expert || !expert.isActive) throw new Error("Expert not found");
  return computeOpenSlots(expert, from, to);
};

export const getExpertReviews = async (expertId: string) => {
  const sessions = await ExpertSession.find({
    expertId: toObjectId(expertId),
    reviewed: true,
    reviewHidden: { $ne: true },
  })
    .populate("userId", "name")
    .sort({ reviewedAt: -1 })
    .lean();
  return sessions.map((s) => {
    const u = s.userId as unknown as { name?: string } | null;
    return {
      rating: s.rating,
      review: s.review,
      reviewerName: s.reviewAnonymous ? "Anonymous" : u?.name || "A player",
      reviewedAt: s.reviewedAt,
    };
  });
};
