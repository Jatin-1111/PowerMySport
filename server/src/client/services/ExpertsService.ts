import crypto from "crypto";
import mongoose from "mongoose";
import { User } from "../models/User";
import { Expert } from "../models/ExpertProfile";
import {
  ExpertSession,
  ExpertSessionDocument,
} from "../models/ExpertBooking";
import {
  initiatePhonePePayment,
  getPhonePeOrderStatus,
} from "../../shared/services/PhonePeService";

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);
const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000";
const toPaise = (rupees: number) => Math.round(rupees * 100);

export const generateTemporaryPassword = (): string =>
  crypto.randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) + "A1";

const expertUserName = (expert: any): { name?: string; email?: string } => {
  const u = expert?.userId;
  if (u && typeof u === "object") return { name: u.name, email: u.email };
  return {};
};

const serializeExpert = (expert: any) => {
  const { name, email } = expertUserName(expert);
  return {
    id: expert._id?.toString(),
    _id: expert._id?.toString(),
    name,
    email,
    bio: expert.bio,
    sports: expert.sports || [],
    expertise: expert.expertise || [],
    achievements: expert.achievements,
    sessionFee: expert.sessionFee,
    sessionMode: expert.sessionMode,
    city: expert.city,
    languages: expert.languages || [],
    photoUrl: expert.photoUrl,
    isActive: expert.isActive,
    rating: expert.rating || 0,
    reviewCount: expert.reviewCount || 0,
    createdAt: expert.createdAt,
  };
};

const serializeSession = (
  session: any,
  extra: { expert?: any; clientName?: string } = {},
) => ({
  id: session._id?.toString(),
  _id: session._id?.toString(),
  expertId: session.expertId?.toString(),
  userId: session.userId?.toString(),
  amount: session.amount,
  status: session.status,
  paymentStatus: session.paymentStatus,
  scheduledAt: session.scheduledAt,
  mode: session.mode,
  meetingLink: session.meetingLink,
  clientNote: session.clientNote,
  reviewed: session.reviewed,
  rating: session.rating,
  review: session.review,
  reviewedAt: session.reviewedAt,
  createdAt: session.createdAt,
  ...(extra.expert ? { expert: extra.expert } : {}),
  ...(extra.clientName ? { clientName: extra.clientName } : {}),
});

export interface CreateExpertPayload {
  name: string;
  email: string;
  phone: string;
  bio?: string;
  sports?: string[];
  expertise?: string[];
  achievements?: string;
  sessionFee: number;
  sessionMode?: "ONLINE" | "IN_PERSON" | "BOTH";
  city?: string;
  languages?: string[];
  photoUrl?: string;
  photoKey?: string;
  createdBy?: string;
}

export const createExpertByAdmin = async (payload: CreateExpertPayload) => {
  const email = payload.email.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) throw new Error("A user with this email already exists");
  if (payload.sessionFee == null || payload.sessionFee < 0) {
    throw new Error("A valid session fee is required");
  }

  const temporaryPassword = generateTemporaryPassword();
  const user = new User({
    name: payload.name.trim(),
    email,
    phone: payload.phone.trim(),
    role: "EXPERT",
    password: temporaryPassword,
    isActive: true,
  });
  await user.save();

  const expert = await Expert.create({
    userId: user._id,
    bio: payload.bio?.trim() || "",
    sports: payload.sports || [],
    expertise: payload.expertise || [],
    achievements: payload.achievements?.trim(),
    sessionFee: payload.sessionFee,
    sessionMode: payload.sessionMode || "ONLINE",
    city: payload.city?.trim(),
    languages: payload.languages || [],
    photoUrl: payload.photoUrl,
    photoKey: payload.photoKey,
    isActive: true,
    ...(payload.createdBy ? { createdBy: toObjectId(payload.createdBy) } : {}),
  });

  return { user, expert, temporaryPassword };
};

export const listExpertsForAdmin = async (params: { page?: number; limit?: number }) => {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const [experts, total] = await Promise.all([
    Expert.find({}).populate("userId", "name email").sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    Expert.countDocuments({}),
  ]);
  return {
    data: experts.map(serializeExpert),
    pagination: { total, page, totalPages: Math.ceil(total / limit) },
  };
};

export const listActiveExperts = async (params: {
  sport?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(60, Math.max(1, params.limit || 30));
  const query: Record<string, unknown> = { isActive: true };
  if (params.sport) query.sports = params.sport;

  const experts = await Expert.find(query)
    .populate("userId", "name email")
    .sort({ rating: -1, createdAt: -1 })
    .lean();

  let mapped = experts.map(serializeExpert);
  if (params.search) {
    const q = params.search.toLowerCase();
    mapped = mapped.filter(
      (e) =>
        (e.name || "").toLowerCase().includes(q) ||
        (e.bio || "").toLowerCase().includes(q) ||
        (e.expertise || []).join(" ").toLowerCase().includes(q) ||
        (e.sports || []).join(" ").toLowerCase().includes(q),
    );
  }
  const total = mapped.length;
  return {
    data: mapped.slice((page - 1) * limit, page * limit),
    pagination: { total, page, totalPages: Math.ceil(total / limit) },
  };
};

export const getExpertById = async (expertId: string) => {
  const expert = await Expert.findById(expertId).populate("userId", "name email").lean();
  if (!expert || !expert.isActive) throw new Error("Expert not found");
  return serializeExpert(expert);
};

export const getExpertReviews = async (expertId: string) => {
  const sessions = await ExpertSession.find({ expertId: toObjectId(expertId), reviewed: true })
    .populate("userId", "name")
    .sort({ reviewedAt: -1 })
    .lean();
  return sessions.map((s) => {
    const u = s.userId as unknown as { name?: string } | null;
    return { rating: s.rating, review: s.review, reviewerName: u?.name || "A player", reviewedAt: s.reviewedAt };
  });
};

const assertSessionOwner = (session: ExpertSessionDocument, userId: string) => {
  if (session.userId.toString() !== userId) {
    throw new Error("You are not authorized to modify this session");
  }
};

export const initiateExpertSession = async (params: {
  expertId: string;
  userId: string;
  clientNote?: string;
  mode?: "ONLINE" | "IN_PERSON";
  userPhone?: string;
}) => {
  const expert = await Expert.findById(params.expertId);
  if (!expert || !expert.isActive) throw new Error("Expert not found");

  const merchantOrderId = `EXP_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const resolvedMode =
    expert.sessionMode === "BOTH"
      ? params.mode || "ONLINE"
      : expert.sessionMode === "IN_PERSON"
        ? "IN_PERSON"
        : "ONLINE";

  const session = await ExpertSession.create({
    expertId: expert._id,
    userId: toObjectId(params.userId),
    amount: expert.sessionFee,
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    merchantOrderId,
    mode: resolvedMode,
    clientNote: params.clientNote?.trim(),
  });

  const payment = await initiatePhonePePayment({
    merchantOrderId,
    amount: toPaise(expert.sessionFee),
    redirectUrl: `${frontendUrl()}/experts/sessions/${session._id}`,
    ...(params.userPhone ? { userPhone: params.userPhone } : {}),
  });

  return { sessionId: session._id.toString(), redirectUrl: payment.redirectUrl };
};

export const reconcileExpertSession = async (params: {
  sessionId: string;
  userId: string;
}): Promise<ExpertSessionDocument> => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  assertSessionOwner(session, params.userId);
  if (session.paymentStatus === "COMPLETED") return session;

  const status = await getPhonePeOrderStatus(session.merchantOrderId);
  if (status.state === "COMPLETED") {
    session.paymentStatus = "COMPLETED";
    if (session.status === "PENDING_PAYMENT") session.status = "PAID";
    await session.save();
  } else if (status.state === "FAILED") {
    session.paymentStatus = "FAILED";
    await session.save();
  }
  return session;
};

export const scheduleExpertSession = async (params: {
  sessionId: string;
  userId: string;
  scheduledAt: string;
  mode?: "ONLINE" | "IN_PERSON";
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  assertSessionOwner(session, params.userId);
  if (session.status !== "PAID") throw new Error("Only a paid session can be scheduled");
  const when = new Date(params.scheduledAt);
  if (isNaN(when.getTime())) throw new Error("Invalid date/time");

  session.scheduledAt = when;
  session.status = "SCHEDULED";
  if (params.mode) session.mode = params.mode;
  await session.save();
  return session;
};

export const completeExpertSession = async (params: {
  sessionId: string;
  actorUserId: string;
  isAdmin?: boolean;
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  if (!params.isAdmin) {
    const expert = await Expert.findById(session.expertId).select("userId");
    if (!expert || expert.userId.toString() !== params.actorUserId) {
      throw new Error("Only the expert or an admin can complete this session");
    }
  }
  if (!["PAID", "SCHEDULED"].includes(session.status)) {
    throw new Error("Session cannot be completed from its current state");
  }
  session.status = "COMPLETED";
  await session.save();
  return session;
};

const recomputeExpertRating = async (expertId: mongoose.Types.ObjectId) => {
  const agg = await ExpertSession.aggregate([
    { $match: { expertId, reviewed: true, rating: { $gte: 1 } } },
    { $group: { _id: "$expertId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const avg = agg[0]?.avg || 0;
  const count = agg[0]?.count || 0;
  await Expert.findByIdAndUpdate(expertId, {
    rating: Math.round(avg * 10) / 10,
    reviewCount: count,
  });
};

export const reviewExpertSession = async (params: {
  sessionId: string;
  userId: string;
  rating: number;
  review?: string;
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  assertSessionOwner(session, params.userId);
  if (session.status !== "COMPLETED") throw new Error("You can only review a completed session");
  if (session.reviewed) throw new Error("You have already reviewed this session");
  if (params.rating < 1 || params.rating > 5) throw new Error("Rating must be between 1 and 5");

  session.reviewed = true;
  session.rating = params.rating;
  session.review = params.review?.trim();
  session.reviewedAt = new Date();
  await session.save();

  await recomputeExpertRating(session.expertId);
  return session;
};

export const getExpertSessionForUser = async (params: {
  sessionId: string;
  userId: string;
  isAdmin?: boolean;
}) => {
  const session = await ExpertSession.findById(params.sessionId).lean();
  if (!session) throw new Error("Session not found");

  const expert = await Expert.findById(session.expertId).populate("userId", "name email").lean();
  const isClient = session.userId.toString() === params.userId;
  const isExpert = expert && (expert.userId as any)?._id?.toString() === params.userId;
  if (!isClient && !isExpert && !params.isAdmin) {
    throw new Error("You are not authorized to view this session");
  }
  return serializeSession(session, { expert: expert ? serializeExpert(expert) : undefined });
};

export const listUserExpertSessions = async (userId: string) => {
  const sessions = await ExpertSession.find({ userId: toObjectId(userId) }).sort({ createdAt: -1 }).lean();
  const expertIds = [...new Set(sessions.map((s) => s.expertId.toString()))];
  const experts = await Expert.find({ _id: { $in: expertIds } }).populate("userId", "name email").lean();
  const byId = new Map(experts.map((e) => [e._id.toString(), e]));
  return sessions.map((s) => {
    const e = byId.get(s.expertId.toString());
    return serializeSession(s, { expert: e ? serializeExpert(e) : undefined });
  });
};

export const listExpertOwnSessions = async (expertUserId: string) => {
  const expert = await Expert.findOne({ userId: toObjectId(expertUserId) }).select("_id");
  if (!expert) return [];
  const sessions = await ExpertSession.find({ expertId: expert._id })
    .populate("userId", "name")
    .sort({ createdAt: -1 })
    .lean();
  return sessions.map((s) => {
    const u = s.userId as unknown as { name?: string } | null;
    return serializeSession(s, { clientName: u?.name || "Client" });
  });
};
