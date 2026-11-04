import { Request, Response } from "express";
import {
  createVenueInquiry,
  getAllInquiries,
  getInquiryById,
  reviewInquiry,
  deleteInquiry,
} from "../services/VenueInquiryService";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

// Submit venue inquiry (public endpoint)
export const submitInquiry = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const inquiry = await createVenueInquiry(req.body);

  res.status(201).json({
    success: true,
    message: "Inquiry submitted successfully. Our team will contact you soon.",
    data: {
      id: inquiry._id,
      venueName: inquiry.venueName,
      status: inquiry.status,
    },
  });
});

// Get all inquiries (admin only)
export const getInquiries = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
});

// Get single inquiry (admin only)
export const getInquiry = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const inquiry = await getInquiryById(req.params.id as string);

  if (!inquiry) {
    throw new AppError("Inquiry not found", 404);
  }

  const transformedInquiry = {
    ...inquiry.toObject(),
    id: inquiry._id.toString(),
  };

  res.status(200).json({
    success: true,
    message: "Inquiry retrieved successfully",
    data: transformedInquiry,
  });
});

// Review inquiry - approve or reject (admin only)
export const reviewInquiryRequest = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
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
  }
);

// Delete inquiry (admin only)
export const removeInquiry = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await deleteInquiry(req.params.id as string);

  res.status(200).json({
    success: true,
    message: "Inquiry deleted successfully",
  });
});
