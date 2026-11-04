import { Request, Response } from "express";
import { User } from "../../../client/models/User";
import { Venue } from "../../../client/models/Venue";
import Admin from "../../models/Admin";
import { recordAuditLog } from "../../services/AuditLogService";
import { sendVenueAdminCredentialsEmail } from "../../../utils/email";
import { log, buildUserSummary, generateTempPassword } from "./shared";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

/**
 * Create venue directly from admin
 * POST /api/admin/venues/create
 */
export const createVenueAdminHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
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
  }
);

/**
 * Update venue directly from admin
 * PUT /api/admin/venues/:venueId
 */
export const updateVenueAdminHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const venueId = (req.params as Record<string, unknown>).venueId as string;

    const venue = await Venue.findById(venueId);

    if (!venue) {
      throw new AppError("Venue not found", 404);
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
          // NOTE: this guard's 409 response carries extra structured fields
          // (requiresConversion/existingRole/targetRole/existingUser) that the
          // client's account-conversion flow depends on. AppError only carries
          // a message + status code, so converting to it would silently drop
          // that payload and change client behavior — left as a direct
          // res.json(...) response rather than a thrown AppError.
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
          // NOTE: same rationale as above — requiresSeparateAccount/existingRole/
          // targetRole/existingUser are consumed by the client and would be lost
          // if collapsed into a thrown AppError, so this stays a direct response.
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
      throw new AppError("Venue not found", 404);
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
  }
);
