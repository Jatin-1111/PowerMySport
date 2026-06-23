import bcrypt from "bcryptjs";
import mongoose, { Document, Schema } from "mongoose";
import { S3Service } from "../../shared/services/S3Service";
import { UserRole } from "../../types/index";

export interface UserDocument extends Document {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  userType:
    | "Parent"
    | "Recreational"
    | "Coach"
    | "Academy"
    | "VenueLister"
    | "Admin";
  password?: string;
  googleId?: string;
  photoUrl?: string;
  photoS3Key?: string;
  city?: string;
  lastActiveAt?: Date;
  dob?: Date;
  legalConsents?: {
    terms?: { accepted: boolean; acceptedAt?: Date; version?: string };
    privacy?: { accepted: boolean; acceptedAt?: Date; version?: string };
  };
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  notificationPreferences?: {
    email?: any;
    push?: any;
    inApp?: any;
  };
  reminderPreferences?: any;
  pushSubscriptions?: any[];
  isActive: boolean;
  suspensionReason?: string;
  suspendedAt?: Date;
  suspendedBy?: mongoose.Types.ObjectId;
  deactivatedAt?: Date;
  refundMethods?: Array<{
    id?: string;
    type: "ORIGINAL_CARD" | "BANK_ACCOUNT" | "STORE_CREDIT";
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    isDefault?: boolean;
    addedAt?: Date;
    updatedAt?: Date;
  }>;
  addresses?: Array<{
    _id?: mongoose.Types.ObjectId;
    fullName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    isDefault?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
  defaultAddressId?: mongoose.Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
  refreshPhotoUrl(): Promise<void>;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: [true, "Name is required"], trim: true },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
    },
    role: {
      type: String,
      enum: ["PLAYER", "VENUE_LISTER", "COACH", "ACADEMY_OWNER", "ADMIN"],
      default: "PLAYER",
    },
    userType: {
      type: String,
      enum: [
        "Parent",
        "Recreational",
        "Coach",
        "Academy",
        "VenueLister",
        "Admin",
      ],
      default: "Recreational",
    },
    password: {
      type: String,
      required: function (this: UserDocument) {
        return !this.googleId;
      },
      minlength: 6,
      select: false,
    },
    googleId: { type: String, unique: true, sparse: true },
    photoUrl: { type: String },
    photoS3Key: { type: String },
    city: { type: String, trim: true },
    lastActiveAt: { type: Date, default: Date.now, index: true },
    dob: { type: Date },
    legalConsents: {
      terms: {
        accepted: { type: Boolean, default: false },
        acceptedAt: { type: Date },
        version: { type: String },
      },
      privacy: {
        accepted: { type: Boolean, default: false },
        acceptedAt: { type: Date },
        version: { type: String },
      },
    },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },

    // Notification & Reminders Simplified for brevity, retaining exact types is generally okay,
    // but I'll add the full object so it doesn't break TS.
    notificationPreferences: {
      email: {
        friendRequests: { type: Boolean, default: true },
        bookingInvitations: { type: Boolean, default: true },
        bookingConfirmations: { type: Boolean, default: true },
        bookingReminders: { type: Boolean, default: true },
        bookingCancellations: { type: Boolean, default: true },
        reviews: { type: Boolean, default: true },
        payments: { type: Boolean, default: true },
        admin: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
      },
      push: {
        friendRequests: { type: Boolean, default: true },
        bookingInvitations: { type: Boolean, default: true },
        bookingConfirmations: { type: Boolean, default: true },
        bookingReminders: { type: Boolean, default: true },
        bookingCancellations: { type: Boolean, default: true },
        reviews: { type: Boolean, default: true },
        payments: { type: Boolean, default: true },
        admin: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
      },
      inApp: {
        friendRequests: { type: Boolean, default: true },
        bookingInvitations: { type: Boolean, default: true },
        bookingConfirmations: { type: Boolean, default: true },
        bookingReminders: { type: Boolean, default: true },
        bookingCancellations: { type: Boolean, default: true },
        reviews: { type: Boolean, default: true },
        payments: { type: Boolean, default: true },
        admin: { type: Boolean, default: true },
        marketing: { type: Boolean, default: true },
      },
    },
    reminderPreferences: {
      bookingReminders: {
        enabled: { type: Boolean, default: true },
        intervals: {
          twentyFourHours: { type: Boolean, default: true },
          oneHour: { type: Boolean, default: true },
          fifteenMinutes: { type: Boolean, default: true },
        },
      },
    },
    pushSubscriptions: [
      {
        endpoint: { type: String, required: true },
        keys: {
          p256dh: { type: String, required: true },
          auth: { type: String, required: true },
        },
        userAgent: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isActive: { type: Boolean, default: true, index: true },
    suspensionReason: { type: String, default: "", maxlength: 500 },
    suspendedAt: { type: Date, default: null },
    suspendedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
    deactivatedAt: { type: Date, default: null },
    refundMethods: [
      {
        type: {
          type: String,
          enum: ["ORIGINAL_CARD", "BANK_ACCOUNT", "STORE_CREDIT"],
          default: "ORIGINAL_CARD",
        },
        accountHolderName: { type: String, trim: true },
        accountNumber: { type: String, trim: true },
        ifscCode: { type: String, trim: true, uppercase: true },
        bankName: { type: String, trim: true },
        isDefault: { type: Boolean, default: false },
        addedAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    addresses: [
      {
        fullName: { type: String, trim: true, required: true },
        email: { type: String, trim: true, lowercase: true, required: true },
        phone: { type: String, trim: true, required: true },
        addressLine1: { type: String, trim: true, required: true },
        addressLine2: { type: String, trim: true },
        city: { type: String, trim: true, required: true },
        state: { type: String, trim: true, required: true },
        postalCode: { type: String, trim: true, required: true },
        country: { type: String, trim: true, default: "IN", required: true },
        isDefault: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    defaultAddressId: { type: Schema.Types.ObjectId, default: null },
    shippingAddress: {
      fullName: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
      addressLine1: { type: String, trim: true },
      addressLine2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true, default: "IN" },
    },
  },
  { timestamps: true, discriminatorKey: "userType" },
);

userSchema.pre<UserDocument>("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error instanceof Error ? error : new Error("Password hashing failed");
  }
});

userSchema.methods.comparePassword = async function (
  password: string,
): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.refreshPhotoUrl = async function (
  this: UserDocument,
): Promise<void> {
  if (!this.photoS3Key) return;
  try {
    const s3Service = new S3Service();
    this.photoUrl = await s3Service.generateDownloadUrl(
      this.photoS3Key,
      "images",
      604800,
    );
  } catch (error) {
    console.error("Failed to refresh profile photo URL:", error);
  }
};

userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ role: 1, isActive: 1 });

export const User = mongoose.model<UserDocument>("User", userSchema);

// Discriminators for Hierarchical User Collection
export const ParentUser = User.discriminator(
  "ParentUser",
  new Schema({}),
  "Parent",
);
export const RecreationalUser = User.discriminator(
  "RecreationalUser",
  new Schema({}),
  "Recreational",
);
export const CoachUser = User.discriminator(
  "CoachUser",
  new Schema({}),
  "Coach",
);
export const AcademyOwnerUser = User.discriminator(
  "AcademyOwnerUser",
  new Schema({}),
  "Academy",
);
export const VenueListerUser = User.discriminator(
  "VenueListerUser",
  new Schema({}),
  "VenueLister",
);
