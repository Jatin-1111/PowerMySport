import nodemailer from "nodemailer";

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendEmail = async (options: SendEmailOptions): Promise<void> => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"PowerMySport" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent: ${info.messageId}`);
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    // Don't throw error to prevent registration from failing if email fails
  }
};

interface WelcomeEmailOptions {
  name: string;
  email: string;
  role: string;
}

export const sendWelcomeEmail = async (
  options: WelcomeEmailOptions,
): Promise<void> => {
  const roleNames: Record<string, string> = {
    PLAYER: "Player",
    VENUE_LISTER: "Venue Lister",
    COACH: "Coach",
    ADMIN: "Admin",
  };

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
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: #ff6b35;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 14px;
    }
    .feature-box {
      background: white;
      padding: 15px;
      margin: 15px 0;
      border-left: 4px solid #ff6b35;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚽ Welcome to PowerMySport!</h1>
  </div>
  
  <div class="content">
    <h2>Hi ${options.name}! 👋</h2>
    
    <p>Thank you for joining <strong>PowerMySport</strong> as a <strong>${roleNames[options.role] || "User"}</strong>!</p>
    
    <p>We're excited to have you as part of our sports community. Your account has been successfully created and you're all set to get started.</p>
    
    ${
      options.role === "PLAYER"
        ? `
    <div class="feature-box">
      <h3>🎯 As a Player, you can:</h3>
      <ul>
        <li>Browse and book sports venues</li>
        <li>Find and book coaching sessions</li>
        <li>Track your bookings and payment history</li>
        <li>Discover new sports facilities in your area</li>
      </ul>
    </div>
    `
        : options.role === "COACH"
          ? `
    <div class="feature-box">
      <h3>🏆 As a Coach, you can:</h3>
      <ul>
        <li>Create and manage your coaching profile</li>
        <li>Set your availability and pricing</li>
        <li>Accept bookings from players</li>
        <li>Track your earnings and sessions</li>
      </ul>
    </div>
    `
          : options.role === "VENUE_LISTER"
            ? `
    <div class="feature-box">
      <h3>🏟️ As a Venue Lister, you can:</h3>
      <ul>
        <li>List and manage your sports venues</li>
        <li>Set pricing and availability</li>
        <li>Accept bookings from players</li>
        <li>Track revenue and venue usage</li>
      </ul>
    </div>
    `
            : ""
    }
    
    <center>
      <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/login" class="button">
        Get Started →
      </a>
    </center>
    
    <p>If you have any questions or need assistance, feel free to reach out to our support team.</p>
    
    <p>Best regards,<br>
    <strong>The PowerMySport Team</strong></p>
  </div>
  
  <div class="footer">
    <p>This email was sent to ${options.email}</p>
    <p>© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.email,
    subject: "Welcome to PowerMySport! 🎉",
    html,
  });
};

interface PasswordResetEmailOptions {
  name: string;
  email: string;
  resetToken: string;
}

export const sendPasswordResetEmail = async (
  options: PasswordResetEmailOptions,
): Promise<void> => {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${options.resetToken}`;

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
    .content {
      background: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: #ff6b35;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
    }
    .warning-box {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      border-radius: 5px;
      margin: 15px 0;
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
    <h1>🔐 Password Reset Request</h1>
  </div>
  
  <div class="content">
    <h2>Hi ${options.name},</h2>
    
    <p>We received a request to reset your password for your PowerMySport account.</p>
    
    <p>Click the button below to reset your password. This link will expire in <strong>1 hour</strong>.</p>
    
    <center>
      <a href="${resetUrl}" class="button">
        Reset Password
      </a>
    </center>
    
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #666; font-size: 12px;">${resetUrl}</p>
    
    <div class="warning-box">
      <strong>⚠️ Important:</strong> If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.
    </div>
    
    <p>Best regards,<br>
    <strong>The PowerMySport Team</strong></p>
  </div>
  
  <div class="footer">
    <p>This email was sent to ${options.email}</p>
    <p>© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.email,
    subject: "Reset Your Password - PowerMySport",
    html,
  });
};
