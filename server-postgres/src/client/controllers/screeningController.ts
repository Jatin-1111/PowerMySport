import { Request, Response } from "express";
import { ScreeningStatus } from "@prisma/client";
import prisma, { Prisma } from "../../lib/prisma";

export async function createScreeningRequest(req: Request, res: Response): Promise<void> {
  const { dependentName, sport, phone, preferredTime, city } = req.body;

  if (!dependentName || !phone) {
    res.status(400).json({ success: false, message: "Child name and phone number are required." });
    return;
  }

  const data: Prisma.ScreeningRequestCreateInput = {
    dependentName: dependentName.trim(),
    phone: phone.trim(),
  };
  if (req.user?.id) data.parentId = req.user.id;
  if (sport) data.sport = sport.trim();
  if (preferredTime) data.preferredTime = preferredTime.trim();
  if (city) data.city = city.trim();

  const request = await prisma.screeningRequest.create({ data });

  res.status(201).json({ success: true, data: { id: request.id } });
}

export async function getScreeningRequests(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const status = req.query.status as string | undefined;

  const where: Prisma.ScreeningRequestWhereInput = status
    ? { status: status as ScreeningStatus }
    : {};
  const [requests, total] = await Promise.all([
    prisma.screeningRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.screeningRequest.count({ where }),
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

  try {
    const updated = await prisma.screeningRequest.update({
      where: { id: String(id) },
      data: {
        status: status as ScreeningStatus,
        ...(adminNotes !== undefined ? { adminNotes } : {}),
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      res.status(404).json({ success: false, message: "Request not found." });
      return;
    }
    throw error;
  }
}
