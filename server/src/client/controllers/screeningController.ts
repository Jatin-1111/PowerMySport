import { Request, Response } from "express";
import mongoose from "mongoose";
import { ScreeningRequest, ScreeningStatus } from "../models/ScreeningRequest";

export async function createScreeningRequest(req: Request, res: Response): Promise<void> {
  const { dependentName, dependentId, sport, phone, preferredTime, city } = req.body;

  if (!dependentName || !phone) {
    res.status(400).json({ success: false, message: "Child name and phone number are required." });
    return;
  }

  const payload: Record<string, unknown> = {
    dependentName: dependentName.trim(),
    phone: phone.trim(),
  };
  if (req.user?.id) payload.parentId = req.user.id;
  if (dependentId && mongoose.isValidObjectId(dependentId)) payload.dependentId = dependentId;
  if (sport) payload.sport = sport.trim();
  if (preferredTime) payload.preferredTime = preferredTime.trim();
  if (city) payload.city = city.trim();

  const request = await ScreeningRequest.create(payload);

  res.status(201).json({ success: true, data: { id: (request as any)._id } });
}

/** The logged-in parent's own screening requests — lets the journey UI check for a real booking against a specific child instead of relying only on the "skip" toggle. */
export async function getMyScreeningRequests(req: Request, res: Response): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ success: false, message: "Login required." });
    return;
  }

  const { dependentId } = req.query;
  const filter: Record<string, unknown> = { parentId: req.user.id };
  if (dependentId && mongoose.isValidObjectId(dependentId as string)) {
    filter.dependentId = dependentId;
  }

  // Unbounded by construction (a parent's screening requests should always
  // be few), but capped defensively since nothing else limits it.
  const requests = await ScreeningRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json({ success: true, data: { requests } });
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
