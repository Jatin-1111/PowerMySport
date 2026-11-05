import { OAuth2Client } from "google-auth-library";
import { User, UserDocument } from "../../../client/models/User";
import { Expert } from "../../../client/models/ExpertProfile";
import { sendWelcomeEmail } from "../../../utils/email";
import { isSelfRegisterRole, SelfRegisterRole } from "../../constants/selfRegisterRoles";
import { log, LEGAL_POLICY_VERSION, restoreIfPendingDeletion } from "./shared";

/**
 * The Google OAuth client IDs whose ID tokens this server accepts.
 *
 * `GOOGLE_CLIENT_ID` may hold several, comma separated. One is the normal case. Two is how a client
 * is moved to another Google Cloud project without a gap: the server accepts the old and the new ID
 * while the website, and the mobile app, switch over, then the old one is removed. A token is
 * accepted when it was issued for ANY listed ID. IDs are public, so listing one grants nothing by
 * itself: the token's signature and expiry are still checked by Google's keys.
 */
export const parseGoogleClientIds = (raw: string | undefined): string[] =>
  (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

// Built without an ID on purpose: the accepted audiences are passed on every verification.
// Exported only so a test can stand in for Google's network call.
export const googleOAuthClient = new OAuth2Client();

export interface VerifiedGoogleIdentity {
  googleId: string;
  email: string;
  name?: string;
  photoUrl?: string;
}

/**
 * Verify a Google ID token ("credential" from Google Identity Services) on the
 * server. This is the ONLY trustworthy source of the user's Google identity —
 * never trust googleId/email sent directly by the client, as those can be
 * forged to impersonate any account.
 */
export const verifyGoogleCredential = async (
  credential: unknown
): Promise<VerifiedGoogleIdentity> => {
  const clientIds = parseGoogleClientIds(process.env.GOOGLE_CLIENT_ID);
  if (clientIds.length === 0) {
    throw new Error("Google login is not configured on the server.");
  }
  if (!credential || typeof credential !== "string") {
    throw new Error("Missing Google credential.");
  }

  let ticket;
  try {
    ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: clientIds,
    });
  } catch {
    throw new Error("Invalid Google credential.");
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error("Invalid Google credential.");
  }
  if (payload.email_verified === false) {
    throw new Error("Google account email is not verified.");
  }

  const identity: VerifiedGoogleIdentity = {
    googleId: payload.sub,
    email: payload.email,
  };
  if (payload.name) {
    identity.name = payload.name;
  }
  if (payload.picture) {
    identity.photoUrl = payload.picture;
  }
  return identity;
};

export interface GoogleLoginPayload {
  googleId: string;
  email: string;
  name: string;
  photoUrl?: string;
  role?: SelfRegisterRole;
  action?: "login" | "register";
  acceptedTerms?: boolean;
  acceptedPrivacy?: boolean;
}

export const googleLogin = async (
  payload: GoogleLoginPayload
): Promise<{ user: UserDocument; deletionCancelled: boolean }> => {
  let user = await User.findOne({ googleId: payload.googleId });

  if (!user) {
    // Check if user exists with email
    user = await User.findOne({ email: payload.email });

    if (user) {
      // Link Google account to existing user
      user.googleId = payload.googleId;
      if (payload.photoUrl) {
        user.photoUrl = payload.photoUrl;
      }
      await user.save();
    } else {
      if (payload.action === "login") {
        throw new Error("Account not found. Please sign up on the Register page.");
      }

      if (!payload.acceptedTerms || !payload.acceptedPrivacy) {
        throw new Error("You must accept Terms of Service and Privacy Policy to register.");
      }

      // Defence in depth behind googleAuthSchema: the TypeScript union is erased at
      // runtime, so re-check against the self-registration allow-list here.
      if (payload.role !== undefined && !isSelfRegisterRole(payload.role)) {
        throw new Error("Invalid role for sign-up.");
      }

      const now = new Date();

      // Create new user
      // Generate unique phone from Google ID to avoid phone field collision
      const uniquePhoneId = `goog_${payload.googleId.slice(0, 15)}_${Date.now()}`;

      user = new User({
        name: payload.name,
        email: payload.email,
        googleId: payload.googleId,
        photoUrl: payload.photoUrl,
        phone: uniquePhoneId, // Unique ID instead of fake phone number
        role: payload.role || "Parent",
        legalConsents: {
          terms: {
            accepted: true,
            acceptedAt: now,
            version: LEGAL_POLICY_VERSION,
          },
          privacy: {
            accepted: true,
            acceptedAt: now,
            version: LEGAL_POLICY_VERSION,
          },
        },
      });
      await user.save();

      // For self-registered experts create a blank profile pending admin review.
      if (user.role === "EXPERT") {
        await Expert.create({
          userId: user._id,
          bio: "",
          sports: [],
          expertise: [],
          sessionFee: 0,
          sessionMode: "ONLINE",
          isActive: false,
          verificationStatus: "UNVERIFIED",
        });
      }

      // Send welcome email for new Google users
      sendWelcomeEmail({
        name: user.name,
        email: user.email,
        role: user.role,
      }).catch((error) => {
        log.error("Failed to send welcome email:", error);
      });
    }
  }

  // Same restore-on-login behaviour as password sign-in (`loginUser`) — a
  // no-op for a brand-new registration or an account with nothing pending.
  const deletionCancelled = await restoreIfPendingDeletion(user);

  return { user, deletionCancelled };
};

/**
 * Link a Google account to an existing user
 */
export const linkGoogleAccount = async (
  userId: string,
  credential: string
): Promise<UserDocument> => {
  const identity = await verifyGoogleCredential(credential);

  const existingGoogleUser = await User.findOne({ googleId: identity.googleId });
  if (existingGoogleUser && existingGoogleUser._id.toString() !== userId) {
    throw new Error("This Google account is already linked to another user.");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  user.googleId = identity.googleId;
  if (!user.photoUrl && identity.photoUrl) {
    user.photoUrl = identity.photoUrl;
  }

  await user.save();
  return user;
};
