import { AppError } from "../../utils/AppError";
import { User } from "../models/User";

/**
 * Whether a parent has been through the season planner's tour.
 *
 * It lives on the user, not in the browser, so a parent who has seen it on their
 * phone is not shown it again on a laptop. An account that never set the field has
 * not seen it, which is why a missing value reads as false.
 */

export async function hasSeenPlannerTour(userId: string): Promise<boolean> {
  const user = await User.findById(userId).select("plannerTourSeen").lean();
  if (!user) throw new AppError("Account not found.", 404);
  return user.plannerTourSeen === true;
}

export async function setPlannerTourSeen(userId: string, seen: boolean): Promise<boolean> {
  const result = await User.updateOne({ _id: userId }, { $set: { plannerTourSeen: seen } });
  if (result.matchedCount === 0) throw new AppError("Account not found.", 404);
  return seen;
}
