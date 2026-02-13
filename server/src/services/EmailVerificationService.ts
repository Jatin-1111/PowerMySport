import crypto from "crypto";
import { sendEmail } from "../utils/email";

// In-memory store for verification codes (in production, use Redis)
interface VerificationCode {
  code: string;
  email: string;
  expiresAt: Date;
  attempts: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

const verificationCodes = new Map<string, VerificationCode>();
const rateLimits = new Map<string, RateLimitEntry>();

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
export const checkRateLimit = (email: string): boolean => {
  const now = new Date();
  const limit = rateLimits.get(email);

  if (!limit) {
    return true; // No limit yet, allow
  }

  if (now > limit.resetAt) {
    // Reset window has passed
    rateLimits.delete(email);
    return true;
  }

  return limit.count < RATE_LIMIT_REQUESTS;
};

/**
 * Increment rate limit counter
 */
const incrementRateLimit = (email: string): void => {
  const now = new Date();
  const limit = rateLimits.get(email);

  if (!limit || now > limit.resetAt) {
    // Create new rate limit window
    rateLimits.set(email, {
      count: 1,
      resetAt: new Date(
        now.getTime() + RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000,
      ),
    });
  } else {
    limit.count++;
  }
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
    if (!checkRateLimit(email)) {
      const limit = rateLimits.get(email);
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

    // Store verification code
    verificationCodes.set(email, {
      code,
      email,
      expiresAt,
      attempts: 0,
    });

    // Increment rate limit
    incrementRateLimit(email);

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
export const verifyCode = (
  email: string,
  submittedCode: string,
): { success: boolean; message: string } => {
  const stored = verificationCodes.get(email);

  if (!stored) {
    return {
      success: false,
      message: "No verification code found. Please request a new code.",
    };
  }

  // Check expiry
  if (new Date() > stored.expiresAt) {
    verificationCodes.delete(email);
    return {
      success: false,
      message: "Verification code has expired. Please request a new code.",
    };
  }

  // Check attempts
  if (stored.attempts >= MAX_ATTEMPTS) {
    verificationCodes.delete(email);
    return {
      success: false,
      message: "Too many failed attempts. Please request a new code.",
    };
  }

  // Verify code
  if (stored.code !== submittedCode) {
    stored.attempts++;
    return {
      success: false,
      message: `Invalid code. ${MAX_ATTEMPTS - stored.attempts} attempts remaining.`,
    };
  }

  // Success - remove code
  verificationCodes.delete(email);

  return {
    success: true,
    message: "Email verified successfully",
  };
};

/**
 * Clean up expired codes (should be run periodically)
 */
export const cleanupExpiredCodes = (): void => {
  const now = new Date();

  for (const [email, data] of verificationCodes.entries()) {
    if (now > data.expiresAt) {
      verificationCodes.delete(email);
    }
  }

  for (const [email, limit] of rateLimits.entries()) {
    if (now > limit.resetAt) {
      rateLimits.delete(email);
    }
  }
};

// Run cleanup every 10 minutes
setInterval(cleanupExpiredCodes, 10 * 60 * 1000);
