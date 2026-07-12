import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import { S3Service } from "../../shared/services/S3Service";

/**
 * Fetch all concierge requests for the admin panel, sorted by newest first.
 *
 * The Mongo `.populate("userId", "name email phone")` has no Prisma relation on
 * the String FK, so we batch-load the referenced users and attach them onto the
 * `userId` field to preserve the exact response shape the admin panel expects.
 * The previously-embedded `documents` array is now a normalized child table,
 * loaded via `include`.
 */
export const getAllConciergeRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const requests = await prisma.conciergeRequest.findMany({
      include: { documents: true },
      orderBy: { createdAt: "desc" },
    });

    const userIds = [...new Set(requests.map((request) => request.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, phone: true },
    });
    const usersById = new Map(users.map((user) => [user.id, user]));

    const populated = requests.map((request) => ({
      ...request,
      userId: usersById.get(request.userId) ?? request.userId,
    }));

    res.status(200).json({ success: true, requests: populated });
  } catch (error) {
    console.error("Error fetching admin concierge requests:", error);
    res.status(500).json({ success: false, error: "Failed to fetch requests" });
  }
};

/**
 * Update the status and optional admin notes of a specific concierge request
 */
export const updateConciergeRequestStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!["pending", "processing", "completed", "rejected"].includes(status)) {
      res.status(400).json({ success: false, error: "Invalid status value" });
      return;
    }

    const updatePayload: Prisma.ConciergeRequestUpdateInput = { status };
    if (adminNotes !== undefined) {
      updatePayload.adminNotes = String(adminNotes).slice(0, 2000);
    }

    const existing = await prisma.conciergeRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: "Request not found" });
      return;
    }

    const updatedRequest = await prisma.conciergeRequest.update({
      where: { id },
      data: updatePayload,
      include: { documents: true },
    });

    const user = await prisma.user.findUnique({
      where: { id: updatedRequest.userId },
      select: { id: true, name: true, email: true, phone: true },
    });

    res.status(200).json({
      success: true,
      request: { ...updatedRequest, userId: user ?? updatedRequest.userId },
    });
  } catch (error) {
    console.error("Error updating concierge request status:", error);
    res.status(500).json({ success: false, error: "Failed to update status" });
  }
};

/**
 * Get a presigned download URL for a specific document key attached to a request
 */
export const getConciergeDocumentDownloadUrl = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { key } = req.query;

    if (!key || typeof key !== "string") {
      res.status(400).json({ success: false, error: "Missing document key" });
      return;
    }

    // Verify the request exists and contains this document key
    const request = await prisma.conciergeRequest.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!request) {
      res.status(404).json({ success: false, error: "Request not found" });
      return;
    }

    const docExists = request.documents.some((doc) => doc.s3Key === key);
    if (!docExists) {
      res
        .status(404)
        .json({ success: false, error: "Document not found in request" });
      return;
    }

    const s3Service = new S3Service();
    const downloadUrl =
      await s3Service.generateConciergeDocumentDownloadUrl(key);

    res.status(200).json({ success: true, url: downloadUrl });
  } catch (error) {
    console.error("Error generating document download URL:", error);
    res.status(500).json({ success: false, error: "Failed to generate URL" });
  }
};
