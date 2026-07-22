import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import type { Player, Address } from "@prisma/client";
import prisma from "../../lib/prisma";
import {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
} from "../../utils/email";
import { normalizeAddressInput } from "../utils/address";
import { S3Service } from "./S3Service";
import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * bcrypt work factor. Was a Mongoose pre-save hook (`bcrypt.genSalt(12)` +
 * `bcrypt.hash`) — relocated into this service per PORTING_GUIDE §3. Hashing
 * now happens explicitly before every `prisma.user.create` and before any
 * password update.
 */
const BCRYPT_ROUNDS = 12;

const hashPassword = async (plain: string): Promise<string> =>
  bcrypt.hash(plain, BCRYPT_ROUNDS);

/**
 * Replacement for the old `UserDocument.comparePassword` instance method.
 * `password` is nullable (Google-only accounts have no password), so a missing
 * hash always fails the comparison.
 */
const comparePassword = async (
  plain: string,
  hashed: string | null,
): Promise<boolean> => {
  if (!hashed) return false;
  return bcrypt.compare(plain, hashed);
};

/**
 * A User row with its normalized child tables loaded. These children were
 * embedded arrays on the old Mongoose document, so eager-loading them keeps the
 * return shape identical for controllers that read `user.addresses` etc.
 */
export type UserWithRelations = Prisma.UserGetPayload<{
  include: { addresses: true; pushSubscriptions: true; refundMethods: true };
}>;

const USER_INCLUDE = {
  addresses: { orderBy: { createdAt: "asc" as const } },
  pushSubscriptions: true,
  refundMethods: true,
} as const;

const loadUserWithRelations = async (
  userId: string,
): Promise<UserWithRelations> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: USER_INCLUDE,
  });
  if (!user) {
    throw new Error("User not found");
  }
  return user;
};

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
  credential: unknown,
): Promise<VerifiedGoogleIdentity> => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google login is not configured on the server.");
  }
  if (!credential || typeof credential !== "string") {
    throw new Error("Missing Google credential.");
  }

  let ticket;
  try {
    ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
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

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "Player" | "VenueLister" | "Coach" | "EXPERT";
  userType?: "Parent" | "Player" | "Coach" | "Academy" | "Admin";
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
}

const LEGAL_POLICY_VERSION = "2026-04";

export interface LoginPayload {
  email: string;
  password: string;
}

export const registerUser = async (
  payload: RegisterPayload,
): Promise<UserWithRelations> => {
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email: payload.email }, { phone: payload.phone }] },
  });

  if (existingUser) {
    throw new Error("User with this email or phone already exists");
  }

  const now = new Date();
  const hashedPassword = await hashPassword(payload.password);

  const user = await prisma.user.create({
    data: {
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      password: hashedPassword,
      role: payload.role,
      ...(payload.userType ? { userType: payload.userType } : {}),
      legalConsents: {
        terms: {
          accepted: payload.acceptedTerms,
          acceptedAt: now.toISOString(),
          version: LEGAL_POLICY_VERSION,
        },
        privacy: {
          accepted: payload.acceptedPrivacy,
          acceptedAt: now.toISOString(),
          version: LEGAL_POLICY_VERSION,
        },
      },
    },
    include: USER_INCLUDE,
  });

  // For self-registered experts create a blank profile pending admin review.
  if (payload.role === "EXPERT") {
    await prisma.expert.create({
      data: {
        userId: user.id,
        bio: "",
        sports: [],
        expertise: [],
        sessionFee: 0,
        sessionMode: "ONLINE",
        isActive: false,
        verificationStatus: "UNVERIFIED",
      },
    });
  }

  // Send welcome email asynchronously (don't wait for it)
  sendWelcomeEmail({
    name: user.name,
    email: user.email,
    role: user.role,
  }).catch((error) => {
    console.error("Failed to send welcome email:", error);
  });

  return user;
};

export const loginUser = async (
  payload: LoginPayload,
): Promise<UserWithRelations> => {
  const user = await prisma.user.findFirst({
    where: { email: payload.email },
    include: USER_INCLUDE,
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isPasswordValid = await comparePassword(payload.password, user.password);

  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  return user;
};

export const getUserById = async (
  id: string,
): Promise<UserWithRelations | null> => {
  return prisma.user.findUnique({ where: { id }, include: USER_INCLUDE });
};

export const requestPasswordReset = async (email: string): Promise<string> => {
  const user = await prisma.user.findFirst({ where: { email } });

  if (!user) {
    // Return the same message as success — never reveal whether the email exists
    return "If this email is registered, you will receive a reset link shortly.";
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: new Date(Date.now() + 3600000), // 1 hour
    },
  });

  // Send password reset email asynchronously
  sendPasswordResetEmail({
    name: user.name,
    email: user.email,
    resetToken,
  }).catch((error) => {
    console.error("Failed to send password reset email:", error);
  });

  return "If this email is registered, you will receive a reset link shortly.";
};

export const resetPassword = async (
  token: string,
  newPassword: string,
): Promise<void> => {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { gt: new Date() },
    },
  });

  if (!user) {
    throw new Error("Invalid or expired reset token");
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    },
  });

  // Security confirmation that the password was changed (fire-and-forget).
  if (user.email) {
    sendPasswordChangedEmail({ name: user.name, email: user.email }).catch(
      (error) => console.error("Failed to send password-changed email:", error),
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
  newPassword: string,
): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  if (!user.password) {
    throw new Error(
      "This account signed in with Google and has no password to change",
    );
  }

  const isValid = await comparePassword(currentPassword, user.password);
  if (!isValid) {
    throw new Error("Current password is incorrect");
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  if (user.email) {
    sendPasswordChangedEmail({ name: user.name, email: user.email }).catch(
      (error) => console.error("Failed to send password-changed email:", error),
    );
  }
};

/**
 * Deletes (soft) an account. A hard delete would orphan or corrupt
 * historical Booking/Payment/Player/Review documents that reference this
 * user, and financial records need to survive for tax/dispute purposes —
 * so instead this deactivates the account (isActive=false, already
 * enforced by authMiddleware on every request, so the user is immediately
 * locked out) and anonymizes personally-identifying fields on the User
 * document itself. Player/Booking/Payment history is intentionally left
 * untouched.
 */
export const deleteAccount = async (
  userId: string,
  currentPassword: string,
): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  if (user.password) {
    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
      throw new Error("Password is incorrect");
    }
  }

  const anonymizedTag = `deleted-${user.id}`;

  // The embedded arrays are now child tables — clearing them means deleting the
  // child rows (deleteMany). shippingAddress is a nullable Json column, so it is
  // set to SQL NULL via Prisma.JsonNull. defaultAddressId is cleared too since
  // every address is being removed (the old code left it dangling, but here the
  // pointer must not reference a now-deleted address).
  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: "Deleted User",
      email: `${anonymizedTag}@deleted.powermysport.com`,
      phone: anonymizedTag,
      password: null,
      googleId: null,
      photoUrl: null,
      photoS3Key: null,
      shippingAddress: Prisma.JsonNull,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      defaultAddressId: null,
      isActive: false,
      deactivatedAt: new Date(),
      addresses: { deleteMany: {} },
      refundMethods: { deleteMany: {} },
      pushSubscriptions: { deleteMany: {} },
    },
  });
};

export interface GoogleLoginPayload {
  googleId: string;
  email: string;
  name: string;
  photoUrl?: string;
  role?: "Player" | "VenueLister" | "Coach";
  userType?: "Parent" | "Player" | "Coach" | "Academy" | "Admin";
  action?: "login" | "register";
  acceptedTerms?: boolean;
  acceptedPrivacy?: boolean;
}

export const googleLogin = async (
  payload: GoogleLoginPayload,
): Promise<UserWithRelations> => {
  let user = await prisma.user.findFirst({
    where: { googleId: payload.googleId },
    include: USER_INCLUDE,
  });

  if (!user) {
    // Check if user exists with email
    const existingByEmail = await prisma.user.findFirst({
      where: { email: payload.email },
    });

    if (existingByEmail) {
      // Link Google account to existing user
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleId: payload.googleId,
          ...(payload.photoUrl ? { photoUrl: payload.photoUrl } : {}),
        },
        include: USER_INCLUDE,
      });
    } else {
      if (payload.action === "login") {
        throw new Error(
          "Account not found. Please sign up on the Register page.",
        );
      }

      if (!payload.acceptedTerms || !payload.acceptedPrivacy) {
        throw new Error(
          "You must accept Terms of Service and Privacy Policy to register.",
        );
      }

      const now = new Date();

      // Create new user
      // Generate unique phone from Google ID to avoid phone field collision
      const uniquePhoneId = `goog_${payload.googleId.slice(0, 15)}_${Date.now()}`;

      user = await prisma.user.create({
        data: {
          name: payload.name,
          email: payload.email,
          googleId: payload.googleId,
          ...(payload.photoUrl ? { photoUrl: payload.photoUrl } : {}),
          phone: uniquePhoneId, // Unique ID instead of fake phone number
          role: payload.role || "Player",
          userType: payload.userType || "Player",
          legalConsents: {
            terms: {
              accepted: true,
              acceptedAt: now.toISOString(),
              version: LEGAL_POLICY_VERSION,
            },
            privacy: {
              accepted: true,
              acceptedAt: now.toISOString(),
              version: LEGAL_POLICY_VERSION,
            },
          },
        },
        include: USER_INCLUDE,
      });

      // Send welcome email for new Google users
      sendWelcomeEmail({
        name: user.name,
        email: user.email,
        role: user.role,
      }).catch((error) => {
        console.error("Failed to send welcome email:", error);
      });
    }
  }

  return user;
};

export interface GraduateDependentPayload {
  parentId: string;
  dependentId: string;
  email: string;
  password: string;
  phone: string;
}

/**
 * Graduate a dependent (child) to an independent user account
 * This function uses a transaction to ensure data integrity
 * ALL bookings where the dependent is the participant are transferred to the new user
 */
export const graduateDependent = async (
  payload: GraduateDependentPayload,
): Promise<UserWithRelations> => {
  // prisma.$transaction auto-commits on success and auto-rolls-back if the
  // callback throws — replacing the manual mongoose startSession/commit/abort.
  const newUser = await prisma.$transaction(async (tx) => {
    // Find the parent user
    const parent = await tx.user.findUnique({
      where: { id: payload.parentId },
    });
    if (!parent) {
      throw new Error("Parent user not found");
    }

    const dependent = await tx.player.findFirst({
      where: {
        id: payload.dependentId,
        userId: payload.parentId,
        type: "DEPENDENT",
      },
    });

    if (!dependent) {
      throw new Error("Dependent not found");
    }

    // Check if dependent is at least 18 years old
    if (dependent.age && dependent.age < 18) {
      throw new Error("Dependent must be at least 18 years old to graduate");
    }

    // Check if email or phone already exists
    const existingUser = await tx.user.findFirst({
      where: { OR: [{ email: payload.email }, { phone: payload.phone }] },
    });
    if (existingUser) {
      throw new Error("User with this email or phone already exists");
    }

    // Create new independent user account
    const hashedPassword = await hashPassword(payload.password);
    const created = await tx.user.create({
      data: {
        name: dependent.name,
        email: payload.email,
        phone: payload.phone,
        password: hashedPassword,
        role: "Player",
        userType: "Player",
      },
      include: USER_INCLUDE,
    });

    // Transfer all bookings where this dependent was the participant.
    // The old $set userId / $unset participantId becomes: set userId and null
    // out participantId in one updateMany.
    const result = await tx.booking.updateMany({
      where: { participantId: dependent.id },
      data: {
        userId: created.id,
        participantId: null,
      },
    });

    console.log(`Transferred ${result.count} bookings to new user`);

    // Remove the dependent from Player collection
    await tx.player.delete({ where: { id: dependent.id } });

    return created;
  });

  // Send welcome email to the new adult user
  sendWelcomeEmail({
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
  }).catch((error) => {
    console.error("Failed to send welcome email:", error);
  });

  return newUser;
};

export interface AddDependentPayload {
  name: string;
  age?: number;
  dob?: string | Date;
  gender?: "MALE" | "FEMALE" | "OTHER";
  relation?: string;
  sportsFocus?: string[];
  sports?: string[];
  skillLevel?: string;
  yearsPlaying?: number;
  personalityTags?: string[];
  primaryObjective?: "Recreational" | "Fitness" | "Compete";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
  location?: string;
}

function calculateAge(dob: Date): number {
  const ageDifMs = Date.now() - dob.getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

export const addDependent = async (
  userId: string,
  payload: AddDependentPayload,
): Promise<Player> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  if (user.role === "Player" && user.userType !== "Parent") {
    throw new Error(
      "Only Parent profiles can add dependents. Please upgrade your profile first.",
    );
  }

  let age = payload.age;
  let parsedDob: Date | undefined;

  if (payload.dob) {
    parsedDob = new Date(payload.dob);
    if (!isNaN(parsedDob.getTime())) {
      age = calculateAge(parsedDob);
    }
  }

  const newDependent = await prisma.player.create({
    data: {
      userId: user.id,
      type: "DEPENDENT",
      name: payload.name,
      age: age ?? null,
      dob: parsedDob ?? null,
      gender: payload.gender ?? null,
      relation: payload.relation ?? null,
      sportsFocus: payload.sportsFocus || payload.sports || [],
      skillLevel: payload.skillLevel || "",
      yearsPlaying: payload.yearsPlaying ?? null,
      personalityTags: payload.personalityTags ?? [],
      primaryObjective: payload.primaryObjective ?? null,
      weeklyTimeCommitment: payload.weeklyTimeCommitment ?? null,
      budgetTier: payload.budgetTier ?? null,
      location: payload.location ?? null,
    },
  });

  return newDependent;
};

export const updateDependent = async (
  userId: string,
  dependentId: string,
  payload: Partial<AddDependentPayload>,
): Promise<Player> => {
  const dependent = await prisma.player.findFirst({
    where: { id: dependentId, userId, type: "DEPENDENT" },
  });
  if (!dependent) {
    throw new Error("Dependent not found");
  }

  const data: Prisma.PlayerUpdateInput = {};

  if (payload.name) data.name = payload.name;

  if (payload.dob) {
    const parsedDob = new Date(payload.dob);
    if (!isNaN(parsedDob.getTime())) {
      data.dob = parsedDob;
      data.age = calculateAge(parsedDob);
    }
  } else if (payload.age !== undefined) {
    data.age = payload.age;
  }

  if (payload.gender) data.gender = payload.gender;
  if (payload.relation) data.relation = payload.relation;
  if (payload.sportsFocus) data.sportsFocus = payload.sportsFocus;
  if (payload.sports) data.sportsFocus = payload.sports;
  if (payload.skillLevel) data.skillLevel = payload.skillLevel;
  if (payload.yearsPlaying !== undefined)
    data.yearsPlaying = payload.yearsPlaying;
  if (payload.personalityTags) data.personalityTags = payload.personalityTags;
  if (payload.primaryObjective)
    data.primaryObjective = payload.primaryObjective;
  if (payload.weeklyTimeCommitment !== undefined)
    data.weeklyTimeCommitment = payload.weeklyTimeCommitment;
  if (payload.budgetTier) data.budgetTier = payload.budgetTier;
  if (payload.location !== undefined) data.location = payload.location;

  const updated = await prisma.player.update({
    where: { id: dependent.id },
    data,
  });
  return updated;
};

export const deleteDependent = async (
  userId: string,
  dependentId: string,
): Promise<void> => {
  const dependent = await prisma.player.findFirst({
    where: { id: dependentId, userId, type: "DEPENDENT" },
  });
  if (!dependent) {
    throw new Error("Dependent not found");
  }

  const bookingCount = await prisma.booking.count({
    where: { participantId: dependentId },
  });

  if (bookingCount > 0) {
    throw new Error(
      `Cannot delete dependent with ${bookingCount} active booking(s). Please cancel or complete these bookings first.`,
    );
  }

  await prisma.player.delete({ where: { id: dependentId } });
};

export const getPlayersByUserId = async (userId: string): Promise<Player[]> => {
  // TODO(prisma): the old Mongo sort `{ type: -1 }` sorts the PlayerType value
  // lexicographically as a string ("SELF" > "DEPENDENT" => SELF first). In
  // Postgres an enum orders by its *declaration order* (SELF=0, DEPENDENT=1),
  // so `type: "desc"` yields DEPENDENT first — the opposite. If the intent is
  // "SELF listed first", switch this to `{ type: "asc" }`. Kept as a mechanical
  // `desc` translation for now.
  return prisma.player.findMany({
    where: { userId },
    orderBy: [{ type: "desc" }, { name: "asc" }],
  });
};

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
  dob?: string | Date;
  userType?:
    | "Parent"
    | "Player"
    | "Coach"
    | "Academy"
    | "VenueLister"
    | "Admin";
  playerProfile?: {
    sports?: string[];
    yearsPlaying?: number;
    personalityTags?: string[];
    primaryObjective?: "Recreational" | "Fitness" | "Compete";
    weeklyTimeCommitment?: number;
    budgetTier?: "Budget" | "Moderate" | "Premium";
    location?: string;
    pathwayState?: {
      satisfiedPrerequisites?: string[];
      currentGpa?: string;
      targetDivision?: string;
      graduationYear?: number;
    };
  };
  shippingAddress?: {
    fullName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export const updateProfile = async (
  userId: string,
  payload: UpdateProfilePayload,
): Promise<UserWithRelations> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  // Check if new email/phone already exists (from other users)
  if (payload.email && payload.email !== user.email) {
    const existingEmailUser = await prisma.user.findFirst({
      where: { email: payload.email },
    });
    if (existingEmailUser) {
      throw new Error("Email already in use");
    }
  }

  if (payload.phone && payload.phone !== user.phone) {
    const existingPhoneUser = await prisma.user.findFirst({
      where: { phone: payload.phone },
    });
    if (existingPhoneUser) {
      throw new Error("Phone number already in use");
    }
  }

  // Update user fields
  const userData: Prisma.UserUpdateInput = {};
  if (payload.name) userData.name = payload.name;
  if (payload.email) userData.email = payload.email;
  if (payload.phone) userData.phone = payload.phone;
  if (payload.dob) userData.dob = new Date(payload.dob);

  // userType change: the old Mongo code had to bypass Mongoose and do a raw
  // collection update because `userType` was the schema discriminatorKey.
  // Prisma has no discriminator, so we simply set the column directly.
  if (payload.userType && payload.userType !== user.userType) {
    userData.userType = payload.userType;
  }

  // Update player profile if provided
  if (payload.playerProfile && Array.isArray(payload.playerProfile.sports)) {
    const pp = payload.playerProfile;

    const pfFields: {
      sportsFocus: string[];
      yearsPlaying?: number;
      personalityTags?: string[];
      primaryObjective?: "Recreational" | "Fitness" | "Compete";
      weeklyTimeCommitment?: number;
      budgetTier?: "Budget" | "Moderate" | "Premium";
      location?: string;
      psSatisfiedPrereqs?: string[];
      psCurrentGpa?: number;
      psTargetDivision?: string;
      psGraduationYear?: number;
    } = { sportsFocus: pp.sports ?? [] };

    if (pp.yearsPlaying !== undefined) pfFields.yearsPlaying = pp.yearsPlaying;
    if (pp.personalityTags) pfFields.personalityTags = pp.personalityTags;
    if (pp.primaryObjective) pfFields.primaryObjective = pp.primaryObjective;
    if (pp.weeklyTimeCommitment !== undefined)
      pfFields.weeklyTimeCommitment = pp.weeklyTimeCommitment;
    if (pp.budgetTier) pfFields.budgetTier = pp.budgetTier;
    if (pp.location !== undefined) pfFields.location = pp.location;

    // The embedded `pathwayState` object was flattened into ps* columns on the
    // Player model. The old code merged the sub-object wholesale; here each key
    // maps to its flattened column.
    if (pp.pathwayState) {
      const ps = pp.pathwayState;
      if (ps.satisfiedPrerequisites !== undefined)
        pfFields.psSatisfiedPrereqs = ps.satisfiedPrerequisites;
      if (ps.currentGpa !== undefined) {
        // TODO(prisma): psCurrentGpa is a Float column but the payload/UI sends
        // currentGpa as a string (Mongo stored it schemaless). Coerce here;
        // non-numeric input is dropped rather than throwing.
        const gpa = Number(ps.currentGpa);
        if (!Number.isNaN(gpa)) pfFields.psCurrentGpa = gpa;
      }
      if (ps.targetDivision !== undefined)
        pfFields.psTargetDivision = ps.targetDivision;
      if (ps.graduationYear !== undefined)
        pfFields.psGraduationYear = ps.graduationYear;
    }

    const selfPlayer = await prisma.player.findFirst({
      where: { userId, type: "SELF" },
    });

    if (!selfPlayer) {
      await prisma.player.create({
        data: {
          userId: user.id,
          type: "SELF",
          name: user.name,
          ...pfFields,
        },
      });
    } else {
      await prisma.player.update({
        where: { id: selfPlayer.id },
        data: { ...pfFields },
      });
    }
  }

  if (payload.shippingAddress) {
    userData.shippingAddress = {
      fullName: payload.shippingAddress.fullName,
      email: payload.shippingAddress.email,
      phone: payload.shippingAddress.phone,
      addressLine1: payload.shippingAddress.addressLine1,
      ...(payload.shippingAddress.addressLine2 !== undefined
        ? { addressLine2: payload.shippingAddress.addressLine2 }
        : {}),
      city: payload.shippingAddress.city,
      state: payload.shippingAddress.state,
      postalCode: payload.shippingAddress.postalCode,
      country: payload.shippingAddress.country || "IN",
    };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: userData,
    include: USER_INCLUDE,
  });

  return updated;
};

/**
 * Get presigned URL for profile picture upload
 */
export const getProfilePictureUploadUrl = async (
  userId: string,
  fileName: string,
  contentType: string,
): Promise<{
  uploadUrl: string;
  downloadUrl: string;
  key: string;
}> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  const s3Service = new S3Service();
  const result = await s3Service.generateProfilePictureUploadUrl(
    fileName,
    contentType,
    userId,
  );

  return {
    uploadUrl: result.uploadUrl,
    downloadUrl: result.downloadUrl,
    key: result.key,
  };
};

/**
 * Confirm profile picture upload and save to user
 */
export const confirmProfilePictureUpload = async (
  userId: string,
  photoUrl: string,
  photoS3Key: string,
): Promise<UserWithRelations> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  return prisma.user.update({
    where: { id: userId },
    data: { photoUrl, photoS3Key },
    include: USER_INCLUDE,
  });
};

/**
 * Add a new address for the user
 */
export const addAddress = async (
  userId: string,
  addressData: {
    fullName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  },
): Promise<UserWithRelations> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { addresses: true },
  });
  if (!user) {
    throw new Error("User not found");
  }

  // Canonicalize on write (Tier 0) so the stored value is consistent even if
  // the request bypassed the UI dropdown.
  const data = normalizeAddressInput(addressData);

  const isDefault = user.addresses.length === 0; // First address is default

  const created = await prisma.address.create({
    data: {
      userId: user.id,
      fullName: data.fullName!,
      email: data.email!,
      phone: data.phone!,
      addressLine1: data.addressLine1!,
      ...(data.addressLine2 !== undefined
        ? { addressLine2: data.addressLine2 }
        : {}),
      city: data.city!,
      state: data.state!,
      postalCode: data.postalCode!,
      country: data.country || "IN",
      isDefault,
    },
  });

  // Set default address ID if this is the first address
  if (isDefault) {
    await prisma.user.update({
      where: { id: user.id },
      data: { defaultAddressId: created.id },
    });
  }

  return loadUserWithRelations(userId);
};

/**
 * Update an existing address
 */
export const updateAddress = async (
  userId: string,
  addressId: string,
  addressData: {
    fullName?: string;
    email?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  },
): Promise<UserWithRelations> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { addresses: true },
  });
  if (!user) {
    throw new Error("User or address not found");
  }

  const address = user.addresses.find((addr) => addr.id === addressId);
  if (!address) {
    throw new Error("Address not found");
  }

  // Canonicalize provided fields on write (Tier 0).
  const data = normalizeAddressInput(addressData);

  // Update address fields
  const updateData: Prisma.AddressUpdateInput = {};
  if (data.fullName) updateData.fullName = data.fullName;
  if (data.email) updateData.email = data.email;
  if (data.phone) updateData.phone = data.phone;
  if (data.addressLine1) updateData.addressLine1 = data.addressLine1;
  if (data.addressLine2 !== undefined)
    updateData.addressLine2 = data.addressLine2;
  if (data.city) updateData.city = data.city;
  if (data.state) updateData.state = data.state;
  if (data.postalCode) updateData.postalCode = data.postalCode;
  if (data.country) updateData.country = data.country;

  // `updatedAt` is maintained automatically by the `@updatedAt` column.
  await prisma.address.update({ where: { id: addressId }, data: updateData });

  return loadUserWithRelations(userId);
};

/**
 * Delete an address
 */
export const deleteAddress = async (
  userId: string,
  addressId: string,
): Promise<UserWithRelations> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { addresses: true },
  });
  if (!user) {
    throw new Error("User or address not found");
  }

  const address = user.addresses.find((addr) => addr.id === addressId);
  if (!address) {
    throw new Error("Address not found");
  }

  await prisma.address.delete({ where: { id: addressId } });

  const remaining = user.addresses.filter((addr) => addr.id !== addressId);

  // If deleted address was default, promote the first remaining one.
  let newDefaultId: string | null = user.defaultAddressId ?? null;
  if (user.defaultAddressId === addressId && remaining.length > 0) {
    newDefaultId = remaining[0]!.id;
    await prisma.address.update({
      where: { id: remaining[0]!.id },
      data: { isDefault: true },
    });
  } else if (remaining.length === 0) {
    newDefaultId = null;
  }

  // Mirror the old "clear isDefault flag if no default is set" cleanup.
  if (!newDefaultId) {
    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { defaultAddressId: newDefaultId },
  });

  return loadUserWithRelations(userId);
};

/**
 * Set default address for user
 */
export const setDefaultAddress = async (
  userId: string,
  addressId: string,
): Promise<UserWithRelations> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { addresses: true },
  });
  if (!user) {
    throw new Error("User or address not found");
  }

  const address = user.addresses.find((addr) => addr.id === addressId);
  if (!address) {
    throw new Error("Address not found");
  }

  // Clear previous default, then set new default.
  await prisma.address.updateMany({
    where: { userId },
    data: { isDefault: false },
  });
  await prisma.address.update({
    where: { id: addressId },
    data: { isDefault: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { defaultAddressId: addressId },
  });

  return loadUserWithRelations(userId);
};

/**
 * Get all addresses for a user
 */
export const getUserAddresses = async (
  userId: string,
): Promise<Address[]> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { addresses: { orderBy: { createdAt: "asc" } } },
  });
  if (!user) {
    throw new Error("User not found");
  }

  return user.addresses;
};

/**
 * Link a Google account to an existing user
 */
export const linkGoogleAccount = async (
  userId: string,
  credential: string,
): Promise<UserWithRelations> => {
  const identity = await verifyGoogleCredential(credential);

  const existingGoogleUser = await prisma.user.findFirst({
    where: { googleId: identity.googleId },
  });
  if (existingGoogleUser && existingGoogleUser.id !== userId) {
    throw new Error("This Google account is already linked to another user.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  const data: Prisma.UserUpdateInput = { googleId: identity.googleId };
  if (!user.photoUrl && identity.photoUrl) {
    data.photoUrl = identity.photoUrl;
  }

  return prisma.user.update({
    where: { id: userId },
    data,
    include: USER_INCLUDE,
  });
};
