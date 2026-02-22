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

interface CoachVerificationStatusEmailOptions {
  name: string;
  email: string;
  status: "PENDING" | "REVIEW" | "VERIFIED" | "REJECTED";
  notes?: string;
}

export const sendCoachVerificationStatusEmail = async (
  options: CoachVerificationStatusEmailOptions,
): Promise<void> => {
  const statusLabels: Record<string, string> = {
    PENDING: "Pending",
    REVIEW: "In Review",
    VERIFIED: "Verified",
    REJECTED: "Rejected",
  };

  const statusMessage = statusLabels[options.status] || options.status;
  const actionCopy =
    options.status === "VERIFIED"
      ? "Your coach profile is now verified and will display a Verified badge."
      : options.status === "REJECTED"
        ? "Your verification was rejected. Please review the notes and resubmit."
        : "We are reviewing your verification. We will notify you once it's updated.";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 24px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 24px; border-radius: 0 0 10px 10px; }
    .badge { display: inline-block; padding: 6px 12px; background: #fff; border-radius: 999px; font-weight: bold; }
    .note { background: #fff3cd; border: 1px solid #ffeeba; padding: 12px; border-radius: 8px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Coach Verification Update</h1>
  </div>
  <div class="content">
    <p>Hi ${options.name},</p>
    <p>Your coach verification status is now:</p>
    <p><span class="badge">${statusMessage}</span></p>
    <p>${actionCopy}</p>
    ${options.notes ? `<div class="note"><strong>Notes:</strong> ${options.notes}</div>` : ""}
    <p style="margin-top: 20px;">Thanks,<br/>PowerMySport Team</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.email,
    subject: `Coach verification status: ${statusMessage}`,
    html,
  });
};

interface CredentialsEmailOptions {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}

export const sendCredentialsEmail = async (
  options: CredentialsEmailOptions,
): Promise<void> => {
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
    .credentials-box {
      background: #e8f4fd;
      border: 1px solid #b6d4fe;
      padding: 20px;
      border-radius: 5px;
      margin: 20px 0;
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
    <h1>🎉 Inquiry Approved!</h1>
  </div>
  
  <div class="content">
    <h2>Hi ${options.name},</h2>
    
    <p>Good news! Your venue inquiry has been approved. You can now login to your Venue Lister Dashboard and start managing your venue.</p>
    
    <div class="credentials-box">
      <h3>🔐 Your Login Credentials</h3>
      <p><strong>Email:</strong> ${options.email}</p>
      <p><strong>Password:</strong> ${options.password}</p>
      <p><em>Please change your password after your first login.</em></p>
    </div>
    
    <center>
      <a href="${options.loginUrl}" class="button">
        Login to Dashboard
      </a>
    </center>
    
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
    subject: "Your Venue Lister Account Approved! 🏟️",
    html,
  });
};

interface BookingConfirmationEmailOptions {
  name: string;
  email: string;
  venueName: string;
  sport: string;
  date: Date;
  startTime: string;
  endTime: string;
  totalAmount: number;
  checkInCode?: string;
}

export const sendBookingConfirmationEmail = async (
  options: BookingConfirmationEmailOptions,
): Promise<void> => {
  const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const bookingsUrl = `${frontendBaseUrl}/dashboard/my-bookings`;
  const bookingDate = options.date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const amountPaid = options.totalAmount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
    Payment successful. Your booking is confirmed and ready in your dashboard.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;padding:28px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background-color:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f9d58 0%,#22c55e 100%);padding:30px 28px 24px;text-align:center;">
              <div style="font-size:34px;line-height:34px;">✅</div>
              <h1 style="margin:12px 0 0;font-size:30px;line-height:34px;color:#ffffff;font-weight:800;">Booking Confirmed</h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:22px;color:#dcfce7;">Your payment is successful and your slot is now reserved.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 28px 22px;background-color:#ffffff;">
              <p style="margin:0 0 8px;font-size:18px;line-height:26px;color:#0f172a;font-weight:700;">Hi ${options.name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;">Thanks for booking with PowerMySport. Your session is confirmed and ready to view.</p>

              <div style="display:inline-block;background-color:#ecfdf3;border:1px solid #bbf7d0;color:#15803d;font-size:12px;font-weight:700;line-height:12px;padding:8px 12px;border-radius:999px;margin-bottom:16px;">PAYMENT SUCCESSFUL</div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:0 16px;">
                <tr>
                  <td colspan="2" style="padding:14px 0 10px;font-size:15px;line-height:20px;color:#1e293b;font-weight:800;">Booking Summary</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;font-size:13px;color:#64748b;">Venue</td>
                  <td style="padding:10px 0;font-size:13px;color:#0f172a;font-weight:700;text-align:right;">${options.venueName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Sport</td>
                  <td style="padding:10px 0;border-top:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:700;text-align:right;">${options.sport}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Date</td>
                  <td style="padding:10px 0;border-top:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:700;text-align:right;">${bookingDate}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Time</td>
                  <td style="padding:10px 0;border-top:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:700;text-align:right;">${options.startTime} - ${options.endTime}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0 14px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Amount Paid</td>
                  <td style="padding:12px 0 14px;border-top:1px solid #e2e8f0;font-size:16px;color:#15803d;font-weight:800;text-align:right;">₹${amountPaid}</td>
                </tr>
                ${
                  options.checkInCode
                    ? `<tr>
                  <td style="padding:12px 0 14px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Check-in Code</td>
                  <td style="padding:12px 0 14px;border-top:1px solid #e2e8f0;font-size:16px;color:#0f172a;font-weight:800;text-align:right;font-family:monospace;letter-spacing:2px;">${options.checkInCode}</td>
                </tr>`
                    : ""
                }
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                <tr>
                  <td align="center">
                    <a href="${bookingsUrl}" style="display:inline-block;padding:13px 28px;background-color:#ff6b35;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:800;letter-spacing:0.2px;">View My Bookings</a>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                <tr>
                  <td align="center" style="font-size:12px;line-height:18px;color:#94a3b8;">
                    Need help? Reach us from the app support section.<br/>
                    © ${new Date().getFullYear()} PowerMySport. All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await sendEmail({
    to: options.email,
    subject: "Your Booking is Confirmed ✨ | PowerMySport",
    html,
  });
};
