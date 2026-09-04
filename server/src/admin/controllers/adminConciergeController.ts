import { Request, Response } from "express";
import { ConciergeRequest } from "../../shared/models/ConciergeRequest";
import { S3Service } from "../../shared/services/S3Service";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

/**
 * Fetch all concierge requests for the admin panel, sorted by newest first
 */
export const getAllConciergeRequests = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const requests = await ConciergeRequest.find()
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    res.status(200).json({ success: true, requests });
  }
);

/**
 * Update the status and optional admin notes of a specific concierge request
 */
export const updateConciergeRequestStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!["pending", "processing", "completed", "rejected"].includes(status)) {
      throw new AppError("Invalid status value", 400);
    }

    const updatePayload: Record<string, any> = { status };
    if (adminNotes !== undefined) {
      updatePayload.adminNotes = String(adminNotes).slice(0, 2000);
    }

    const updatedRequest = await ConciergeRequest.findByIdAndUpdate(id, updatePayload, {
      new: true,
    }).populate("userId", "name email phone");

    if (!updatedRequest) {
      throw new AppError("Request not found", 404);
    }

    res.status(200).json({ success: true, request: updatedRequest });
  }
);

/**
 * Get a presigned download URL for a specific document key attached to a request
 */
export const getConciergeDocumentDownloadUrl = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { key } = req.query;

    if (!key || typeof key !== "string") {
      throw new AppError("Missing document key", 400);
    }

    // Verify the request exists and contains this document key
    const request = await ConciergeRequest.findById(id);
    if (!request) {
      throw new AppError("Request not found", 404);
    }

    const docExists = request.documents.some((doc) => doc.s3Key === key);
    if (!docExists) {
      throw new AppError("Document not found in request", 404);
    }

    const s3Service = new S3Service();
    const downloadUrl = await s3Service.generateConciergeDocumentDownloadUrl(key);

    res.status(200).json({ success: true, url: downloadUrl });
  }
);
