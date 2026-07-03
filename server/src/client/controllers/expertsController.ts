import { Request, Response } from "express";
import {
  createExpertByAdmin,
  listExpertsForAdmin,
  listActiveExperts,
  getExpertById,
  getExpertReviews,
  initiateExpertSession,
  reconcileExpertSession,
  scheduleExpertSession,
  completeExpertSession,
  reviewExpertSession,
  getExpertSessionForUser,
  listUserExpertSessions,
  listExpertOwnSessions,
} from "../services/ExpertsService";
import { sendExpertAdminCredentialsEmail } from "../../utils/email";

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
    res.json({ success: true, message: "Experts retrieved", data: result.data, pagination: result.pagination });
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
      res.status(400).json({ success: false, message: "name, email, phone and sessionFee are required" });
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
    }).catch((err: unknown) => console.error("Failed to send expert credentials email:", err));

    res.status(201).json({ success: true, message: "Expert created and credentials emailed", data: expert });
  } catch (e) {
    fail(res, e);
  }
};

export const listExpertsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await listExpertsForAdmin({ page: num(req.query.page), limit: num(req.query.limit) });
    res.json({ success: true, message: "Experts retrieved", data: result.data, pagination: result.pagination });
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
    const data = await initiateExpertSession({
      expertId: req.params.expertId as string,
      userId,
      clientNote: req.body?.clientNote,
      mode: req.body?.mode,
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
    const session = await reconcileExpertSession({ sessionId: req.params.sessionId as string, userId });
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
      isAdmin: req.user?.role === "ADMIN",
    });
    res.json({ success: true, message: "Session retrieved", data });
  } catch (e) {
    fail(res, e, 404);
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
      isAdmin: req.user?.role === "ADMIN",
    });
    res.json({ success: true, message: "Session completed", data: session });
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
