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
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  playerProfile?: IPlayerProfile;
  venueListerProfile?: IVenueListerProfile;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
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
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
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

export const User = mongoose.model<UserDocument>("User", userSchema);
