import { Request, Response } from "express";
import { s3Service } from "../services/S3Service";
import { ConciergeRequest } from "../models/ConciergeRequest";
import { sendEmail } from "../../utils/email";
import { User } from "../../client/models/User";

export const getPresignedUploadUrl = async (req: Request, res: Response): Promise<void> => {
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

    const { uploadUrl, downloadUrl, key } = await s3Service.generateConciergeDocumentUploadUrl(
      fileName,
      contentType,
      userId.toString(),
      documentType
    );

    res.status(200).json({ uploadUrl, downloadUrl, key });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
};

export const submitConciergeRequest = async (req: Request, res: Response): Promise<void> => {
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

    if (!sportSlug || !prerequisiteId || !prerequisiteName || !documents || !Array.isArray(documents)) {
      res.status(400).json({ error: "Missing required fields" });
      return;
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
    const docsListHtml = documents.map(doc => `<li><strong>${doc.documentName}:</strong> uploaded to S3</li>`).join('');

    // Format item label
    const itemLabel = itemType ? itemType.charAt(0).toUpperCase() + itemType.slice(1) : "Tournament";
    const finalItemName = itemName || tournamentName;

    // Send email notification to admin team
    const adminEmail = process.env.EMAIL_USER || "teams@powermysport.com";
    await sendEmail({
      to: adminEmail,
      subject: `New Concierge Request from ${user?.name || 'A User'} for ${sportSlug}`,
      html: `
        <h2>New Registration Request</h2>
        <p><strong>Parent Name:</strong> ${user?.name || 'Unknown'}</p>
        <p><strong>Sport:</strong> ${sportSlug}</p>
        <p><strong>Requested ID:</strong> ${prerequisiteName} (${prerequisiteId})</p>
        ${finalItemName ? `<p><strong>For ${itemLabel}:</strong> ${finalItemName}</p>` : ''}
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
  } catch (error) {
    console.error("Error submitting concierge request:", error);
    res.status(500).json({ error: "Failed to submit request" });
  }
};

export const getUserConciergeRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const requests = await ConciergeRequest.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({ requests });
  } catch (error) {
    console.error("Error fetching concierge requests:", error);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
};
