import { Request, Response } from "express";
import path from "path";
import { s3Service } from "../services/S3Service";
import prisma from "../../lib/prisma";
import { sendEmail } from "../../utils/email";

const escHtml = (str: unknown): string =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#x27;");

export const getPresignedUploadUrl = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { fileName, contentType, documentType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!fileName || !contentType || !documentType) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const ALLOWED_CONTENT_TYPES = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      res.status(400).json({
        error: "Invalid file type. Only PDF, JPG, and PNG are allowed.",
      });
      return;
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
      res.status(400).json({ error: "Invalid document type." });
      return;
    }

    const safeFileName = path
      .basename(fileName)
      .replace(/[^a-zA-Z0-9._\-]/g, "_");

    const { uploadUrl, downloadUrl, key } =
      await s3Service.generateConciergeDocumentUploadUrl(
        safeFileName,
        contentType,
        userId.toString(),
        documentType,
      );

    res.status(200).json({ uploadUrl, downloadUrl, key });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
};

export const submitConciergeRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
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
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    if (documents.length > 10) {
      res
        .status(400)
        .json({ error: "Maximum 10 documents allowed per request." });
      return;
    }

    const request = await prisma.conciergeRequest.create({
      data: {
        userId,
        sportSlug,
        itemType,
        itemId: itemId || tournamentId,
        itemName: itemName || tournamentName,
        tournamentId,
        tournamentName,
        prerequisiteId,
        prerequisiteName,
        // Embedded doc array -> ConciergeRequestDocument child rows.
        documents: {
          create: documents.map((doc: any) => ({
            documentName: doc.documentName,
            s3Key: doc.s3Key ?? doc.key ?? "",
          })),
        },
      },
      include: { documents: true },
    });

    // Fetch user details for email
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Format documents list for email
    const docsListHtml = documents
      .map(
        (doc) =>
          `<li><strong>${escHtml(doc.documentName)}:</strong> uploaded to S3</li>`,
      )
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

    res
      .status(201)
      .json({ message: "Concierge request submitted successfully", request });
  } catch (error) {
    console.error("Error submitting concierge request:", error);
    res.status(500).json({ error: "Failed to submit request" });
  }
};

export const getUserConciergeRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit as string) || 20),
    );
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      prisma.conciergeRequest.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { documents: true },
      }),
      prisma.conciergeRequest.count({ where: { userId } }),
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
  } catch (error) {
    console.error("Error fetching concierge requests:", error);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
};
