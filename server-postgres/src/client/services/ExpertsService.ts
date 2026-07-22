import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import type { ExpertSession, ExpertVerificationStatus } from "@prisma/client";
import prisma from "../../lib/prisma";
import {
  initiatePhonePePayment,
  getPhonePeOrderStatus,
  initiatePhonePeRefund,
} from "../../shared/services/PhonePeService";
import { NotificationService } from "./NotificationService";
import {
  computeOpenSlots,
  assertSlotBookable,
  OpenSlot,
} from "./ExpertAvailabilityService";

const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000";
const toPaise = (rupees: number) => Math.round(rupees * 100);
const HOLD_MINUTES = 15;

// bcrypt work factor (mirrors AuthService; was a Mongoose pre-save hook on User,
// relocated to the app layer per PORTING_GUIDE §3 — hash before user.create).
const BCRYPT_ROUNDS = 12;
const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, BCRYPT_ROUNDS);

export const generateTemporaryPassword = (): string =>
  crypto
    .randomBytes(9)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10) + "A1";

// ── User attach helpers (String-FK ref → manual join, see PORTING_GUIDE §1) ───

type ExpertUser = { id: string; name: string; email: string };

/** Attach the referenced User (name/email) to a batch of expert rows. */
const attachExpertUsers = async <T extends { userId: string }>(
  experts: T[],
): Promise<(T & { user: ExpertUser | null })[]> => {
  const ids = [...new Set(experts.map((e) => e.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return experts.map((e) => ({ ...e, user: byId.get(e.userId) ?? null }));
};

/** Attach the referenced User (name/email) to a single expert row. */
const attachExpertUser = async <T extends { userId: string }>(
  expert: T,
): Promise<T & { user: ExpertUser | null }> => {
  const user = await prisma.user.findUnique({
    where: { id: expert.userId },
    select: { id: true, name: true, email: true },
  });
  return { ...expert, user: user ?? null };
};

// ── Serialization ────────────────────────────────────────────────────────────

const expertUserName = (expert: any): { name?: string; email?: string } => {
  const u = expert?.user;
  if (u && typeof u === "object") return { name: u.name, email: u.email };
  return {};
};

const serializeExpert = (expert: any) => {
  const { name, email } = expertUserName(expert);
  return {
    id: expert.id?.toString(),
    _id: expert.id?.toString(),
    name,
    email,
    bio: expert.bio,
    sports: expert.sports || [],
    expertise: expert.expertise || [],
    achievements: expert.achievements,
    sessionFee: expert.sessionFee,
    sessionMode: expert.sessionMode,
    sessionDurationMinutes: expert.sessionDurationMinutes || 60,
    timezone: expert.timezone || "Asia/Kolkata",
    hasAvailability: (expert.weeklyAvailability || []).length > 0,
    city: expert.city,
    languages: expert.languages || [],
    photoUrl: expert.photoUrl,
    isActive: expert.isActive,
    verificationStatus: expert.verificationStatus || "UNVERIFIED",
    rating: expert.rating || 0,
    reviewCount: expert.reviewCount || 0,
    createdAt: expert.createdAt,
  };
};

/** Owner/admin view — includes editable availability + photoKey. */
const serializeExpertFull = (expert: any) => ({
  ...serializeExpert(expert),
  photoKey: expert.photoKey,
  weeklyAvailability: expert.weeklyAvailability || [],
  blackoutDates: expert.blackoutDates || [],
  inPersonAddress: expert.inPersonAddress,
  rejectionReason: expert.rejectionReason,
});

const serializeSession = (
  session: any,
  extra: {
    expert?: any;
    clientName?: string;
    expertTimezone?: string;
    expertInPersonAddress?: string;
  } = {},
) => ({
  id: session.id?.toString(),
  _id: session.id?.toString(),
  expertId: session.expertId?.toString(),
  userId: session.userId?.toString(),
  amount: session.amount,
  status: session.status,
  paymentStatus: session.paymentStatus,
  scheduledAt: session.scheduledAt,
  durationMinutes: session.durationMinutes,
  // Canonical display timezone (the expert's) so client + expert see the same time.
  expertTimezone:
    extra.expertTimezone || extra.expert?.timezone || "Asia/Kolkata",
  mode: session.mode,
  meetingLink: session.meetingLink,
  // Only surfaced for IN_PERSON sessions, and only to someone who has an
  // actual booking — the public expert listing never exposes this address.
  ...(session.mode === "IN_PERSON" && extra.expertInPersonAddress
    ? { inPersonAddress: extra.expertInPersonAddress }
    : {}),
  clientNote: session.clientNote,
  cancelledAt: session.cancelledAt,
  cancelledBy: session.cancelledBy,
  cancelReason: session.cancelReason,
  refundStatus: session.refundStatus,
  cancellationNoticeHours: session.cancellationNoticeHours,
  expertAcceptance: session.expertAcceptance || "PENDING",
  expertRespondedAt: session.expertRespondedAt,
  completedAt: session.completedAt,
  payoutStatus: session.payoutStatus || "PENDING",
  payoutPaidAt: session.payoutPaidAt,
  reviewed: session.reviewed,
  rating: session.rating,
  review: session.review,
  reviewAnonymous: session.reviewAnonymous,
  reviewHidden: session.reviewHidden,
  reviewedAt: session.reviewedAt,
  createdAt: session.createdAt,
  ...(extra.expert ? { expert: extra.expert } : {}),
  ...(extra.clientName ? { clientName: extra.clientName } : {}),
});

// ── Notification helpers (best-effort; never throw) ──────────────────────────

const notify = (
  userId: string,
  type: any,
  title: string,
  message: string,
  data: Record<string, unknown> = {},
  email = false,
) => {
  NotificationService.send(
    { userId: userId.toString(), type, title, message, data },
    { sendEmail: email },
  ).catch((err) => console.error("[experts] notification failed:", err));
};

const expertUserIdOf = async (expertId: string): Promise<string | null> => {
  const e = await prisma.expert.findUnique({
    where: { id: expertId },
    select: { userId: true },
  });
  return e ? e.userId : null;
};

// ── Admin: create / list ─────────────────────────────────────────────────────

export interface CreateExpertPayload {
  name: string;
  email: string;
  phone: string;
  bio?: string | undefined;
  sports?: string[] | undefined;
  expertise?: string[] | undefined;
  achievements?: string | undefined;
  sessionFee: number;
  sessionMode?: "ONLINE" | "IN_PERSON" | "BOTH" | undefined;
  sessionDurationMinutes?: number | undefined;
  timezone?: string | undefined;
  weeklyAvailability?:
    { dayOfWeek: number; start: string; end: string }[] | undefined;
  blackoutDates?: string[] | undefined;
  city?: string | undefined;
  languages?: string[] | undefined;
  photoUrl?: string | undefined;
  photoKey?: string | undefined;
  createdBy?: string | undefined;
}

export const createExpertByAdmin = async (payload: CreateExpertPayload) => {
  const email = payload.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with this email already exists");
  if (payload.sessionFee == null || payload.sessionFee < 0) {
    throw new Error("A valid session fee is required");
  }

  const temporaryPassword = generateTemporaryPassword();
  const hashedPassword = await hashPassword(temporaryPassword);

  // User + Expert (with its child availability windows) are written together.
  const { user, expert } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: payload.name.trim(),
        email,
        phone: payload.phone.trim(),
        role: "EXPERT",
        password: hashedPassword,
        isActive: true,
      },
    });

    const expert = await tx.expert.create({
      data: {
        userId: user.id,
        bio: payload.bio?.trim() || "",
        sports: payload.sports || [],
        expertise: payload.expertise || [],
        achievements: payload.achievements?.trim() ?? null,
        sessionFee: payload.sessionFee,
        sessionMode: payload.sessionMode || "ONLINE",
        ...(payload.sessionDurationMinutes
          ? { sessionDurationMinutes: payload.sessionDurationMinutes }
          : {}),
        ...(payload.timezone ? { timezone: payload.timezone } : {}),
        ...(Array.isArray(payload.weeklyAvailability)
          ? {
              weeklyAvailability: {
                create: payload.weeklyAvailability.map((w) => ({
                  dayOfWeek: w.dayOfWeek,
                  start: w.start,
                  end: w.end,
                })),
              },
            }
          : {}),
        ...(Array.isArray(payload.blackoutDates)
          ? { blackoutDates: payload.blackoutDates }
          : {}),
        city: payload.city?.trim() ?? null,
        languages: payload.languages || [],
        photoUrl: payload.photoUrl ?? null,
        photoKey: payload.photoKey ?? null,
        isActive: true,
        verificationStatus: "APPROVED",
        ...(payload.createdBy ? { createdBy: payload.createdBy } : {}),
      },
      include: { weeklyAvailability: true },
    });

    return { user, expert };
  });

  return { user, expert, temporaryPassword };
};

export const listExpertsForAdmin = async (params: {
  page?: number | undefined;
  limit?: number | undefined;
  verificationStatus?: string | undefined;
}) => {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const where: Prisma.ExpertWhereInput = {};
  if (params.verificationStatus)
    where.verificationStatus =
      params.verificationStatus as ExpertVerificationStatus;
  const [experts, total] = await Promise.all([
    prisma.expert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { weeklyAvailability: true },
    }),
    prisma.expert.count({ where }),
  ]);
  // Always include pending count for the badge
  const pendingCount = await prisma.expert.count({
    where: { verificationStatus: "PENDING" },
  });
  const withUsers = await attachExpertUsers(experts);
  return {
    data: withUsers.map(serializeExpertFull),
    pagination: { total, page, totalPages: Math.ceil(total / limit) },
    pendingCount,
  };
};

// Fields an admin (or the expert) may edit on a profile.
const EDITABLE_FIELDS = [
  "bio",
  "sports",
  "expertise",
  "achievements",
  "sessionFee",
  "sessionMode",
  "sessionDurationMinutes",
  "timezone",
  "weeklyAvailability",
  "blackoutDates",
  "city",
  "languages",
  "photoUrl",
  "photoKey",
  "inPersonAddress",
] as const;

const sanitizeProfilePatch = (patch: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (patch[key] === undefined) continue;
    out[key] = patch[key];
  }
  if (
    out.sessionFee != null &&
    (Number(out.sessionFee) < 0 || isNaN(Number(out.sessionFee)))
  ) {
    throw new Error("A valid session fee is required");
  }
  if (out.weeklyAvailability && Array.isArray(out.weeklyAvailability)) {
    for (const w of out.weeklyAvailability as any[]) {
      if (
        typeof w?.dayOfWeek !== "number" ||
        w.dayOfWeek < 0 ||
        w.dayOfWeek > 6 ||
        !/^\d{2}:\d{2}$/.test(String(w?.start)) ||
        !/^\d{2}:\d{2}$/.test(String(w?.end)) ||
        String(w.start) >= String(w.end)
      ) {
        throw new Error("Invalid availability window");
      }
    }
  }
  return out;
};

/**
 * Translate a sanitized profile patch into a Prisma update payload. The
 * `weeklyAvailability` array (formerly an embedded Mongo array) becomes a full
 * replace of the child `ExpertAvailabilityWindow` rows (deleteMany + create).
 */
const buildExpertUpdateData = (
  update: Record<string, unknown>,
): Prisma.ExpertUpdateInput => {
  const { weeklyAvailability, ...rest } = update;
  const data: Prisma.ExpertUpdateInput = { ...(rest as Prisma.ExpertUpdateInput) };
  if (Array.isArray(weeklyAvailability)) {
    data.weeklyAvailability = {
      deleteMany: {},
      create: (weeklyAvailability as any[]).map((w) => ({
        dayOfWeek: w.dayOfWeek,
        start: w.start,
        end: w.end,
      })),
    };
  }
  return data;
};

export const updateExpertByAdmin = async (
  expertId: string,
  patch: Record<string, unknown>,
) => {
  const update = sanitizeProfilePatch(patch);
  if (patch.isActive !== undefined) update.isActive = Boolean(patch.isActive);
  const existing = await prisma.expert.findUnique({ where: { id: expertId } });
  if (!existing) throw new Error("Expert not found");
  const expert = await prisma.expert.update({
    where: { id: expertId },
    data: buildExpertUpdateData(update),
    include: { weeklyAvailability: true },
  });
  const withUser = await attachExpertUser(expert);
  return serializeExpertFull(withUser);
};

export const setExpertActive = async (expertId: string, isActive: boolean) => {
  const existing = await prisma.expert.findUnique({ where: { id: expertId } });
  if (!existing) throw new Error("Expert not found");
  const expert = await prisma.expert.update({
    where: { id: expertId },
    data: { isActive },
    include: { weeklyAvailability: true },
  });
  const withUser = await attachExpertUser(expert);
  return serializeExpertFull(withUser);
};

export const submitExpertForReview = async (userId: string) => {
  const target = await prisma.expert.findFirst({
    where: {
      userId,
      verificationStatus: { in: ["UNVERIFIED", "REJECTED"] },
    },
  });
  if (!target)
    throw new Error(
      "Expert profile not found or not eligible for review submission",
    );
  const expert = await prisma.expert.update({
    where: { id: target.id },
    data: { verificationStatus: "PENDING" },
    include: { weeklyAvailability: true },
  });
  const withUser = await attachExpertUser(expert);
  return serializeExpertFull(withUser);
};

export const approveExpert = async (expertId: string) => {
  const existing = await prisma.expert.findUnique({ where: { id: expertId } });
  if (!existing) throw new Error("Expert not found");
  const expert = await prisma.expert.update({
    where: { id: expertId },
    data: { verificationStatus: "APPROVED", isActive: true, rejectionReason: null },
    include: { weeklyAvailability: true },
  });
  const withUser = await attachExpertUser(expert);
  return serializeExpertFull(withUser);
};

export const rejectExpert = async (expertId: string, reason: string) => {
  const existing = await prisma.expert.findUnique({ where: { id: expertId } });
  if (!existing) throw new Error("Expert not found");
  const expert = await prisma.expert.update({
    where: { id: expertId },
    data: {
      verificationStatus: "REJECTED",
      isActive: false,
      rejectionReason: reason.trim(),
    },
    include: { weeklyAvailability: true },
  });
  const withUser = await attachExpertUser(expert);
  return serializeExpertFull(withUser);
};

// ── Expert self-service profile ──────────────────────────────────────────────

export const getMyExpertProfile = async (userId: string) => {
  const expert = await prisma.expert.findUnique({
    where: { userId },
    include: { weeklyAvailability: true },
  });
  if (!expert) throw new Error("Expert profile not found");
  const withUser = await attachExpertUser(expert);
  return serializeExpertFull(withUser);
};

export const updateMyExpertProfile = async (
  userId: string,
  patch: Record<string, unknown>,
) => {
  const update = sanitizeProfilePatch(patch);
  const target = await prisma.expert.findUnique({ where: { userId } });
  if (!target) throw new Error("Expert profile not found");
  const expert = await prisma.expert.update({
    where: { id: target.id },
    data: buildExpertUpdateData(update),
    include: { weeklyAvailability: true },
  });
  const withUser = await attachExpertUser(expert);
  return serializeExpertFull(withUser);
};

// ── Public discovery ─────────────────────────────────────────────────────────

export const listActiveExperts = async (params: {
  sport?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}) => {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(60, Math.max(1, params.limit || 30));
  const where: Prisma.ExpertWhereInput = { isActive: true };
  if (params.sport) where.sports = { has: params.sport };

  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    const matchingUsers = await prisma.user.findMany({
      where: { role: "EXPERT", name: { contains: term, mode: "insensitive" } },
      select: { id: true },
    });
    // TODO(prisma): full-text — add tsvector/GIN index and query via $queryRaw.
    // `bio`/`city` use case-insensitive contains; the `sports`/`expertise`
    // String[] columns only support exact-element `has` (no partial/ILIKE
    // element match as the old Mongo regex did), so a proper search index is
    // still owed here.
    where.OR = [
      { bio: { contains: term, mode: "insensitive" } },
      { city: { contains: term, mode: "insensitive" } },
      { sports: { has: term } },
      { expertise: { has: term } },
      { userId: { in: matchingUsers.map((u) => u.id) } },
    ];
  }

  const [experts, total] = await Promise.all([
    prisma.expert.findMany({
      where,
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: { weeklyAvailability: true },
    }),
    prisma.expert.count({ where }),
  ]);

  const withUsers = await attachExpertUsers(experts);
  return {
    data: withUsers.map(serializeExpert),
    pagination: { total, page, totalPages: Math.ceil(total / limit) },
  };
};

export const getExpertById = async (expertId: string) => {
  const expert = await prisma.expert.findUnique({
    where: { id: expertId },
    include: { weeklyAvailability: true },
  });
  if (!expert || !expert.isActive) throw new Error("Expert not found");
  const withUser = await attachExpertUser(expert);
  return serializeExpert(withUser);
};

export const getExpertOpenSlots = async (
  expertId: string,
  from?: string,
  to?: string,
): Promise<OpenSlot[]> => {
  const expert = await prisma.expert.findUnique({
    where: { id: expertId },
    include: { weeklyAvailability: true },
  });
  if (!expert || !expert.isActive) throw new Error("Expert not found");
  return computeOpenSlots(expert, from, to);
};

export const getExpertReviews = async (expertId: string) => {
  const sessions = await prisma.expertSession.findMany({
    where: {
      expertId,
      reviewed: true,
      reviewHidden: { not: true },
    },
    orderBy: { reviewedAt: "desc" },
  });
  const userIds = [...new Set(sessions.map((s) => s.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return sessions.map((s) => ({
    rating: s.rating,
    review: s.review,
    reviewerName: s.reviewAnonymous
      ? "Anonymous"
      : byId.get(s.userId)?.name || "A player",
    reviewedAt: s.reviewedAt,
  }));
};

// ── Session lifecycle ────────────────────────────────────────────────────────

const assertSessionOwner = (session: ExpertSession, userId: string) => {
  if (session.userId !== userId) {
    throw new Error("You are not authorized to modify this session");
  }
};

export const initiateExpertSession = async (params: {
  expertId: string;
  userId: string;
  scheduledAt: string;
  clientNote?: string;
  mode?: "ONLINE" | "IN_PERSON";
  userPhone?: string;
}) => {
  const expert = await prisma.expert.findUnique({
    where: { id: params.expertId },
    include: { weeklyAvailability: true },
  });
  if (!expert || !expert.isActive) throw new Error("Expert not found");
  if (params.userId === expert.userId) {
    throw new Error("You cannot book a session with yourself");
  }

  const scheduledAt = new Date(params.scheduledAt);
  await assertSlotBookable(expert, scheduledAt);

  const merchantOrderId = `EXP_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const resolvedMode =
    expert.sessionMode === "BOTH"
      ? params.mode || "ONLINE"
      : expert.sessionMode === "IN_PERSON"
        ? "IN_PERSON"
        : "ONLINE";

  const session = await prisma.expertSession.create({
    data: {
      expertId: expert.id,
      userId: params.userId,
      amount: expert.sessionFee,
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      merchantOrderId,
      scheduledAt,
      durationMinutes: expert.sessionDurationMinutes || 60,
      holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
      mode: resolvedMode,
      clientNote: params.clientNote?.trim() ?? null,
    },
  });

  const payment = await initiatePhonePePayment({
    merchantOrderId,
    amount: toPaise(expert.sessionFee),
    redirectUrl: `${frontendUrl()}/experts/sessions/${session.id}`,
    ...(params.userPhone ? { userPhone: params.userPhone } : {}),
  });

  return {
    sessionId: session.id.toString(),
    redirectUrl: payment.redirectUrl,
  };
};

/**
 * Idempotently transition a session to a paid+scheduled state and fire the
 * one-time confirmation notifications. Safe to call from both the client-driven
 * reconcile and the webhook path. Optional `extraData` is merged into the same
 * atomic write (used by the webhook to persist the callback payload).
 */
const applyExpertPaymentSuccess = async (
  session: ExpertSession,
  extraData: Prisma.ExpertSessionUpdateInput = {},
): Promise<ExpertSession> => {
  const wasPaid = session.paymentStatus === "COMPLETED";
  const nextStatus =
    session.status === "PENDING_PAYMENT"
      ? session.scheduledAt
        ? "SCHEDULED"
        : "PAID"
      : session.status;

  const updated = await prisma.expertSession.update({
    where: { id: session.id },
    data: {
      paymentStatus: "COMPLETED",
      holdExpiresAt: null,
      status: nextStatus,
      ...extraData,
    },
  });

  if (!wasPaid) {
    const when = updated.scheduledAt
      ? new Date(updated.scheduledAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "a time you choose";
    // Client receipt.
    notify(
      updated.userId,
      "PAYMENT_CONFIRMED",
      "Session booked",
      `Your payment of ₹${updated.amount} is confirmed. Your session is set for ${when}.`,
      { sessionId: updated.id.toString(), amount: updated.amount },
      true,
    );
    // Expert alert.
    const expertUserId = await expertUserIdOf(updated.expertId);
    if (expertUserId) {
      notify(
        expertUserId,
        "BOOKING_CONFIRMED",
        "New session booked",
        `A client booked a paid session with you for ${when}.`,
        { sessionId: updated.id.toString() },
        true,
      );
    }
  }
  return updated;
};

export const reconcileExpertSession = async (params: {
  sessionId: string;
  userId: string;
}): Promise<ExpertSession> => {
  const session = await prisma.expertSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session) throw new Error("Session not found");
  assertSessionOwner(session, params.userId);
  if (session.paymentStatus === "COMPLETED") return session;

  const status = await getPhonePeOrderStatus(session.merchantOrderId);
  const state = (status.state || "").toUpperCase();
  if (["COMPLETED", "SUCCESS", "PAYMENT_SUCCESS"].includes(state)) {
    return applyExpertPaymentSuccess(session);
  } else if (["FAILED", "PAYMENT_ERROR", "PAYMENT_DECLINED"].includes(state)) {
    return prisma.expertSession.update({
      where: { id: session.id },
      data: {
        paymentStatus: "FAILED",
        ...(session.status === "PENDING_PAYMENT"
          ? {
              status: "CANCELLED",
              cancelledBy: "SYSTEM",
              cancelReason: "Payment failed",
              cancelledAt: new Date(),
              holdExpiresAt: null,
            }
          : {}),
      },
    });
  }
  return session;
};

/** Reschedule a paid/scheduled session to another open slot. */
export const scheduleExpertSession = async (params: {
  sessionId: string;
  userId: string;
  scheduledAt: string;
  mode?: "ONLINE" | "IN_PERSON";
}) => {
  const session = await prisma.expertSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session) throw new Error("Session not found");
  assertSessionOwner(session, params.userId);
  if (!["PAID", "SCHEDULED"].includes(session.status)) {
    throw new Error("Only a paid session can be scheduled");
  }
  const expert = await prisma.expert.findUnique({
    where: { id: session.expertId },
    include: { weeklyAvailability: true },
  });
  if (!expert) throw new Error("Expert not found");

  const when = new Date(params.scheduledAt);
  await assertSlotBookable(expert, when, session.id);

  const updated = await prisma.expertSession.update({
    where: { id: session.id },
    data: {
      scheduledAt: when,
      status: "SCHEDULED",
      ...(params.mode ? { mode: params.mode } : {}),
    },
  });

  const expertUserId = expert.userId;
  notify(
    expertUserId,
    "BOOKING_STATUS_UPDATED",
    "Session scheduled",
    `A session was scheduled for ${when.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}.`,
    { sessionId: updated.id.toString() },
  );
  return updated;
};

export const completeExpertSession = async (params: {
  sessionId: string;
  actorUserId: string;
  isAdmin?: boolean;
}) => {
  const session = await prisma.expertSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session) throw new Error("Session not found");
  if (!params.isAdmin) {
    const expert = await prisma.expert.findUnique({
      where: { id: session.expertId },
      select: { userId: true },
    });
    if (!expert || expert.userId !== params.actorUserId) {
      throw new Error("Only the expert or an admin can complete this session");
    }
  }
  if (!["PAID", "SCHEDULED"].includes(session.status)) {
    throw new Error("Session cannot be completed from its current state");
  }
  const updated = await prisma.expertSession.update({
    where: { id: session.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  notify(
    updated.userId,
    "REVIEW_REMINDER",
    "How was your session?",
    "Your expert session is complete. Leave a rating and feedback to help others.",
    { sessionId: updated.id.toString() },
    true,
  );
  return updated;
};

export const setSessionMeetingLink = async (params: {
  sessionId: string;
  actorUserId: string;
  isAdmin?: boolean;
  meetingLink: string;
}) => {
  const session = await prisma.expertSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session) throw new Error("Session not found");
  if (!params.isAdmin) {
    const expert = await prisma.expert.findUnique({
      where: { id: session.expertId },
      select: { userId: true },
    });
    if (!expert || expert.userId !== params.actorUserId) {
      throw new Error("Only the expert or an admin can set the meeting link");
    }
  }
  const link = params.meetingLink.trim();
  if (link && !/^https?:\/\//i.test(link)) {
    throw new Error("Meeting link must be a valid URL");
  }
  const updated = await prisma.expertSession.update({
    where: { id: session.id },
    data: { meetingLink: link },
  });

  notify(
    updated.userId,
    "BOOKING_STATUS_UPDATED",
    "Meeting link added",
    "Your expert added a meeting link for your upcoming session.",
    { sessionId: updated.id.toString() },
    true,
  );
  return updated;
};

/**
 * Expert (or admin) responds to a client's booked session:
 *  - ACCEPT: confirm the client's chosen time.
 *  - DECLINE: cancel the session (paid → manual refund required) + notify.
 *  - RESCHEDULE: move to another open slot within the expert's availability.
 */
export const respondToExpertSession = async (params: {
  sessionId: string;
  expertUserId: string;
  isAdmin?: boolean | undefined;
  action: "ACCEPT" | "DECLINE" | "RESCHEDULE";
  scheduledAt?: string | undefined;
  reason?: string | undefined;
}) => {
  const session = await prisma.expertSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session) throw new Error("Session not found");
  const expert = await prisma.expert.findUnique({
    where: { id: session.expertId },
    include: { weeklyAvailability: true },
  });
  if (!expert) throw new Error("Expert not found");
  if (!params.isAdmin && expert.userId !== params.expertUserId) {
    throw new Error("Only the expert or an admin can respond to this session");
  }
  if (!["PAID", "SCHEDULED"].includes(session.status)) {
    throw new Error("This session can no longer be modified");
  }
  const tz = expert.timezone || "Asia/Kolkata";

  if (params.action === "ACCEPT") {
    const updated = await prisma.expertSession.update({
      where: { id: session.id },
      data: {
        expertAcceptance: "ACCEPTED",
        expertRespondedAt: new Date(),
        ...(session.scheduledAt ? { status: "SCHEDULED" } : {}),
      },
    });
    notify(
      updated.userId,
      "BOOKING_CONFIRMED",
      "Session confirmed",
      "Your expert confirmed your session time.",
      { sessionId: updated.id.toString() },
      true,
    );
    return updated;
  }

  if (params.action === "DECLINE") {
    const declinedAt = new Date();
    const data: Prisma.ExpertSessionUpdateInput = {
      status: "CANCELLED",
      cancelledAt: declinedAt,
      cancelledBy: "EXPERT",
      cancelReason:
        params.reason?.trim() || "The expert is unavailable at this time",
      expertAcceptance: "DECLINED",
      expertRespondedAt: declinedAt,
    };
    if (session.paymentStatus === "COMPLETED") {
      data.refundStatus = "REQUIRED";
      if (session.scheduledAt) {
        data.cancellationNoticeHours = Math.round(
          (session.scheduledAt.getTime() - declinedAt.getTime()) /
            (60 * 60 * 1000),
        );
      }
    }
    const updated = await prisma.expertSession.update({
      where: { id: session.id },
      data,
    });
    notify(
      updated.userId,
      "BOOKING_CANCELLED",
      "Session declined",
      updated.paymentStatus === "COMPLETED"
        ? "Your expert couldn't take this session. A refund will be processed manually by our team."
        : "Your expert couldn't take this session.",
      { sessionId: updated.id.toString() },
      true,
    );
    return updated;
  }

  // RESCHEDULE
  if (!params.scheduledAt)
    throw new Error("A new time is required to reschedule");
  const when = new Date(params.scheduledAt);
  await assertSlotBookable(expert, when, session.id);
  const updated = await prisma.expertSession.update({
    where: { id: session.id },
    data: {
      scheduledAt: when,
      status: "SCHEDULED",
      expertAcceptance: "ACCEPTED",
      expertRespondedAt: new Date(),
    },
  });
  notify(
    updated.userId,
    "BOOKING_STATUS_UPDATED",
    "Session rescheduled",
    `Your expert moved your session to ${when.toLocaleString("en-IN", { timeZone: tz })}.`,
    { sessionId: updated.id.toString() },
    true,
  );
  return updated;
};

export const cancelExpertSession = async (params: {
  sessionId: string;
  actorUserId: string;
  role?: string | undefined;
  reason?: string | undefined;
}) => {
  const session = await prisma.expertSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session) throw new Error("Session not found");

  const isAdmin = params.role === "Admin";
  const expert = await prisma.expert.findUnique({
    where: { id: session.expertId },
    select: { userId: true },
  });
  const isExpert = expert?.userId === params.actorUserId;
  const isClient = session.userId === params.actorUserId;
  if (!isAdmin && !isExpert && !isClient) {
    throw new Error("You are not authorized to cancel this session");
  }
  if (session.status === "COMPLETED")
    throw new Error("A completed session cannot be cancelled");
  if (session.status === "CANCELLED") return session;

  const by = isAdmin ? "ADMIN" : isExpert ? "EXPERT" : "CLIENT";
  const cancelledAt = new Date();
  const data: Prisma.ExpertSessionUpdateInput = {
    status: "CANCELLED",
    cancelledAt,
    cancelledBy: by,
    cancelReason: params.reason?.trim() ?? null,
  };
  // Paid sessions require a manual refund (handled by admin/finance). We record
  // how much notice was given so admin can apply their own late-cancellation
  // judgment when processing it — the app never auto-forfeits the payment.
  if (session.paymentStatus === "COMPLETED") {
    data.refundStatus = "REQUIRED";
    if (session.scheduledAt) {
      data.cancellationNoticeHours = Math.round(
        (session.scheduledAt.getTime() - cancelledAt.getTime()) /
          (60 * 60 * 1000),
      );
    }
  }
  const updated = await prisma.expertSession.update({
    where: { id: session.id },
    data,
  });

  const expertUserId = expert?.userId;
  // Notify the other party.
  if (isClient && expertUserId) {
    notify(
      expertUserId,
      "BOOKING_CANCELLED",
      "Session cancelled",
      "A client cancelled their session with you.",
      { sessionId: updated.id.toString() },
      true,
    );
  } else {
    notify(
      updated.userId,
      "BOOKING_CANCELLED",
      "Session cancelled",
      updated.paymentStatus === "COMPLETED"
        ? "Your session was cancelled. A refund will be processed manually by our team."
        : "Your session was cancelled.",
      { sessionId: updated.id.toString() },
      true,
    );
  }
  return updated;
};

const recomputeExpertRating = async (expertId: string) => {
  const agg = await prisma.expertSession.aggregate({
    where: {
      expertId,
      reviewed: true,
      reviewHidden: { not: true },
      rating: { gte: 1 },
    },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const avg = agg._avg.rating || 0;
  const count = agg._count._all || 0;
  await prisma.expert.update({
    where: { id: expertId },
    data: {
      rating: Math.round(avg * 10) / 10,
      reviewCount: count,
    },
  });
};

export const reviewExpertSession = async (params: {
  sessionId: string;
  userId: string;
  rating: number;
  review?: string;
  anonymous?: boolean;
}) => {
  const session = await prisma.expertSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session) throw new Error("Session not found");
  assertSessionOwner(session, params.userId);
  if (session.status !== "COMPLETED")
    throw new Error("You can only review a completed session");
  if (session.reviewed)
    throw new Error("You have already reviewed this session");
  if (params.rating < 1 || params.rating > 5)
    throw new Error("Rating must be between 1 and 5");

  const updated = await prisma.expertSession.update({
    where: { id: session.id },
    data: {
      reviewed: true,
      rating: params.rating,
      review: params.review?.trim() ?? null,
      reviewAnonymous: Boolean(params.anonymous),
      reviewedAt: new Date(),
    },
  });

  await recomputeExpertRating(updated.expertId);

  const expertUserId = await expertUserIdOf(updated.expertId);
  if (expertUserId) {
    notify(
      expertUserId,
      "REVIEW_POSTED",
      "New review",
      `You received a ${params.rating}-star review.`,
      { sessionId: updated.id.toString() },
    );
  }
  return updated;
};

/** Admin: hide/unhide a review and recompute the aggregate rating. */
export const setReviewHidden = async (sessionId: string, hidden: boolean) => {
  const session = await prisma.expertSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error("Session not found");
  const updated = await prisma.expertSession.update({
    where: { id: session.id },
    data: { reviewHidden: hidden },
  });
  await recomputeExpertRating(updated.expertId);
  return updated;
};

/** Admin/finance: mark a required manual refund as done, triggering a PhonePe reversal where possible. */
export const markSessionRefundDone = async (sessionId: string) => {
  const session = await prisma.expertSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error("Session not found");
  if (session.refundStatus !== "REQUIRED") {
    throw new Error("This session has no pending refund");
  }

  if (session.merchantOrderId) {
    try {
      const refundMerchantId = `EXPERT-REFUND-${Date.now()}-${session.id.toString().slice(-6)}`;
      await initiatePhonePeRefund({
        merchantRefundId: refundMerchantId,
        originalMerchantOrderId: session.merchantOrderId,
        amount: session.amount, // ExpertSession.amount is in rupees
      });
    } catch (refundError) {
      console.error(
        `PhonePe refund failed for expert session ${sessionId} — manual transfer required:`,
        refundError,
      );
      // Do not block the status update; the admin has acknowledged this refund
      // is required and will process it via bank transfer if PhonePe fails.
    }
  } else {
    console.warn(
      `Expert session ${sessionId} has no merchantOrderId — cannot auto-refund via PhonePe. Manual bank transfer required.`,
    );
  }

  const updated = await prisma.expertSession.update({
    where: { id: session.id },
    data: { refundStatus: "MANUAL_DONE" },
  });
  notify(
    updated.userId,
    "PAYMENT_REFUND",
    "Refund processed",
    `Your refund of ₹${updated.amount.toLocaleString("en-IN")} has been processed.`,
    { sessionId: updated.id.toString() },
    true,
  );
  return updated;
};

/** Admin/finance: mark a completed session's payout to the expert as done (early, ahead of the 24h auto-release). */
export const markSessionPayoutDone = async (sessionId: string) => {
  const session = await prisma.expertSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw new Error("Session not found");
  if (session.status !== "COMPLETED" || session.paymentStatus !== "COMPLETED") {
    throw new Error("This session has no payout to release");
  }
  if (session.payoutStatus === "PAID") {
    throw new Error("This session's payout has already been marked paid");
  }
  const updated = await prisma.expertSession.update({
    where: { id: session.id },
    data: { payoutStatus: "PAID", payoutPaidAt: new Date() },
  });
  const expertUserId = await expertUserIdOf(updated.expertId);
  if (expertUserId) {
    notify(
      expertUserId,
      "PAYOUT_PROCESSED",
      "Payout released",
      `Your payout of ₹${updated.amount} for a completed session has been released.`,
      { sessionId: updated.id.toString() },
      true,
    );
  }
  return updated;
};

// ── Reads ────────────────────────────────────────────────────────────────────

export const getExpertSessionForUser = async (params: {
  sessionId: string;
  userId: string;
  isAdmin?: boolean;
}) => {
  const session = await prisma.expertSession.findUnique({
    where: { id: params.sessionId },
  });
  if (!session) throw new Error("Session not found");

  const expertRow = await prisma.expert.findUnique({
    where: { id: session.expertId },
    include: { weeklyAvailability: true },
  });
  const expert = expertRow ? await attachExpertUser(expertRow) : null;
  const isClient = session.userId === params.userId;
  const isExpert = !!expertRow && expertRow.userId === params.userId;
  if (!isClient && !isExpert && !params.isAdmin) {
    throw new Error("You are not authorized to view this session");
  }
  return serializeSession(session, {
    ...(expert ? { expert: serializeExpert(expert) } : {}),
    ...(expertRow?.inPersonAddress
      ? { expertInPersonAddress: expertRow.inPersonAddress }
      : {}),
  });
};

export const listUserExpertSessions = async (userId: string) => {
  const sessions = await prisma.expertSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const expertIds = [...new Set(sessions.map((s) => s.expertId))];
  const experts = await prisma.expert.findMany({
    where: { id: { in: expertIds } },
    include: { weeklyAvailability: true },
  });
  const withUsers = await attachExpertUsers(experts);
  const byId = new Map(withUsers.map((e) => [e.id, e]));
  return sessions.map((s) => {
    const e = byId.get(s.expertId);
    return serializeSession(s, {
      ...(e ? { expert: serializeExpert(e) } : {}),
      ...(e?.inPersonAddress
        ? { expertInPersonAddress: e.inPersonAddress }
        : {}),
    });
  });
};

export const listExpertOwnSessions = async (expertUserId: string) => {
  const expert = await prisma.expert.findUnique({
    where: { userId: expertUserId },
    select: { id: true, timezone: true },
  });
  if (!expert) return [];
  const tz = expert.timezone || "Asia/Kolkata";
  const sessions = await prisma.expertSession.findMany({
    where: { expertId: expert.id },
    orderBy: { createdAt: "desc" },
  });
  const userIds = [...new Set(sessions.map((s) => s.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return sessions.map((s) =>
    serializeSession(s, {
      clientName: byId.get(s.userId)?.name || "Client",
      expertTimezone: tz,
    }),
  );
};

/** Admin: an expert's sessions plus an earnings summary. */
export const getExpertSessionsForAdmin = async (expertId: string) => {
  const expertDoc = await prisma.expert.findUnique({
    where: { id: expertId },
    select: { timezone: true },
  });
  const tz = expertDoc?.timezone || "Asia/Kolkata";
  const sessions = await prisma.expertSession.findMany({
    where: { expertId },
    orderBy: { createdAt: "desc" },
  });
  const userIds = [...new Set(sessions.map((s) => s.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const paid = sessions.filter((s) => s.paymentStatus === "COMPLETED");
  const grossEarnings = paid.reduce((sum, s) => sum + (s.amount || 0), 0);
  const refundsPending = sessions
    .filter((s) => s.refundStatus === "REQUIRED")
    .reduce((sum, s) => sum + (s.amount || 0), 0);
  const completedPaid = sessions.filter(
    (s) => s.status === "COMPLETED" && s.paymentStatus === "COMPLETED",
  );
  const payoutPending = completedPaid
    .filter((s) => (s.payoutStatus || "PENDING") === "PENDING")
    .reduce((sum, s) => sum + (s.amount || 0), 0);
  const payoutReleased = completedPaid
    .filter((s) => s.payoutStatus === "PAID")
    .reduce((sum, s) => sum + (s.amount || 0), 0);
  return {
    sessions: sessions.map((s) =>
      serializeSession(s, {
        clientName: byId.get(s.userId)?.name || "Client",
        expertTimezone: tz,
      }),
    ),
    summary: {
      total: sessions.length,
      completed: sessions.filter((s) => s.status === "COMPLETED").length,
      upcoming: sessions.filter((s) => s.status === "SCHEDULED").length,
      grossEarnings,
      refundsPending,
      payoutPending,
      payoutReleased,
    },
  };
};

// ── Webhook reconciliation (idempotent; runs from the Outbox worker) ──────────

const asRec = (v: unknown): Record<string, any> =>
  v && typeof v === "object" ? (v as Record<string, any>) : {};

const pickString = (...vals: unknown[]): string | undefined => {
  for (const v of vals) if (typeof v === "string" && v) return v;
  return undefined;
};

/**
 * Reconcile an expert session payment from a PhonePe webhook payload.
 * Only handles merchant order IDs prefixed "EXP_"; returns null otherwise so
 * the shared webhook dispatcher can try other handlers. Idempotent on the
 * unique `merchantOrderId` (settlement guarded by the wasPaid check in
 * applyExpertPaymentSuccess).
 */
export const reconcileExpertSessionPaymentFromWebhookPayload = async (
  rawPayload: unknown,
): Promise<ExpertSession | null> => {
  const payload = asRec(rawPayload);
  const inner = asRec(payload.payload);
  const data = asRec(payload.data);

  const merchantOrderId = pickString(
    payload.originalMerchantOrderId,
    payload.merchantOrderId,
    inner.originalMerchantOrderId,
    inner.merchantOrderId,
    data.originalMerchantOrderId,
    data.merchantOrderId,
    asRec(inner.paymentDetails).merchantOrderId,
    asRec(data.paymentDetails).merchantOrderId,
  );
  if (!merchantOrderId || !merchantOrderId.startsWith("EXP_")) return null;

  const session = await prisma.expertSession.findUnique({
    where: { merchantOrderId },
  });
  if (!session) return null;

  const rawState = pickString(
    payload.state,
    inner.state,
    data.state,
    asRec(inner.paymentDetails).state,
    asRec(data.paymentDetails).state,
  );
  const upper = (rawState || "").toUpperCase();

  const callbackPayload = payload as Prisma.InputJsonValue;

  if (["COMPLETED", "SUCCESS", "PAYMENT_SUCCESS"].includes(upper)) {
    const updated = await applyExpertPaymentSuccess(session, {
      callbackPayload,
    });
    console.info(`[ExpertWebhook] payment confirmed for session ${session.id}`);
    return updated;
  } else if (
    ["FAILED", "PAYMENT_ERROR", "PAYMENT_DECLINED"].includes(upper) &&
    session.paymentStatus !== "COMPLETED"
  ) {
    const updated = await prisma.expertSession.update({
      where: { id: session.id },
      data: {
        callbackPayload,
        paymentStatus: "FAILED",
        ...(session.status === "PENDING_PAYMENT"
          ? {
              status: "CANCELLED",
              cancelledBy: "SYSTEM",
              cancelReason: "Payment failed",
              cancelledAt: new Date(),
              holdExpiresAt: null,
            }
          : {}),
      },
    });
    console.info(`[ExpertWebhook] payment failed for session ${session.id}`);
    return updated;
  }

  return prisma.expertSession.update({
    where: { id: session.id },
    data: { callbackPayload },
  });
};

// ── Background maintenance (called by scheduledJobs) ──────────────────────────

/** Expire unpaid holds so their slot frees up. */
export const expireUnpaidExpertHolds = async (): Promise<number> => {
  const now = new Date();
  const result = await prisma.expertSession.updateMany({
    where: {
      status: "PENDING_PAYMENT",
      holdExpiresAt: { lte: now },
    },
    data: {
      status: "CANCELLED",
      cancelledBy: "SYSTEM",
      cancelledAt: now,
      cancelReason: "Payment not completed in time",
    },
  });
  return result.count;
};

/** Auto-complete scheduled sessions whose end time has passed. */
export const autoCompleteExpertSessions = async (): Promise<number> => {
  const now = new Date();
  const candidates = await prisma.expertSession.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true, scheduledAt: true, durationMinutes: true, userId: true },
  });
  let count = 0;
  for (const s of candidates) {
    const end = new Date(
      new Date(s.scheduledAt as Date).getTime() +
        (s.durationMinutes || 60) * 60_000,
    );
    if (end > now) continue;
    const updated = await prisma.expertSession.updateMany({
      where: { id: s.id, status: "SCHEDULED" },
      data: { status: "COMPLETED", autoCompleted: true, completedAt: now },
    });
    if (updated.count > 0) {
      count += 1;
      notify(
        s.userId,
        "REVIEW_REMINDER",
        "How was your session?",
        "Your expert session is complete. Leave a rating and feedback to help others.",
        { sessionId: s.id.toString() },
        true,
      );
    }
  }
  return count;
};

/**
 * Nudge the expert to add a meeting link when an ONLINE session is starting
 * soon and still has none. Fires once per session (deduped via
 * meetingLinkNudgeSentAt). Window is generous (up to 3h out) since the
 * cleanup job itself only polls every 15–60 minutes.
 */
export const sendExpertMeetingLinkNudges = async (): Promise<number> => {
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 60 * 60_000);
  const candidates = await prisma.expertSession.findMany({
    where: {
      status: "SCHEDULED",
      mode: "ONLINE",
      OR: [{ meetingLink: null }, { meetingLink: "" }],
      scheduledAt: { gte: now, lte: soon },
      meetingLinkNudgeSentAt: null,
    },
    select: { id: true, expertId: true, scheduledAt: true },
  });
  let count = 0;
  for (const s of candidates) {
    const updated = await prisma.expertSession.updateMany({
      where: { id: s.id, meetingLinkNudgeSentAt: null },
      data: { meetingLinkNudgeSentAt: now },
    });
    if (updated.count === 0) continue;
    count += 1;
    const expertUserId = await expertUserIdOf(s.expertId);
    if (expertUserId) {
      notify(
        expertUserId,
        "SESSION_LINK_REQUIRED",
        "Add your meeting link",
        `Your session on ${new Date(s.scheduledAt as Date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} is coming up and still needs a meeting link.`,
        { sessionId: s.id.toString() },
        true,
      );
    }
  }
  return count;
};

/**
 * "Your session starts soon" reminder to both parties, with whatever
 * connection details are available (meeting link for ONLINE, address for
 * IN_PERSON). Fires once per session (deduped via startReminderSentAt).
 */
export const sendSessionStartReminders = async (): Promise<number> => {
  const now = new Date();
  const soon = new Date(now.getTime() + 2 * 60 * 60_000);
  const candidates = await prisma.expertSession.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { gte: now, lte: soon },
      startReminderSentAt: null,
    },
    select: {
      id: true,
      expertId: true,
      userId: true,
      scheduledAt: true,
      mode: true,
      meetingLink: true,
    },
  });
  let count = 0;
  for (const s of candidates) {
    const updated = await prisma.expertSession.updateMany({
      where: { id: s.id, startReminderSentAt: null },
      data: { startReminderSentAt: now },
    });
    if (updated.count === 0) continue;
    count += 1;

    const when = new Date(s.scheduledAt as Date).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });
    let clientDetail = "";
    let expertDetail = "";
    if (s.mode === "ONLINE") {
      clientDetail = s.meetingLink
        ? ` Join here: ${s.meetingLink}`
        : " Your expert hasn't shared a meeting link yet — check back shortly.";
      expertDetail = s.meetingLink
        ? ` Your meeting link: ${s.meetingLink}`
        : " Don't forget to add a meeting link.";
    } else if (s.mode === "IN_PERSON") {
      const expertDoc = await prisma.expert.findUnique({
        where: { id: s.expertId },
        select: { inPersonAddress: true },
      });
      const address = expertDoc?.inPersonAddress;
      clientDetail = address
        ? ` Location: ${address}`
        : " Contact your expert for the exact location.";
    }

    notify(
      s.userId,
      "BOOKING_REMINDER",
      "Your session starts soon",
      `Your session is scheduled for ${when}.${clientDetail}`,
      { sessionId: s.id.toString() },
      true,
    );

    const expertUserId = await expertUserIdOf(s.expertId);
    if (expertUserId) {
      notify(
        expertUserId,
        "BOOKING_REMINDER",
        "Your session starts soon",
        `Your session is scheduled for ${when}.${expertDetail}`,
        { sessionId: s.id.toString() },
        true,
      );
    }
  }
  return count;
};

/**
 * Auto-release expert payouts 24 hours after session completion, mirroring
 * releaseCompletedBookingPayments() for venue/coach bookings. Anchored on
 * `completedAt` (not `updatedAt`, which a later review submission bumps).
 */
export const releaseExpertSessionPayouts = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const candidates = await prisma.expertSession.findMany({
    where: {
      status: "COMPLETED",
      paymentStatus: "COMPLETED",
      payoutStatus: "PENDING",
      completedAt: { lte: cutoff },
    },
    select: { id: true, expertId: true, amount: true },
  });
  let count = 0;
  for (const s of candidates) {
    const now = new Date();
    const updated = await prisma.expertSession.updateMany({
      where: { id: s.id, payoutStatus: "PENDING" },
      data: { payoutStatus: "PAID", payoutPaidAt: now },
    });
    if (updated.count > 0) {
      count += 1;
      const expertUserId = await expertUserIdOf(s.expertId);
      if (expertUserId) {
        notify(
          expertUserId,
          "PAYOUT_PROCESSED",
          "Payout released",
          `Your payout of ₹${s.amount} for a completed session has been released.`,
          { sessionId: s.id.toString() },
          true,
        );
      }
    }
  }
  return count;
};

/** Nudge clients who completed a session but haven't reviewed (once). */
export const sendExpertReviewReminders = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sessions = await prisma.expertSession.findMany({
    where: {
      status: "COMPLETED",
      reviewed: false,
      reviewReminderSentAt: null,
      updatedAt: { lte: cutoff },
    },
    select: { id: true, userId: true },
  });
  let count = 0;
  for (const s of sessions) {
    notify(
      s.userId,
      "REVIEW_REMINDER",
      "Rate your expert session",
      "You haven't reviewed your recent expert session yet — your feedback helps other players.",
      { sessionId: s.id.toString() },
      true,
    );
    await prisma.expertSession.updateMany({
      where: { id: s.id },
      data: { reviewReminderSentAt: new Date() },
    });
    count += 1;
  }
  return count;
};
