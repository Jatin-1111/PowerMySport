import { User, UserDocument } from "../../../client/models/User";
import { restoreIfPendingDeletion } from "./shared";

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
  const deletionCancelled = await restoreIfPendingDeletion(user);

  return { user, deletionCancelled };
};

export const getUserById = async (id: string): Promise<UserDocument | null> => {
  return User.findById(id).select("+password");
};
