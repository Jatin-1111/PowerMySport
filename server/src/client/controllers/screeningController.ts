import { Request, Response } from "express";
import { ScreeningRequest, ScreeningStatus } from "../models/ScreeningRequest";

export async function createScreeningRequest(req: Request, res: Response): Promise<void> {
  const { dependentName, sport, phone, preferredTime, city } = req.body;

  if (!dependentName || !phone) {
    res.status(400).json({ success: false, message: "Child name and phone number are required." });
    return;
  }

  const payload: Record<string, unknown> = {
    dependentName: dependentName.trim(),
    phone: phone.trim(),
  };
  if (req.user?.id) payload.parentId = req.user.id;
  if (sport) payload.sport = sport.trim();
  if (preferredTime) payload.preferredTime = preferredTime.trim();
  if (city) payload.city = city.trim();

  const request = await ScreeningRequest.create(payload);

  res.status(201).json({ success: true, data: { id: (request as any)._id } });
}

export async function getScreeningRequests(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const status = req.query.status as string | undefined;

  const filter = status ? { status } : {};
  const [requests, total] = await Promise.all([
    ScreeningRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ScreeningRequest.countDocuments(filter),
  ]);

  res.json({ success: true, data: { requests, total, page, limit } });
}

export async function updateScreeningStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, adminNotes } = req.body;

  const allowed: ScreeningStatus[] = ["requested", "scheduled", "completed", "cancelled"];
  if (!allowed.includes(status)) {
    res.status(400).json({ success: false, message: "Invalid status." });
    return;
  }

  const updated = await ScreeningRequest.findByIdAndUpdate(
    id,
    { status, ...(adminNotes !== undefined ? { adminNotes } : {}) },
    { new: true }
  );

  if (!updated) {
    res.status(404).json({ success: false, message: "Request not found." });
    return;
  }

  res.json({ success: true, data: updated });
}
