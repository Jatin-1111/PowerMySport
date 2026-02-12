import bcrypt from "bcryptjs";
import mongoose, { Document, Schema } from "mongoose";
import { IPlayerProfile, IVenueListerProfile, UserRole } from "../types";

export interface UserDocument extends Document {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  password?: string;
  googleId?: string;
  photoUrl?: string;
  photoS3Key?: string; // S3 key for profile picture
  dob?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  playerProfile?: IPlayerProfile;
  venueListerProfile?: IVenueListerProfile;
  dependents: Array<{
    _id?: mongoose.Types.ObjectId;
    name: string;
    dob: Date;
    gender?: "MALE" | "FEMALE" | "OTHER";
    relation?: string;
    sports?: string[];
  }>;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
  refreshPhotoUrl(): Promise<void>;
}

const userSchema = new Schema<UserDocument>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
    },
    role: {
      type: String,
      enum: ["PLAYER", "VENUE_LISTER", "COACH", "ADMIN"],
      default: "PLAYER",
    },
    playerProfile: {
      paymentHistory: [
        {
          bookingId: {
            type: Schema.Types.ObjectId,
            ref: "Booking",
          },
          amount: Number,
          date: Date,
        },
      ],
    },
    venueListerProfile: {
      businessDetails: {
        name: String,
        gstNumber: String,
        address: String,
      },
      payoutInfo: {
        accountNumber: String,
        ifsc: String,
        bankName: String,
      },
      canAddMoreVenues: {
        type: Boolean,
        default: false,
      },
    },
    password: {
      type: String,
      required: function (this: UserDocument) {
        return !this.googleId;
      },
      minlength: 6,
      select: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    photoUrl: {
      type: String,
    },
    photoS3Key: {
      type: String,
    },
    dob: {
      type: Date,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    dependents: [
      {
        name: {
          type: String,
          required: true,
        },
        dob: {
          type: Date,
          required: true,
        },
        gender: {
          type: String,
          enum: ["MALE", "FEMALE", "OTHER"],
        },
        relation: {
          type: String,
          default: "CHILD",
        },
        sports: [String],
      },
    ],
  },
  { timestamps: true },
);

// Hash password before saving
userSchema.pre<UserDocument>("save", async function () {
  if (!this.isModified("password") || !this.password) {
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error instanceof Error ? error : new Error("Password hashing failed");
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (
  password: string,
): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

// Method to refresh profile photo URL from S3 key
userSchema.methods.refreshPhotoUrl = async function (
  this: UserDocument,
): Promise<void> {
  if (!this.photoS3Key) return;

  try {
    const { S3Service } = require("../services/S3Service");
    const s3Service = new S3Service();
    this.photoUrl = await s3Service.generateDownloadUrl(
      this.photoS3Key,
      "images",
      604800, // 7 days
    );
  } catch (error) {
    console.error("Failed to refresh profile photo URL:", error);
  }
};

export const User = mongoose.model<UserDocument>("User", userSchema);
