import { Request, Response } from "express";
import { ConciergeRequest } from "../../shared/models/ConciergeRequest";
import { S3Service } from "../../shared/services/S3Service";

/**
 * Fetch all concierge requests for the admin panel, sorted by newest first
 */
export const getAllConciergeRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const requests = await ConciergeRequest.find()
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, requests });
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

    const updatePayload: Record<string, any> = { status };
    if (adminNotes !== undefined) {
      updatePayload.adminNotes = String(adminNotes).slice(0, 2000);
    }

    const updatedRequest = await ConciergeRequest.findByIdAndUpdate(
      id,
      updatePayload,
      { new: true },
    ).populate("userId", "name email phone");

    if (!updatedRequest) {
      res.status(404).json({ success: false, error: "Request not found" });
      return;
    }

    res.status(200).json({ success: true, request: updatedRequest });
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
    const request = await ConciergeRequest.findById(id);
    if (!request) {
      res.status(404).json({ success: false, error: "Request not found" });
      return;
    }

    const docExists = request.documents.some((doc) => doc.s3Key === key);
    if (!docExists) {
      res.status(404).json({ success: false, error: "Document not found in request" });
      return;
    }

    const s3Service = new S3Service();
    const downloadUrl = await s3Service.generateConciergeDocumentDownloadUrl(key);

    res.status(200).json({ success: true, url: downloadUrl });
  } catch (error) {
    console.error("Error generating document download URL:", error);
    res.status(500).json({ success: false, error: "Failed to generate URL" });
  }
};
