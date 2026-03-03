import crypto from "crypto";
import { sendEmail } from "../utils/email";
import { EmailVerification } from "../models/EmailVerification";
import { RateLimit } from "../models/RateLimit";

// Configuration
const CODE_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_REQUESTS = 3;
const RATE_LIMIT_WINDOW_HOURS = 1;

/**
 * Generate a 6-digit OTP code
 */
const generateOTP = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Check if email has exceeded rate limit
 */
export const checkRateLimit = async (email: string): Promise<boolean> => {
  const now = new Date();
  const limit = await RateLimit.findOne({
    key: email.toLowerCase(),
    type: "EMAIL_VERIFICATION",
  });

  if (!limit) {
    return true; // No limit yet, allow
  }

  if (now > limit.resetAt) {
    // Reset window has passed, delete old record
    await RateLimit.deleteOne({ _id: limit._id });
    return true;
  }

  return limit.count < RATE_LIMIT_REQUESTS;
};

/**
 * Increment rate limit counter
 */
const incrementRateLimit = async (email: string): Promise<void> => {
  const now = new Date();
  const resetAt = new Date(
    now.getTime() + RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000,
  );

  await RateLimit.findOneAndUpdate(
    {
      key: email.toLowerCase(),
      type: "EMAIL_VERIFICATION",
    },
    {
      $inc: { count: 1 },
      $setOnInsert: { resetAt },
    },
    {
      upsert: true,
      new: true,
    },
  );
};

/**
 * Send verification code to email
 */
export const sendVerificationCode = async (
  email: string,
  name: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    // Check rate limit
    const canProceed = await checkRateLimit(email);
    if (!canProceed) {
      const limit = await RateLimit.findOne({
        key: email.toLowerCase(),
        type: "EMAIL_VERIFICATION",
      });
      const minutesLeft = limit
        ? Math.ceil((limit.resetAt.getTime() - Date.now()) / (60 * 1000))
        : 0;
      return {
        success: false,
        message: `Too many verification requests. Please try again in ${minutesLeft} minutes.`,
      };
    }

    // Generate OTP
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    // Store/update verification code in database
    await EmailVerification.findOneAndUpdate(
      { email: email.toLowerCase(), verified: false },
      {
        code,
        email: email.toLowerCase(),
        expiresAt,
        attempts: 0,
        verified: false,
      },
      {
        upsert: true,
        new: true,
      },
    );

    // Increment rate limit
    await incrementRateLimit(email);

    // Send email
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .code-box {
      background: white;
      border: 2px dashed #ff6b35;
      padding: 20px;
      text-align: center;
      border-radius: 10px;
      margin: 20px 0;
    }
    .code {
      font-size: 36px;
      font-weight: bold;
      letter-spacing: 8px;
      color: #ff6b35;
      font-family: 'Courier New', monospace;
    }
    .warning-box {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      border-radius: 5px;
      margin: 15px 0;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔐 Email Verification</h1>
  </div>
  
  <div class="content">
    <h2>Hi ${name}! 👋</h2>
    
    <p>Thank you for starting your venue onboarding with <strong>PowerMySport</strong>!</p>
    
    <p>To verify your email address and continue with the onboarding process, please enter the following verification code:</p>
    
    <div class="code-box">
      <div class="code">${code}</div>
      <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">This code will expire in ${CODE_EXPIRY_MINUTES} minutes</p>
    </div>
    
    <div class="warning-box">
      <strong>⚠️ Security Note:</strong> If you didn't request this verification code, please ignore this email. Someone may have entered your email address by mistake.
    </div>
    
    <p>Best regards,<br>
    <strong>The PowerMySport Team</strong></p>
  </div>
  
  <div class="footer">
    <p>This email was sent to ${email}</p>
    <p>© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
  </div>
</body>
</html>
    `;

    await sendEmail({
      to: email,
      subject: "Verify Your Email - PowerMySport Venue Onboarding",
      html,
    });

    console.log(`✅ Verification code sent to ${email}`);

    return {
      success: true,
      message: "Verification code sent successfully",
    };
  } catch (error) {
    console.error("❌ Failed to send verification code:", error);
    return {
      success: false,
      message: "Failed to send verification code. Please try again.",
    };
  }
};

/**
 * Verify the submitted code
 */
export const verifyCode = async (
  email: string,
  submittedCode: string,
): Promise<{ success: boolean; message: string }> => {
  const stored = await EmailVerification.findOne({
    email: email.toLowerCase(),
    verified: false,
  });

  if (!stored) {
    return {
      success: false,
      message: "No verification code found. Please request a new code.",
    };
  }

  // Check expiry
  if (new Date() > stored.expiresAt) {
    await EmailVerification.deleteOne({ _id: stored._id });
    return {
      success: false,
      message: "Verification code has expired. Please request a new code.",
    };
  }

  // Check attempts
  if (stored.attempts >= MAX_ATTEMPTS) {
    await EmailVerification.deleteOne({ _id: stored._id });
    return {
      success: false,
      message: "Too many failed attempts. Please request a new code.",
    };
  }

  // Verify code
  if (stored.code !== submittedCode) {
    stored.attempts++;
    await stored.save();
    return {
      success: false,
      message: `Invalid code. ${MAX_ATTEMPTS - stored.attempts} attempts remaining.`,
    };
  }

  // Success - mark as verified
  stored.verified = true;
  await stored.save();

  return {
    success: true,
    message: "Email verified successfully",
  };
};

/**
 * Clean up expired codes and rate limits
 * Note: This is handled automatically by MongoDB TTL indexes,
 * but can be called manually if needed
 */
export const cleanupExpiredCodes = async (): Promise<void> => {
  const now = new Date();

  // Delete expired verification codes
  await EmailVerification.deleteMany({
    expiresAt: { $lt: now },
  });

  // Delete expired rate limits
  await RateLimit.deleteMany({
    resetAt: { $lt: now },
  });
};
