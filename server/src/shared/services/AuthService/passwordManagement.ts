import crypto from "crypto";
import { User } from "../../../client/models/User";
import { sendPasswordResetEmail, sendPasswordChangedEmail } from "../../../utils/email";
import { log } from "./shared";

export const requestPasswordReset = async (email: string): Promise<string> => {
  const user = await User.findOne({ email }).select("+resetPasswordToken +resetPasswordExpires");

  if (!user) {
    // Return the same message as success — never reveal whether the email exists
    return "If this email is registered, you will receive a reset link shortly.";
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

  await user.save();

  // Send password reset email asynchronously
  sendPasswordResetEmail({
    name: user.name,
    email: user.email,
    resetToken,
  }).catch((error) => {
    log.error("Failed to send password reset email:", error);
  });

  return "If this email is registered, you will receive a reset link shortly.";
};

export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  }).select("+resetPasswordToken +resetPasswordExpires +password");

  if (!user) {
    throw new Error("Invalid or expired reset token");
  }

  // Save the new password first — this needs a real .save() so the
  // pre("save") hashing hook runs. `delete user.field` doesn't persist (see
  // the same note on finalizeAccountDeletion above), so the token fields are
  // cleared via a separate $unset instead of being assigned on the document.
  user.password = newPassword;
  await user.save();

  await User.updateOne(
    { _id: user._id },
    { $unset: { resetPasswordToken: "", resetPasswordExpires: "" } }
  );

  // Security confirmation that the password was changed (fire-and-forget).
  if (user.email) {
    sendPasswordChangedEmail({ name: user.name, email: user.email }).catch((error) =>
      log.error("Failed to send password-changed email:", error)
    );
  }
};

/**
 * Change password for an already-authenticated user. Requires the current
 * password to be re-entered — this is the app's only re-authentication step
 * (no 2FA exists), so it's the sole guard against a hijacked/left-open
 * session silently locking the real owner out.
 */
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new Error("User not found");
  }

  if (!user.password) {
    throw new Error("This account signed in with Google and has no password to change");
  }

  const isValid = await user.comparePassword(currentPassword);
  if (!isValid) {
    throw new Error("Current password is incorrect");
  }

  user.password = newPassword;
  await user.save();

  if (user.email) {
    sendPasswordChangedEmail({ name: user.name, email: user.email }).catch((error) =>
      log.error("Failed to send password-changed email:", error)
    );
  }
};
