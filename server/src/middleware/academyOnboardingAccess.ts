import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import Academy from "../admin/models/Academy";
import { ADMIN_ROLES } from "../constants/adminPermissions";
import { AppError } from "../utils/AppError";
import { ONBOARDING_TOKEN_HEADER, onboardingTokenMatches } from "../utils/academyOnboardingToken";
import { isSystemAdminRole } from "../utils/permissions";

const isAdminRole = (role: string | undefined): boolean =>
  isSystemAdminRole(role) ||
  Object.values(ADMIN_ROLES).includes(role as (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES]);

/**
 * Gate for every `/academies/onboarding/:academyId/*` route. Runs after
 * `optionalAuthMiddleware`, so `req.user` is set when a valid session exists.
 *
 * Access is granted to an admin, to the account linked as the academy's owner,
 * or to whoever presents the onboarding token issued at `start`. Anything else
 * gets the same 404 as an id that does not exist, so the response does not
 * confirm which ids are real. Academy ids are not secret: the public listing
 * returns them.
 */
export const requireAcademyOnboardingAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const academyId = (req.params as Record<string, unknown>).academyId as string;
    const notFound = () => next(new AppError("Academy not found", 404));

    if (!mongoose.isValidObjectId(academyId)) return notFound();

    const academy = await Academy.findById(academyId)
      .select("ownerId +onboardingTokenHash")
      .lean<{ ownerId?: mongoose.Types.ObjectId; onboardingTokenHash?: string }>();
    if (!academy) return notFound();

    if (isAdminRole(req.user?.role)) return next();

    if (req.user?.id && academy.ownerId && String(academy.ownerId) === req.user.id) {
      return next();
    }

    const presented = req.get(ONBOARDING_TOKEN_HEADER);
    if (
      presented &&
      academy.onboardingTokenHash &&
      onboardingTokenMatches(presented, academy.onboardingTokenHash)
    ) {
      return next();
    }

    return notFound();
  } catch (error) {
    next(error);
  }
};
