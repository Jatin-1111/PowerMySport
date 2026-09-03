import { Request, Response } from "express";
import {
  createExpertByAdmin,
  listExpertsForAdmin,
  listActiveExperts,
  getExpertById,
  getExpertReviews,
  getExpertOpenSlots,
  initiateExpertSession,
  reconcileExpertSession,
  scheduleExpertSession,
  completeExpertSession,
  updateExpertSessionMom,
  reviewExpertSession,
  cancelExpertSession,
  respondToExpertSession,
  setSessionMeetingLink,
  getExpertSessionForUser,
  getExpertSessionPlayerDetail,
  listUserExpertSessions,
  listExpertOwnSessions,
  getMyExpertProfile,
  updateMyExpertProfile,
  updateExpertByAdmin,
  setExpertActive,
  getExpertSessionsForAdmin,
  markSessionRefundDone,
  setReviewHidden,
  submitExpertForReview,
  approveExpert,
  rejectExpert,
} from "../services/ExpertsService";
import {
  sendExpertAdminCredentialsEmail,
  sendExpertApprovedEmail,
  sendExpertRejectedEmail,
} from "../../utils/email";
import { Expert } from "../models/ExpertProfile";
import { User } from "../models/User";
import { ExpertSession } from "../models/ExpertBooking";
import {
  renderInvoicePdf,
  formatInvoiceDate,
  type InvoiceData,
  type InvoiceDetailField,
} from "../../shared/services/InvoiceService";
import { guessPlaceOfSupply } from "../../shared/utils/invoiceGst";
import { extractPhonePePaymentMethodLabel } from "../../shared/utils/paymentMethod";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("experts");

const fail = (res: Response, error: unknown, code = 400) =>
  res.status(code).json({
    success: false,
    message: error instanceof Error ? error.message : "Request failed",
  });

const num = (v: unknown) => (v == null ? undefined : Number(v));

export const getExperts = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await listActiveExperts({
      sport: typeof req.query.sport === "string" ? req.query.sport : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      page: num(req.query.page),
      limit: num(req.query.limit),
    });
    res.json({
      success: true,
      message: "Experts retrieved",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (e) {
    fail(res, e, 500);
  }
};

export const getExpert = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await getExpertById(req.params.expertId as string);
    res.json({ success: true, message: "Expert retrieved", data });
  } catch (e) {
    fail(res, e, 404);
  }
};

export const getReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await getExpertReviews(req.params.expertId as string);
    res.json({ success: true, message: "Reviews retrieved", data });
  } catch (e) {
    fail(res, e, 500);
  }
};

export const createExpert = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, sessionFee } = req.body as Record<string, unknown>;
    if (!name || !email || !phone || sessionFee == null) {
      res.status(400).json({
        success: false,
        message: "name, email, phone and sessionFee are required",
      });
      return;
    }
    const { expert, temporaryPassword, user } = await createExpertByAdmin({
      name: String(name),
      email: String(email),
      phone: String(phone),
      bio: req.body.bio,
      sports: req.body.sports,
      expertise: req.body.expertise,
      achievements: req.body.achievements,
      sessionFee: Number(sessionFee),
      sessionMode: req.body.sessionMode,
      sessionDurationMinutes: req.body.sessionDurationMinutes
        ? Number(req.body.sessionDurationMinutes)
        : undefined,
      timezone: req.body.timezone,
      weeklyAvailability: Array.isArray(req.body.weeklyAvailability)
        ? req.body.weeklyAvailability
        : undefined,
      blackoutDates: Array.isArray(req.body.blackoutDates) ? req.body.blackoutDates : undefined,
      city: req.body.city,
      languages: req.body.languages,
      photoUrl: req.body.photoUrl,
      photoKey: req.body.photoKey,
      createdBy: req.user?.id,
    });

    sendExpertAdminCredentialsEmail({
      name: user.name,
      email: user.email,
      password: temporaryPassword,
      loginUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`,
    }).catch((err: unknown) => log.error("Failed to send expert credentials email:", err));

    res.status(201).json({
      success: true,
      message: "Expert created and credentials emailed",
      data: expert,
    });
  } catch (e) {
    fail(res, e);
  }
};

export const listExpertsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await listExpertsForAdmin({
      page: num(req.query.page),
      limit: num(req.query.limit),
      verificationStatus:
        typeof req.query.verificationStatus === "string" ? req.query.verificationStatus : undefined,
    });
    res.json({
      success: true,
      message: "Experts retrieved",
      data: result.data,
      pagination: result.pagination,
      pendingCount: result.pendingCount,
    });
  } catch (e) {
    fail(res, e, 500);
  }
};

const requireAuth = (req: Request, res: Response): string | null => {
  if (!req.user?.id) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  return req.user.id;
};

export const initiateSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    if (!req.body?.scheduledAt) {
      res.status(400).json({ success: false, message: "scheduledAt is required" });
      return;
    }
    const data = await initiateExpertSession({
      expertId: req.params.expertId as string,
      userId,
      scheduledAt: String(req.body.scheduledAt),
      clientNote: req.body?.clientNote,
      mode: req.body?.mode,
      playerId: req.body?.playerId,
    });
    res.status(201).json({ success: true, message: "Payment initiated", data });
  } catch (e) {
    fail(res, e);
  }
};

export const reconcileSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const session = await reconcileExpertSession({
      sessionId: req.params.sessionId as string,
      userId,
    });
    res.json({ success: true, message: "Payment reconciled", data: session });
  } catch (e) {
    fail(res, e);
  }
};

export const getSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const data = await getExpertSessionForUser({
      sessionId: req.params.sessionId as string,
      userId,
      isAdmin: req.user?.role === "Admin",
    });
    res.json({ success: true, message: "Session retrieved", data });
  } catch (e) {
    fail(res, e, 404);
  }
};

export const getSessionPlayerDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const data = await getExpertSessionPlayerDetail({
      sessionId: req.params.sessionId as string,
      expertUserId: userId,
    });
    res.json({ success: true, message: "Player detail retrieved", data });
  } catch (e) {
    fail(res, e, 404);
  }
};

/**
 * Download expert session invoice PDF
 * GET /experts/sessions/:sessionId/invoice/pdf
 */
export const downloadSessionInvoicePdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const sessionId = req.params.sessionId as string;
    const session = await ExpertSession.findById(sessionId);
    if (!session) {
      res.status(404).json({ success: false, message: "Session not found" });
      return;
    }

    const expert = await Expert.findById(session.expertId).populate("userId", "name email phone");
    const expertUser = expert?.userId as unknown as { _id: unknown; name?: string } | undefined;

    const isClient = session.userId.toString() === userId;
    const isExpert = expertUser?._id?.toString() === userId;
    const isAdmin = req.user?.role === "Admin";
    if (!isClient && !isExpert && !isAdmin) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    if (session.paymentStatus !== "COMPLETED") {
      res.status(409).json({
        success: false,
        message: "Invoice will be available once payment is confirmed.",
      });
      return;
    }

    const client = await User.findById(session.userId).select("name email phone");

    const bookingDate = session.scheduledAt ? new Date(session.scheduledAt) : session.createdAt;
    const invoiceNumber = `INV-${bookingDate
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${session.id.slice(-6).toUpperCase()}`;
    const sessionRefId = `EXP-${session.id.slice(-6).toUpperCase()}`;

    let dateLabel = "-";
    let timeLabel = "-";
    if (session.scheduledAt) {
      const start = new Date(session.scheduledAt);
      const end = new Date(start.getTime() + session.durationMinutes * 60000);
      const fmtTime = (d: Date) =>
        d.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      dateLabel = formatInvoiceDate(start);
      timeLabel = `${fmtTime(start)} — ${fmtTime(end)}`;
    }

    const sport = expert?.sports?.[0];
    const expertName = expertUser?.name || "Expert";

    const detailFields: InvoiceDetailField[] = [
      { label: "Expert", value: expertName },
      { label: "Sport", value: sport || "-" },
      {
        label: "Session mode",
        value:
          session.mode === "ONLINE"
            ? "Online — Video call"
            : session.mode === "IN_PERSON"
              ? "In-person"
              : "-",
      },
      { label: "Date", value: dateLabel },
      { label: "Time (IST)", value: timeLabel },
      { label: "Session ID", value: sessionRefId, mono: true },
    ];

    const invoiceData: InvoiceData = {
      invoiceNumber,
      issueDate: new Date(),
      subtitle: "Tax Invoice",
      billedTo: {
        name: client?.name || "Customer",
        email: client?.email || "-",
        phone: client?.phone || "-",
      },
      placeOfSupply:
        session.mode === "IN_PERSON" ? guessPlaceOfSupply(expert?.inPersonAddress) : "-",
      detailsSectionTitle: "Session details",
      detailsBadge: session.status === "COMPLETED" ? "Completed" : "Scheduled",
      detailFields,
      lineItems: [
        {
          description: `1:1 Expert Guidance Session${sport ? ` — ${sport}` : ""}`,
          note: `${session.durationMinutes} minutes with ${expertName} · SAC 999293`,
          qty: 1,
          rate: session.amount,
        },
      ],
      payment: {
        method: extractPhonePePaymentMethodLabel(session),
        merchantOrderId: session.merchantOrderId,
        transactionId: session.phonepeOrderId,
        paidAt: session.paidAt,
      },
      discountAmount: 0,
      gstRatePercent: 0,
      gstAmount: 0,
      totalAmount: session.amount,
    };

    const pdfBuffer = await renderInvoicePdf(invoiceData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoiceNumber}.pdf"`);
    res.status(200).send(pdfBuffer);
  } catch (e) {
    fail(res, e, 500);
  }
};

export const scheduleSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    if (!req.body?.scheduledAt) {
      res.status(400).json({ success: false, message: "scheduledAt is required" });
      return;
    }
    const session = await scheduleExpertSession({
      sessionId: req.params.sessionId as string,
      userId,
      scheduledAt: String(req.body.scheduledAt),
      mode: req.body?.mode,
    });
    res.json({ success: true, message: "Session scheduled", data: session });
  } catch (e) {
    fail(res, e);
  }
};

export const completeSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const session = await completeExpertSession({
      sessionId: req.params.sessionId as string,
      actorUserId: userId,
      isAdmin: req.user?.role === "Admin",
      momNotes: req.body?.momNotes,
    });
    res.json({ success: true, message: "Session completed", data: session });
  } catch (e) {
    fail(res, e);
  }
};

export const updateSessionMom = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const session = await updateExpertSessionMom({
      sessionId: req.params.sessionId as string,
      actorUserId: userId,
      isAdmin: req.user?.role === "Admin",
      momNotes: req.body?.momNotes,
    });
    res.json({ success: true, message: "Notes updated", data: session });
  } catch (e) {
    fail(res, e);
  }
};

export const reviewSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const session = await reviewExpertSession({
      sessionId: req.params.sessionId as string,
      userId,
      rating: Number(req.body?.rating),
      review: req.body?.review,
      anonymous: Boolean(req.body?.anonymous),
    });
    res.json({ success: true, message: "Review submitted", data: session });
  } catch (e) {
    fail(res, e);
  }
};

export const mySessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const data = await listUserExpertSessions(userId);
    res.json({ success: true, message: "Sessions retrieved", data });
  } catch (e) {
    fail(res, e, 500);
  }
};

export const expertSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const data = await listExpertOwnSessions(userId);
    res.json({ success: true, message: "Sessions retrieved", data });
  } catch (e) {
    fail(res, e, 500);
  }
};

export const getAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await getExpertOpenSlots(
      req.params.expertId as string,
      typeof req.query.from === "string" ? req.query.from : undefined,
      typeof req.query.to === "string" ? req.query.to : undefined
    );
    res.json({ success: true, message: "Availability retrieved", data });
  } catch (e) {
    fail(res, e, 404);
  }
};

export const cancelSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const session = await cancelExpertSession({
      sessionId: req.params.sessionId as string,
      actorUserId: userId,
      role: req.user?.role,
      reason: req.body?.reason,
    });
    res.json({ success: true, message: "Session cancelled", data: session });
  } catch (e) {
    fail(res, e);
  }
};

export const respondSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const action = String(req.body?.action || "").toUpperCase();
    if (!["ACCEPT", "DECLINE", "RESCHEDULE"].includes(action)) {
      res.status(400).json({
        success: false,
        message: "action must be ACCEPT, DECLINE or RESCHEDULE",
      });
      return;
    }
    const session = await respondToExpertSession({
      sessionId: req.params.sessionId as string,
      expertUserId: userId,
      isAdmin: req.user?.role === "Admin",
      action: action as "ACCEPT" | "DECLINE" | "RESCHEDULE",
      scheduledAt: req.body?.scheduledAt ? String(req.body.scheduledAt) : undefined,
      reason: req.body?.reason,
    });
    res.json({ success: true, message: "Response recorded", data: session });
  } catch (e) {
    fail(res, e);
  }
};

export const updateMeetingLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    if (typeof req.body?.meetingLink !== "string") {
      res.status(400).json({ success: false, message: "meetingLink is required" });
      return;
    }
    const session = await setSessionMeetingLink({
      sessionId: req.params.sessionId as string,
      actorUserId: userId,
      isAdmin: req.user?.role === "Admin",
      meetingLink: req.body.meetingLink,
    });
    res.json({ success: true, message: "Meeting link updated", data: session });
  } catch (e) {
    fail(res, e);
  }
};

// ── Expert self-service ──────────────────────────────────────────────────────

export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const data = await getMyExpertProfile(userId);
    res.json({ success: true, message: "Profile retrieved", data });
  } catch (e) {
    fail(res, e, 404);
  }
};

export const updateMyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const data = await updateMyExpertProfile(userId, req.body || {});
    res.json({ success: true, message: "Profile updated", data });
  } catch (e) {
    fail(res, e);
  }
};

// ── Admin management ─────────────────────────────────────────────────────────

export const updateExpertAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await updateExpertByAdmin(req.params.expertId as string, req.body || {});
    res.json({ success: true, message: "Expert updated", data });
  } catch (e) {
    fail(res, e);
  }
};

export const setExpertActiveAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await setExpertActive(req.params.expertId as string, Boolean(req.body?.isActive));
    res.json({ success: true, message: "Expert status updated", data });
  } catch (e) {
    fail(res, e);
  }
};

export const expertSessionsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await getExpertSessionsForAdmin(req.params.expertId as string);
    res.json({ success: true, message: "Sessions retrieved", data });
  } catch (e) {
    fail(res, e, 500);
  }
};

export const refundDoneAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const session = await markSessionRefundDone(req.params.sessionId as string);
    res.json({
      success: true,
      message: "Refund marked as done",
      data: session,
    });
  } catch (e) {
    fail(res, e);
  }
};

export const hideReviewAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const session = await setReviewHidden(
      req.params.sessionId as string,
      req.body?.hidden !== false
    );
    res.json({
      success: true,
      message: "Review visibility updated",
      data: session,
    });
  } catch (e) {
    fail(res, e);
  }
};

// ── Expert self-serve review submission ──────────────────────────────────────

export const submitForReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const data = await submitExpertForReview(userId);
    res.json({ success: true, message: "Profile submitted for review", data });
  } catch (e) {
    fail(res, e);
  }
};

// ── Admin approve / reject ────────────────────────────────────────────────────

export const approveExpertAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await approveExpert(req.params.expertId as string);

    // Send approval email (best-effort)
    if (data.email) {
      sendExpertApprovedEmail({
        name: data.name || "Expert",
        email: data.email,
        dashboardUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/expert/dashboard`,
      }).catch((err: unknown) => log.error("Failed to send expert approval email:", err));
    }

    res.json({ success: true, message: "Expert approved and is now live", data });
  } catch (e) {
    fail(res, e);
  }
};

export const rejectExpertAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const reason = req.body?.reason;
    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      res
        .status(400)
        .json({ success: false, message: "A rejection reason (min 5 characters) is required" });
      return;
    }
    const data = await rejectExpert(req.params.expertId as string, reason);

    // Send rejection email (best-effort)
    if (data.email) {
      sendExpertRejectedEmail({
        name: data.name || "Expert",
        email: data.email,
        reason: reason.trim(),
        dashboardUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/expert/onboarding`,
      }).catch((err: unknown) => log.error("Failed to send expert rejection email:", err));
    }

    res.json({ success: true, message: "Expert profile rejected", data });
  } catch (e) {
    fail(res, e);
  }
};
