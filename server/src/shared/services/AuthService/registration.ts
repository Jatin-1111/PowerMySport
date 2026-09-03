import { User, UserDocument } from "../../../client/models/User";
import { Expert } from "../../../client/models/ExpertProfile";
import { sendWelcomeEmail } from "../../../utils/email";
import { log, LEGAL_POLICY_VERSION } from "./shared";

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "Parent" | "Player" | "VenueLister" | "Coach" | "EXPERT";
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
}

export const registerUser = async (payload: RegisterPayload): Promise<UserDocument> => {
  const existingUser = await User.findOne({
    $or: [{ email: payload.email }, { phone: payload.phone }],
  });

  if (existingUser) {
    throw new Error("User with this email or phone already exists");
  }

  const user = new User({ ...payload });
  const now = new Date();
  user.legalConsents = {
    terms: {
      accepted: payload.acceptedTerms,
      acceptedAt: now,
      version: LEGAL_POLICY_VERSION,
    },
    privacy: {
      accepted: payload.acceptedPrivacy,
      acceptedAt: now,
      version: LEGAL_POLICY_VERSION,
    },
  };
  await user.save();

  // For self-registered experts create a blank profile pending admin review.
  if (payload.role === "EXPERT") {
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

  // Send welcome email asynchronously (don't wait for it)
  sendWelcomeEmail({
    name: user.name,
    email: user.email,
    role: user.role,
  }).catch((error) => {
    log.error("Failed to send welcome email:", error);
  });

  return user;
};
