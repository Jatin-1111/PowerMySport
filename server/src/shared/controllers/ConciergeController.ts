import { Request, Response } from "express";
import path from "path";
import { s3Service } from "../services/S3Service";
import { ConciergeRequest } from "../models/ConciergeRequest";
import { sendEmail } from "../../utils/email";
import { User } from "../../client/models/User";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

const escHtml = (str: unknown): string =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#x27;");

export const getPresignedUploadUrl = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { fileName, contentType, documentType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    if (!fileName || !contentType || !documentType) {
      throw new AppError("Missing required fields", 400);
    }

    const ALLOWED_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png"];
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new AppError("Invalid file type. Only PDF, JPG, and PNG are allowed.", 400);
    }

    const ALLOWED_DOCUMENT_TYPES = [
      "AITA_ID",
      "BCCI_ID",
      "BIRTH_CERTIFICATE",
      "SCHOOL_CERTIFICATE",
      "ID_PROOF",
      "ADDRESS_PROOF",
      "SPORTS_CERTIFICATE",
      "OTHER",
    ];
    if (!ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
      throw new AppError("Invalid document type.", 400);
    }

    const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9._\-]/g, "_");

    const { uploadUrl, downloadUrl, key } = await s3Service.generateConciergeDocumentUploadUrl(
      safeFileName,
      contentType,
      userId.toString(),
      documentType
    );

    res.status(200).json({ uploadUrl, downloadUrl, key });
  }
);

export const submitConciergeRequest = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const {
      sportSlug,
      itemType,
      itemId,
      itemName,
      tournamentId,
      tournamentName,
      prerequisiteId,
      prerequisiteName,
      documents,
    } = req.body;

    if (!sportSlug || !documents || !Array.isArray(documents)) {
      throw new AppError("Missing required fields", 400);
    }

    if (documents.length > 10) {
      throw new AppError("Maximum 10 documents allowed per request.", 400);
    }

    const request = new ConciergeRequest({
      userId,
      sportSlug,
      itemType,
      itemId: itemId || tournamentId,
      itemName: itemName || tournamentName,
      tournamentId,
      tournamentName,
      prerequisiteId,
      prerequisiteName,
      documents,
    });

    await request.save();

    // Fetch user details for email
    const user = await User.findById(userId);

    // Format documents list for email
    const docsListHtml = documents
      .map((doc) => `<li><strong>${escHtml(doc.documentName)}:</strong> uploaded to S3</li>`)
      .join("");

    // Format item label
    const itemLabel = itemType
      ? itemType.charAt(0).toUpperCase() + itemType.slice(1)
      : "Tournament";
    const finalItemName = itemName || tournamentName;

    // Send email notification to admin team
    const adminEmail = process.env.EMAIL_USER || "teams@powermysport.com";
    await sendEmail({
      to: adminEmail,
      subject: `New Concierge Request from ${user?.name || "A User"} for ${sportSlug}`,
      html: `
        <h2>New Registration Request</h2>
        <p><strong>Parent Name:</strong> ${escHtml(user?.name) || "Unknown"}</p>
        <p><strong>Sport:</strong> ${escHtml(sportSlug)}</p>
        ${prerequisiteName ? `<p><strong>Requested ID:</strong> ${escHtml(prerequisiteName)} (${escHtml(prerequisiteId)})</p>` : ""}
        ${finalItemName ? `<p><strong>For ${escHtml(itemLabel)}:</strong> ${escHtml(finalItemName)}</p>` : ""}
        <br />
        <h3>Documents Uploaded:</h3>
        <ul>
          ${docsListHtml}
        </ul>
        <br />
        <p>Please log in to the admin dashboard or check your AWS S3 powermysport-verification bucket to download the documents.</p>
      `,
    });

    res.status(201).json({ message: "Concierge request submitted successfully", request });
  }
);

export const getUserConciergeRequests = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      ConciergeRequest.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ConciergeRequest.countDocuments({ userId }),
    ]);

    res.status(200).json({
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);
