import { Request, Response } from "express";
import { User } from "../../../client/models/User";
import { Venue } from "../../../client/models/Venue";
import Admin from "../../models/Admin";
import { recordAuditLog } from "../../services/AuditLogService";
import { sendVenueAdminCredentialsEmail } from "../../../utils/email";
import { log, buildUserSummary, generateTempPassword } from "./shared";

/**
 * Create venue directly from admin
 * POST /api/admin/venues/create
 */
export const createVenueAdminHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const {
      ownerName,
      ownerEmail,
      ownerPhone,
      name,
      address,
      sports,
      pricePerHour,
      sportPricing,
      amenities,
      description,
      location,
      openingHours,
      allowExternalCoaches,
      approvalStatus,
    } = req.body;

    const adminAccount = await Admin.findById(req.user.id).select("name email");

    const newVenue = new Venue({
      ownerName: ownerName || adminAccount?.name || "Admin Venue",
      ownerEmail: ownerEmail || adminAccount?.email || req.user.email || "admin@powersport.local",
      ownerPhone: ownerPhone || req.user.id,
      name,
      address,
      sports,
      pricePerHour,
      sportPricing: sportPricing || {},
      amenities: amenities || [],
      description: description || "",
      location,
      openingHours: openingHours || {
        monday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        tuesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        wednesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        thursday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        friday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        saturday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
        sunday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      },
      allowExternalCoaches: allowExternalCoaches !== false,
      approvalStatus: approvalStatus || "APPROVED",
      createdBy: req.user.id,
    });

    const venue = await newVenue.save();

    res.status(201).json({
      success: true,
      message: "Venue created successfully",
      data: venue,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create venue",
    });
  }
};

/**
 * Update venue directly from admin
 * PUT /api/admin/venues/:venueId
 */
export const updateVenueAdminHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const venueId = (req.params as Record<string, unknown>).venueId as string;

    const venue = await Venue.findById(venueId);

    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
    }

    const updatePayload = { ...req.body } as Record<string, unknown>;
    const convertExistingUser = updatePayload.convertExistingUser === true;
    delete updatePayload.convertExistingUser;
    // Never allow these to be mass-assigned from the request body — ownerId is
    // resolved by this handler's provisioning logic; rating/reviews are derived.
    for (const f of ["_id", "rating", "reviewCount", "totalReviews"]) {
      delete updatePayload[f];
    }

    const nextApprovalStatus =
      typeof updatePayload.approvalStatus === "string"
        ? (updatePayload.approvalStatus as string)
        : venue.approvalStatus;

    let ownerUser: typeof venue.ownerId | null = null;
    let tempPassword: string | null = null;
    let createdUser = false;

    if (nextApprovalStatus === "APPROVED" && !venue.ownerId) {
      const ownerEmailRaw = (updatePayload.ownerEmail as string | undefined) || venue.ownerEmail;
      const ownerPhoneRaw = (updatePayload.ownerPhone as string | undefined) || venue.ownerPhone;

      const ownerEmail = ownerEmailRaw?.trim().toLowerCase() || "";
      const ownerPhone = ownerPhoneRaw?.trim() || "";

      const existingUser = await User.findOne({
        $or: [{ email: ownerEmail }, { phone: ownerPhone }],
      });

      if (existingUser) {
        if (existingUser.role === "VenueLister") {
          ownerUser = existingUser._id;
        } else if (existingUser.role === "Player" || existingUser.role === "Parent") {
          if (!convertExistingUser) {
            res.status(409).json({
              success: false,
              message:
                "User already exists as PLAYER. Convert this account to VENUE_LISTER to continue.",
              requiresConversion: true,
              existingRole: existingUser.role,
              targetRole: "VenueLister",
              existingUser: buildUserSummary(existingUser),
            });
            return;
          }

          existingUser.role = "VenueLister";
          await existingUser.save();
          ownerUser = existingUser._id;
        } else {
          res.status(409).json({
            success: false,
            message:
              "An account already exists with a different role. Venue lister accounts must be separate.",
            requiresSeparateAccount: true,
            existingRole: existingUser.role,
            targetRole: "VenueLister",
            existingUser: buildUserSummary(existingUser),
          });
          return;
        }
      } else {
        tempPassword = generateTempPassword(12);

        const ownerNameRaw = (updatePayload.ownerName as string | undefined) || venue.ownerName;
        const ownerName = ownerNameRaw?.trim() || "Venue Owner";

        const newUser = new User({
          name: ownerName,
          email: ownerEmail,
          phone: ownerPhone,
          password: tempPassword,
          role: "VenueLister",
        });

        const savedUser = await newUser.save();
        ownerUser = savedUser._id;
        createdUser = true;
      }

      updatePayload.ownerId = ownerUser as unknown as string;
      updatePayload.approvalStatus = "APPROVED";
    }

    const updatedVenue = await Venue.findByIdAndUpdate(venueId, updatePayload, {
      new: true,
    });

    if (!updatedVenue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
    }

    if (createdUser && tempPassword) {
      try {
        await sendVenueAdminCredentialsEmail({
          name: updatedVenue.ownerName,
          email: updatedVenue.ownerEmail,
          password: tempPassword,
          loginUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`,
        });
      } catch (emailError) {
        log.error("Failed to send venue credentials email:", emailError);
      }
    }

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action:
        updatedVenue.approvalStatus !== venue.approvalStatus
          ? `venue.approvalStatus.${updatedVenue.approvalStatus.toLowerCase()}`
          : "venue.update",
      targetType: "Venue",
      targetId: venueId,
      metadata: { approvalStatus: updatedVenue.approvalStatus },
    });

    res.status(200).json({
      success: true,
      message: "Venue updated successfully",
      data: updatedVenue,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update venue",
    });
  }
};
