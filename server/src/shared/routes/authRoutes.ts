import { Router } from "express";
import type { ClientRateLimitInfo, Store } from "express-rate-limit";
import rateLimit from "express-rate-limit";
import redis from "../../config/redis";
import { authMiddleware } from "../../middleware/auth";
import { loginSchema, registerSchema } from "../../middleware/schemas";
import { validateRequest } from "../../middleware/validation";
import {
  addAddressHandler,
  addDependentHandler,
  changePasswordHandler,
  confirmProfilePictureUploadHandler,
  deleteAccountHandler,
  deleteAddressHandler,
  deleteDependentHandler,
  forgotPassword,
  getAddressesHandler,
  getAuthBridge,
  getMyPlayersHandler,
  getProfile,
  getProfilePictureUploadUrlHandler,
  googleAuth,
  graduateDependentHandler,
  linkGoogleHandler,
  login,
  logout,
  register,
  resetPasswordHandler,
  setDefaultAddressHandler,
  updateAddressHandler,
  updateDependentHandler,
  updateProfileHandler,
} from "../controller/authController";

const router = Router();

const createRedisRateLimitStore = (prefix: string): Store => {
  let windowMs = 60 * 1000;

  return {
    prefix,
    localKeys: false,
    init(options) {
      windowMs = options.windowMs;
    },
    async increment(key: string): Promise<ClientRateLimitInfo> {
      try {
        const redisKey = `${prefix}${key}`;
        const totalHits = await redis.incr(redisKey);
        if (totalHits === 1) {
          await redis.pexpire(redisKey, windowMs);
        }

        const ttl = await redis.pttl(redisKey);
        return {
          totalHits,
          resetTime:
            ttl > 0
              ? new Date(Date.now() + ttl)
              : new Date(Date.now() + windowMs),
        };
      } catch {
        return {
          totalHits: 1,
          resetTime: new Date(Date.now() + windowMs),
        };
      }
    },
    async decrement(key: string): Promise<void> {
      try {
        const redisKey = `${prefix}${key}`;
        await redis.decr(redisKey);
      } catch {
        // fail open
      }
    },
    async resetKey(key: string): Promise<void> {
      try {
        await redis.del(`${prefix}${key}`);
      } catch {
        // fail open
      }
    },
    async resetAll(): Promise<void> {
      // Not used in this app.
    },
    async shutdown(): Promise<void> {
      // No resources to release.
    },
  };
};

// Max 10 login attempts per 15 minutes per IP — failed attempts only
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisRateLimitStore("rl:auth:login:"),
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

// Max 5 password reset requests per hour per IP
const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisRateLimitStore("rl:auth:forgot-password:"),
  message: {
    success: false,
    message: "Too many password reset requests. Please try again in 1 hour.",
  },
});

const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisRateLimitStore("rl:auth:register:"),
  message: {
    success: false,
    message: "Too many registration attempts. Please try again in 1 hour.",
  },
});

const resetPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisRateLimitStore("rl:auth:reset-password:"),
  message: {
    success: false,
    message:
      "Too many password reset attempts. Please try again in 15 minutes.",
  },
});

// Both require the current password, so brute-forcing it needs the same
// throttle as login.
const changePasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisRateLimitStore("rl:auth:change-password:"),
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});

const deleteAccountRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisRateLimitStore("rl:auth:delete-account:"),
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});

router.post(
  "/register",
  registerRateLimiter,
  validateRequest(registerSchema),
  register,
);
router.post("/login", loginRateLimiter, validateRequest(loginSchema), login);
router.post("/logout", authMiddleware, logout);
router.get("/profile", authMiddleware, getProfile);
router.get("/bridge", authMiddleware, getAuthBridge);
router.put("/profile", authMiddleware, updateProfileHandler);
router.post("/forgot-password", forgotPasswordRateLimiter, forgotPassword);
router.post("/reset-password", resetPasswordRateLimiter, resetPasswordHandler);
router.post("/google", googleAuth);
router.post("/google/link", authMiddleware, linkGoogleHandler);
router.post("/graduate", authMiddleware, graduateDependentHandler);
router.put(
  "/change-password",
  authMiddleware,
  changePasswordRateLimiter,
  changePasswordHandler,
);
router.post(
  "/delete-account",
  authMiddleware,
  deleteAccountRateLimiter,
  deleteAccountHandler,
);

// Profile picture endpoints
router.post(
  "/profile-picture/upload-url",
  authMiddleware,
  getProfilePictureUploadUrlHandler,
);
router.post(
  "/profile-picture/confirm",
  authMiddleware,
  confirmProfilePictureUploadHandler,
);

// Dependent management endpoints
router.get("/players", authMiddleware, getMyPlayersHandler);
router.post("/dependents", authMiddleware, addDependentHandler);
router.put("/dependents/:dependentId", authMiddleware, updateDependentHandler);
router.delete(
  "/dependents/:dependentId",
  authMiddleware,
  deleteDependentHandler,
);

// Address management endpoints
router.get("/addresses", authMiddleware, getAddressesHandler);
router.post("/addresses", authMiddleware, addAddressHandler);
router.put("/addresses/:addressId", authMiddleware, updateAddressHandler);
router.delete("/addresses/:addressId", authMiddleware, deleteAddressHandler);
router.patch(
  "/addresses/:addressId/set-default",
  authMiddleware,
  setDefaultAddressHandler,
);

export default router;
