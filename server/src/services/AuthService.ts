import { User, UserDocument } from "../models/User";
import { generateToken } from "../utils/jwt";
import { IUserPayload } from "../types/index";

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "PLAYER" | "VENUE_LISTER" | "COACH";
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const registerUser = async (
  payload: RegisterPayload,
): Promise<UserDocument> => {
  const existingUser = await User.findOne({
    $or: [{ email: payload.email }, { phone: payload.phone }],
  });

  if (existingUser) {
    throw new Error("User with this email or phone already exists");
  }

  const user = new User(payload);
  await user.save();
  return user;
};

export const loginUser = async (
  payload: LoginPayload,
): Promise<UserDocument> => {
  const user = await User.findOne({ email: payload.email }).select("+password");

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isPasswordValid = await user.comparePassword(payload.password);

  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  return user;
};

export const getUserById = async (id: string): Promise<UserDocument | null> => {
  return User.findById(id);
};
