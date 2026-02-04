import { Request, Response } from "express";
import {
  createVenueInquiry,
  getAllInquiries,
  getInquiryById,
  reviewInquiry,
  deleteInquiry,
} from "../services/VenueInquiryService";

// Submit venue inquiry (public endpoint)
export const submitInquiry = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const inquiry = await createVenueInquiry(req.body);

    res.status(201).json({
      success: true,
      message:
        "Inquiry submitted successfully. Our team will contact you soon.",
      data: {
        id: inquiry._id,
        venueName: inquiry.venueName,
        status: inquiry.status,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to submit inquiry",
    });
  }
};

// Get all inquiries (admin only)
export const getInquiries = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { status } = req.query;
    const inquiries = await getAllInquiries(status as string);

    // Transform _id to id for frontend
    const transformedInquiries = inquiries.map((inquiry) => ({
      ...inquiry.toObject(),
      id: inquiry._id.toString(),
    }));

    res.status(200).json({
      success: true,
      message: "Inquiries retrieved successfully",
      data: transformedInquiries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch inquiries",
    });
  }
};

// Get single inquiry (admin only)
export const getInquiry = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const inquiry = await getInquiryById(req.params.id as string);

    if (!inquiry) {
      res.status(404).json({
        success: false,
        message: "Inquiry not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Inquiry retrieved successfully",
      data: inquiry,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch inquiry",
    });
  }
};

// Review inquiry - approve or reject (admin only)
export const reviewInquiryRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const result = await reviewInquiry(req.params.id as string, {
      ...req.body,
      reviewedBy: req.user.id,
    });

    const responseData: any = {
      inquiry: result.inquiry,
    };

    // Include credentials if approved
    if (result.credentials) {
      responseData.credentials = result.credentials;
      responseData.message = `Inquiry approved. Venue lister account created. Credentials: ${result.credentials.email} / ${result.credentials.password}`;
    }

    res.status(200).json({
      success: true,
      message: result.credentials
        ? "Inquiry approved and account created"
        : "Inquiry reviewed successfully",
      data: responseData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to review inquiry",
    });
  }
};

// Delete inquiry (admin only)
export const removeInquiry = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    await deleteInquiry(req.params.id as string);

    res.status(200).json({
      success: true,
      message: "Inquiry deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete inquiry",
    });
  }
};
