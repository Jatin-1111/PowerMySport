import { User, UserDocument } from "../../../client/models/User";
import { ACCOUNT_DELETION_GRACE_PERIOD_MS } from "./shared";

export interface LoginPayload {
  email: string;
  password: string;
}

export const loginUser = async (
  payload: LoginPayload
): Promise<{ user: UserDocument; deletionCancelled: boolean }> => {
  const user = await User.findOne({ email: payload.email }).select("+password");

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isPasswordValid = await user.comparePassword(payload.password);

  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  // A successful login within the grace period cancels a pending
  // self-deletion and restores full access — the standard pattern big
  // platforms use, rather than requiring a separate "undo" action.
  let deletionCancelled = false;
  if (
    user.pendingDeletion &&
    user.deletionRequestedAt &&
    Date.now() - user.deletionRequestedAt.getTime() < ACCOUNT_DELETION_GRACE_PERIOD_MS
  ) {
    await User.updateOne(
      { _id: user._id },
      {
        $set: { isActive: true, pendingDeletion: false },
        $unset: { deletionRequestedAt: "", deactivatedAt: "" },
      }
    );
    user.isActive = true;
    user.pendingDeletion = false;
    deletionCancelled = true;
  }

  return { user, deletionCancelled };
};

export const getUserById = async (id: string): Promise<UserDocument | null> => {
  return User.findById(id).select("+password");
};
