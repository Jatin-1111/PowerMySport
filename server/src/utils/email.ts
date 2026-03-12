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

interface FriendRequestEmailOptions {
  recipientName: string;
  recipientEmail: string;
  requesterName: string;
  requesterPhotoUrl?: string | undefined;
}

export const sendFriendRequestEmail = async (
  options: FriendRequestEmailOptions,
): Promise<void> => {
  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/friends`;

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
    .user-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: center;
      border: 2px solid #ff6b35;
    }
    .avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      margin: 0 auto 15px;
      ${options.requesterPhotoUrl ? `background-image: url(${options.requesterPhotoUrl});` : "background-color: #ff6b35;"}
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 32px;
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
  </style>
</head>
<body>
  <div class="header">
    <h1>👥 New Friend Request!</h1>
  </div>
  
  <div class="content">
    <h2>Hi ${options.recipientName},</h2>
    
    <p><strong>${options.requesterName}</strong> wants to connect with you on PowerMySport!</p>
    
    <div class="user-card">
      <div class="avatar">${!options.requesterPhotoUrl ? options.requesterName.charAt(0).toUpperCase() : ""}</div>
      <h3>${options.requesterName}</h3>
      <p>Wants to be your friend</p>
    </div>
    
    <p>Accept the request to book together, share activities, and stay connected!</p>
    
    <center>
      <a href="${dashboardUrl}" class="button">
        View Friend Request
      </a>
    </center>
    
    <p>Best regards,<br>
    <strong>The PowerMySport Team</strong></p>
  </div>
  
  <div class="footer">
    <p>This email was sent to ${options.recipientEmail}</p>
    <p>© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.recipientEmail,
    subject: `${options.requesterName} wants to connect with you on PowerMySport`,
    html,
  });
};

interface FriendRequestAcceptedEmailOptions {
  requesterName: string;
  requesterEmail: string;
  acceptedByName: string;
  acceptedByPhotoUrl?: string | undefined;
}

export const sendFriendRequestAcceptedEmail = async (
  options: FriendRequestAcceptedEmailOptions,
): Promise<void> => {
  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/friends`;

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
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
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
      background: #28a745;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
    }
    .user-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: center;
      border: 2px solid #28a745;
    }
    .avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      margin: 0 auto 15px;
      ${options.acceptedByPhotoUrl ? `background-image: url(${options.acceptedByPhotoUrl});` : "background-color: #28a745;"}
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 32px;
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
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Friend Request Accepted!</h1>
  </div>
  
  <div class="content">
    <h2>Great news, ${options.requesterName}!</h2>
    
    <p><strong>${options.acceptedByName}</strong> has accepted your friend request!</p>
    
    <div class="user-card">
      <div class="avatar">${!options.acceptedByPhotoUrl ? options.acceptedByName.charAt(0).toUpperCase() : ""}</div>
      <h3>${options.acceptedByName}</h3>
      <p>✓ Now friends</p>
    </div>
    
    <p>You can now invite ${options.acceptedByName} to group bookings and stay connected through PowerMySport!</p>
    
    <center>
      <a href="${dashboardUrl}" class="button">
        View Friends List
      </a>
    </center>
    
    <p>Best regards,<br>
    <strong>The PowerMySport Team</strong></p>
  </div>
  
  <div class="footer">
    <p>This email was sent to ${options.requesterEmail}</p>
    <p>© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.requesterEmail,
    subject: `${options.acceptedByName} accepted your friend request!`,
    html,
  });
};

interface BookingInvitationEmailOptions {
  inviteeName: string;
  inviteeEmail: string;
  inviterName: string;
  venueName: string;
  sport: string;
  date: string;
  startTime: string;
  endTime: string;
  estimatedAmount?: number;
}

export const sendBookingInvitationEmail = async (
  options: BookingInvitationEmailOptions,
): Promise<void> => {
  const invitationsUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/invitations`;

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
    .booking-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #ff6b35;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .detail-label {
      font-weight: bold;
      color: #666;
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
    <h1>🎾 You're Invited to a Booking!</h1>
  </div>
  
  <div class="content">
    <h2>Hi ${options.inviteeName},</h2>
    
    <p><strong>${options.inviterName}</strong> has invited you to join a group booking!</p>
    
    <div class="booking-card">
      <h3>📅 Booking Details</h3>
      <div class="detail-row">
        <span class="detail-label">Sport:</span>
        <span>${options.sport}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Venue:</span>
        <span>${options.venueName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span>${new Date(options.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span>${options.startTime} - ${options.endTime}</span>
      </div>
      ${
        options.estimatedAmount
          ? `
      <div class="detail-row">
        <span class="detail-label">Your Share:</span>
        <span><strong>₹${options.estimatedAmount.toFixed(2)}</strong></span>
      </div>
      `
          : ""
      }
    </div>
    
    <p>Accept the invitation to confirm your spot and join the fun!</p>
    
    <center>
      <a href="${invitationsUrl}" class="button">
        View Invitation
      </a>
    </center>
    
    <p>Best regards,<br>
    <strong>The PowerMySport Team</strong></p>
  </div>
  
  <div class="footer">
    <p>This email was sent to ${options.inviteeEmail}</p>
    <p>© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.inviteeEmail,
    subject: `${options.inviterName} invited you to play ${options.sport}!`,
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

interface CoachVerificationReminderEmailOptions {
  name: string;
  email: string;
}

export const sendCoachVerificationReminderEmail = async (
  options: CoachVerificationReminderEmailOptions,
): Promise<void> => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 24px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 24px; border-radius: 0 0 10px 10px; }
    .tip { background: #fff; border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Complete Your Coach Verification</h1>
  </div>
  <div class="content">
    <p>Hi ${options.name},</p>
    <p>This is a reminder to complete and submit your coach verification profile and documents for admin review.</p>
    <div class="tip">
      <strong>What to do next:</strong>
      <ul>
        <li>Complete your profile details</li>
        <li>Upload required verification documents</li>
        <li>Submit verification for review</li>
      </ul>
    </div>
    <p>Once submitted, our team will review and update your status.</p>
    <p style="margin-top: 20px;">Thanks,<br/>PowerMySport Team</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.email,
    subject: "Reminder: complete your coach verification",
    html,
  });
};

interface CredentialsEmailOptions {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}

interface AdminTemporaryCredentialsEmailOptions {
  name: string;
  email: string;
  role: string;
  temporaryPassword: string;
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

export const sendAdminTemporaryCredentialsEmail = async (
  options: AdminTemporaryCredentialsEmailOptions,
): Promise<void> => {
  // Format role name (e.g., "SYSTEM_ADMIN" -> "System Admin")
  const roleLabel = options.role
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
    Your ${roleLabel} account is ready. Use the temporary credentials to sign in and update your password.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;padding:28px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background-color:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:30px 28px 24px;text-align:center;">
              <div style="display:inline-block;background:#1f2937;border:1px solid #334155;color:#e2e8f0;padding:6px 12px;border-radius:9999px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">${roleLabel}</div>
              <h1 style="margin:14px 0 0;font-size:30px;line-height:34px;color:#ffffff;font-weight:800;">Admin Access Created</h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:22px;color:#cbd5e1;">Temporary credentials are ready for first login.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px;background-color:#ffffff;">
              <p style="margin:0 0 8px;font-size:18px;line-height:26px;color:#0f172a;font-weight:700;">Hi ${options.name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;">Your ${roleLabel.toLowerCase()} account has been created successfully. Use the details below to sign in.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbeafe;border-radius:12px;background-color:#f8fbff;margin:0 0 16px;">
                <tr>
                  <td style="padding:14px 16px;border-bottom:1px solid #dbeafe;">
                    <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:#64748b;">Email</p>
                    <p style="margin:6px 0 0;font-size:16px;line-height:24px;font-weight:700;color:#0f172a;word-break:break-word;">${options.email}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:#64748b;">Temporary Password</p>
                    <p style="margin:6px 0 0;font-size:16px;line-height:24px;font-weight:700;color:#0f172a;word-break:break-word;">${options.temporaryPassword}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
                <tr>
                  <td style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px;font-size:14px;line-height:22px;color:#9a3412;">
                    For security, you must change this temporary password immediately after first login.
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 8px;">
                <tr>
                  <td align="center" style="border-radius:10px;background:#0f172a;">
                    <a href="${options.loginUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Login to Admin Portal</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;line-height:18px;color:#64748b;text-align:center;word-break:break-all;">${options.loginUrl}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;line-height:20px;color:#64748b;">This email was sent to ${options.email}</p>
              <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
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
    subject: "Your PowerMySport Admin Account Credentials",
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

interface BookingReminderEmailOptions {
  email: string;
  name: string;
  venueName: string;
  sport: string;
  date: Date;
  startTime: string;
  endTime: string;
  interval: "24_HOURS" | "1_HOUR" | "15_MINUTES";
  bookingId?: string;
}

export const sendBookingReminderEmail = async (
  options: BookingReminderEmailOptions,
): Promise<void> => {
  const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const bookingsUrl = `${frontendBaseUrl}/dashboard/my-bookings`;
  const bookingDate = options.date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Determine reminder message based on interval
  let reminderTitle = "Booking Reminder";
  let reminderIcon = "⏰";
  let reminderMessage = "";
  let timeframeText = "";
  let gradientColors = "135deg, #ff6b35 0%, #f7931e 100%";

  switch (options.interval) {
    case "24_HOURS":
      reminderTitle = "Booking Tomorrow";
      reminderIcon = "📅";
      reminderMessage = "Your booking is coming up tomorrow!";
      timeframeText = "24 Hours";
      gradientColors = "135deg, #3b82f6 0%, #2563eb 100%";
      break;
    case "1_HOUR":
      reminderTitle = "Booking in 1 Hour";
      reminderIcon = "⏰";
      reminderMessage = "Your booking starts in 1 hour. Get ready!";
      timeframeText = "1 Hour";
      gradientColors = "135deg, #f59e0b 0%, #d97706 100%";
      break;
    case "15_MINUTES":
      reminderTitle = "Booking in 15 Minutes";
      reminderIcon = "🔔";
      reminderMessage = "Your booking starts in 15 minutes. Time to head out!";
      timeframeText = "15 Minutes";
      gradientColors = "135deg, #ef4444 0%, #dc2626 100%";
      break;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
    ${reminderMessage} Your ${options.sport} booking at ${options.venueName}.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;padding:28px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background-color:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(${gradientColors});padding:30px 28px 24px;text-align:center;">
              <div style="font-size:34px;line-height:34px;">${reminderIcon}</div>
              <h1 style="margin:12px 0 0;font-size:30px;line-height:34px;color:#ffffff;font-weight:800;">${reminderTitle}</h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:22px;color:rgba(255,255,255,0.9);">${reminderMessage}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 28px 22px;background-color:#ffffff;">
              <p style="margin:0 0 8px;font-size:18px;line-height:26px;color:#0f172a;font-weight:700;">Hi ${options.name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;">This is a friendly reminder about your upcoming booking.</p>

              <div style="display:inline-block;background-color:#fef3c7;border:1px solid #fde68a;color:#92400e;font-size:12px;font-weight:700;line-height:12px;padding:8px 12px;border-radius:999px;margin-bottom:16px;">STARTS IN ${timeframeText}</div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:0 16px;">
                <tr>
                  <td colspan="2" style="padding:14px 0 10px;font-size:15px;line-height:20px;color:#1e293b;font-weight:800;">Booking Details</td>
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
                  <td style="padding:12px 0 14px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Time</td>
                  <td style="padding:12px 0 14px;border-top:1px solid #e2e8f0;font-size:16px;color:#0f172a;font-weight:800;text-align:right;">${options.startTime} - ${options.endTime}</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background-color:#fef3f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;">
                <tr>
                  <td style="font-size:13px;line-height:20px;color:#991b1b;">
                    <strong>📍 Don't be late!</strong> Make sure to arrive a few minutes early to check in.
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                <tr>
                  <td align="center">
                    <a href="${bookingsUrl}" style="display:inline-block;padding:13px 28px;background-color:#ff6b35;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:800;letter-spacing:0.2px;">View Booking Details</a>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                <tr>
                  <td align="center" style="font-size:12px;line-height:18px;color:#94a3b8;">
                    Need to reschedule? Manage your booking from your dashboard.<br/>
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
    subject: `${reminderTitle} - ${options.sport} at ${options.venueName} | PowerMySport`,
    html,
  });
};
