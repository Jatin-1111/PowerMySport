import { sendEmail, emailFrontendUrl, renderEmailShell, detailTable } from "./shared";

type BookingLifecycleState = "AWAITING_PROVIDER" | "CONFIRMED" | "CANCELLED";

type BookingLifecycleRecipientRole = "Player" | "PROVIDER";

interface BookingLifecycleEmailOptions {
  email: string;
  name: string;
  venueName: string;
  sport: string;
  date: Date;
  startTime: string;
  endTime: string;
  totalAmount: number;
  state: BookingLifecycleState;
  recipientRole: BookingLifecycleRecipientRole;
  checkInCode?: string;
  refundAmount?: number;
  refundPercentage?: number;
  cancellationReason?: string;
}

export const sendBookingLifecycleEmail = async (
  options: BookingLifecycleEmailOptions
): Promise<void> => {
  const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const bookingsUrl = `${frontendBaseUrl}/dashboard/my-bookings`;
  const bookingDate = options.date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const amountValue = options.totalAmount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const stateConfig =
    options.state === "CONFIRMED"
      ? {
          title: "Booking Confirmed",
          emoji: "✅",
          headerGradient: "linear-gradient(135deg,#0f9d58 0%,#22c55e 100%)",
          badgeBg: "#ecfdf3",
          badgeBorder: "#bbf7d0",
          badgeText: "#15803d",
          badge: "CONFIRMED",
        }
      : options.state === "CANCELLED"
        ? {
            title: "Booking Cancelled",
            emoji: "🛑",
            headerGradient: "linear-gradient(135deg,#dc2626 0%,#ef4444 100%)",
            badgeBg: "#fef2f2",
            badgeBorder: "#fecaca",
            badgeText: "#b91c1c",
            badge: "CANCELLED",
          }
        : {
            title: "Booking Received",
            emoji: "⏳",
            headerGradient: "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)",
            badgeBg: "#fffbeb",
            badgeBorder: "#fde68a",
            badgeText: "#92400e",
            badge: "AWAITING CONFIRMATION",
          };

  const recipientLeadText =
    options.state === "CONFIRMED"
      ? options.recipientRole === "Player"
        ? "Your booking is confirmed and ready in your dashboard."
        : "You approved a booking and the player has been notified."
      : options.state === "CANCELLED"
        ? options.recipientRole === "Player"
          ? "Your booking was cancelled."
          : "A booking under your control was cancelled."
        : options.recipientRole === "Player"
          ? "We have received your booking and it's waiting for provider approval."
          : "A new booking is waiting for your approval.";

  const refundSection =
    options.state === "CANCELLED"
      ? `
                <tr>
                  <td style="padding:10px 0 0;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Refund</td>
                  <td style="padding:10px 0 0;border-top:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:700;text-align:right;">
                    ${options.refundPercentage ? `${options.refundPercentage}% - ` : ""}₹${(options.refundAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                ${
                  options.cancellationReason
                    ? `
                <tr>
                  <td colspan="2" style="padding:12px 0 0;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Reason</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:4px 0 0;font-size:13px;color:#0f172a;">${options.cancellationReason}</td>
                </tr>`
                    : ""
                }
      `
      : "";

  const checkInRow =
    options.checkInCode && options.state === "CONFIRMED" && options.recipientRole === "Player"
      ? `
                <tr>
                  <td style="padding:10px 0 14px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Check-in Code</td>
                  <td style="padding:10px 0 14px;border-top:1px solid #e2e8f0;font-size:16px;color:#0f172a;font-weight:800;text-align:right;font-family:monospace;letter-spacing:2px;">${options.checkInCode}</td>
                </tr>
      `
      : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
    ${recipientLeadText}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;padding:28px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background-color:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background:${stateConfig.headerGradient};padding:30px 28px 24px;text-align:center;">
              <div style="font-size:34px;line-height:34px;">${stateConfig.emoji}</div>
              <h1 style="margin:12px 0 0;font-size:30px;line-height:34px;color:#ffffff;font-weight:800;">${stateConfig.title}</h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:22px;color:rgba(255,255,255,0.9);">${recipientLeadText}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 28px 22px;background-color:#ffffff;">
              <p style="margin:0 0 8px;font-size:18px;line-height:26px;color:#0f172a;font-weight:700;">Hi ${options.name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;">${options.state === "CONFIRMED" ? "Here are your confirmed booking details." : options.state === "CANCELLED" ? "We have updated your booking status." : "Here are the booking details for your review."}</p>

              <div style="display:inline-block;background-color:${stateConfig.badgeBg};border:1px solid ${stateConfig.badgeBorder};color:${stateConfig.badgeText};font-size:12px;font-weight:700;line-height:12px;padding:8px 12px;border-radius:999px;margin-bottom:16px;">${stateConfig.badge}</div>

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
                  <td style="padding:12px 0 14px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Amount</td>
                  <td style="padding:12px 0 14px;border-top:1px solid #e2e8f0;font-size:16px;color:#15803d;font-weight:800;text-align:right;">₹${amountValue}</td>
                </tr>
                ${checkInRow}
                ${refundSection}
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

  const subject =
    options.state === "CONFIRMED"
      ? options.recipientRole === "Player"
        ? "Your Booking is Confirmed ✨ | PowerMySport"
        : `Booking Confirmed - ${options.sport} at ${options.venueName} | PowerMySport`
      : options.state === "CANCELLED"
        ? `Booking Cancelled - ${options.sport} at ${options.venueName} | PowerMySport`
        : options.recipientRole === "Player"
          ? `Booking Received - Awaiting Confirmation | PowerMySport`
          : `New Booking Request - Awaiting Confirmation | PowerMySport`;

  await sendEmail({
    to: options.email,
    subject,
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
  options: BookingInvitationEmailOptions
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
        <span>${new Date(options.date).toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
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
  options: BookingConfirmationEmailOptions
): Promise<void> => {
  const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const bookingsUrl = `${frontendBaseUrl}/dashboard/my-bookings`;
  const bookingDate = options.date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
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
  options: BookingReminderEmailOptions
): Promise<void> => {
  const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const bookingsUrl = `${frontendBaseUrl}/dashboard/my-bookings`;
  const bookingDate = options.date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
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

interface WaitlistSlotAvailableOptions {
  name?: string | undefined;
  email: string;
  venueName: string;
  sport: string;
  date: Date | string;
  startTime: string;
  endTime: string;
}

export const sendWaitlistSlotAvailableEmail = async (
  options: WaitlistSlotAvailableOptions
): Promise<void> => {
  const dateStr = new Date(options.date).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const html = renderEmailShell({
    heading: "A slot just opened up! ⚡",
    intro: `Hi ${options.name || "there"}, good news — a slot you were waiting for is now available. These go fast, so book soon.`,
    bodyHtml: detailTable([
      ["Venue", options.venueName],
      ["Sport", options.sport],
      ["Date", dateStr],
      ["Time", `${options.startTime} – ${options.endTime}`],
    ]),
    ctaLabel: "Book now",
    ctaUrl: `${emailFrontendUrl()}/booking`,
  });
  await sendEmail({
    to: options.email,
    subject: `A ${options.sport} slot opened up at ${options.venueName} — book now`,
    html,
  });
};
