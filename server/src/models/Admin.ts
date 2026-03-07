import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import { ALL_PERMISSIONS, ADMIN_ROLES } from "../constants/adminPermissions";

export interface IAdmin extends Document {
  name: string;
  email: string;
  password: string;
  mustChangePassword: boolean;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const AdminSchema: Schema = new Schema(
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
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      required: [true, "Role is required"],
      enum: Object.values(ADMIN_ROLES),
      default: ADMIN_ROLES.SUPPORT_ADMIN,
    },
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator: function (permissions: string[]) {
          // All permissions must be from the defined permission set
          const validPermissions = ALL_PERMISSIONS as readonly string[];
          return permissions.every((perm) => validPermissions.includes(perm));
        },
        message: "Invalid permission(s) found",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Hash password before saving
AdminSchema.pre<IAdmin>("save", async function () {
  if (!this.isModified("password")) {
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
AdminSchema.methods.comparePassword = async function (
  password: string,
): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

// Index for faster queries
AdminSchema.index({ isActive: 1 });

export default mongoose.model<IAdmin>("Admin", AdminSchema);
