import { User, UserDocument } from "../../../client/models/User";
import { invalidateAccountStatusCache } from "../../../middleware/auth";
import { log as __rootLog } from "../../../utils/logger";

export const log = __rootLog.child("auth");

export const LEGAL_POLICY_VERSION = "2026-04";

/**
 * Grace period (in ms) between a self-service deletion request and the
 * scheduled job actually finalizing it. Overridable for testing.
 */
export const ACCOUNT_DELETION_GRACE_PERIOD_MS =
  (Number(process.env.ACCOUNT_DELETION_GRACE_PERIOD_DAYS) || 30) * 24 * 60 * 60 * 1000;

/**
 * A successful sign-in within the grace period cancels a pending
 * self-deletion and restores full access — shared by every sign-in path
 * (password `loginUser`, `googleLogin`) so none of them can drift out of
 * sync with the others. Mutates `user` in place to match the just-applied
 * DB write, and returns whether a restore happened.
 */
export const restoreIfPendingDeletion = async (user: UserDocument): Promise<boolean> => {
  if (
    !user.pendingDeletion ||
    !user.deletionRequestedAt ||
    Date.now() - user.deletionRequestedAt.getTime() >= ACCOUNT_DELETION_GRACE_PERIOD_MS
  ) {
    return false;
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: { isActive: true, pendingDeletion: false },
      $unset: { deletionRequestedAt: "", deactivatedAt: "" },
    }
  );
  user.isActive = true;
  user.pendingDeletion = false;
  // A request in the last ACCOUNT_STATUS_CACHE_TTL_SECONDS (e.g. background
  // polling with the pre-deletion token) may have cached isActive:false —
  // without this, the account can 403 on its own next request despite the
  // DB already showing it restored.
  invalidateAccountStatusCache(user._id.toString());
  return true;
};
