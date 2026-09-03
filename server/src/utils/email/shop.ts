import { sendEmail, emailFrontendUrl, formatInr, renderEmailShell, detailTable } from "./shared";

export const sendShopLaunchEmail = async (email: string): Promise<void> => {
  const shopUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/shop`;

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
      background-color: #f8fafc;
    }
    .header {
      background: linear-gradient(135deg, #E97316 0%, #F59E0B 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
      border-radius: 12px 12px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .content {
      background: #ffffff;
      padding: 40px 30px;
      border-radius: 0 0 12px 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      text-align: center;
    }
    .button {
      display: inline-block;
      padding: 16px 36px;
      background: #E97316;
      color: #ffffff;
      text-decoration: none;
      border-radius: 9999px;
      margin: 30px 0;
      font-weight: 800;
      font-size: 16px;
      box-shadow: 0 4px 14px 0 rgba(233, 115, 22, 0.39);
      transition: all 0.2s ease;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      color: #64748b;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🛍️ The Wait is Over!</h1>
  </div>

  <div class="content">
    <h2 style="color: #0f172a; margin-top: 0;">PowerMySport Shop is officially LIVE!</h2>

    <p style="color: #475569; font-size: 16px;">
      You're receiving this because you joined our early-access waitlist.
      Head over to the shop right now to get your hands on premium sports gear and exclusive coaching bundles before they sell out!
    </p>

    <a href="${shopUrl}" class="button" style="color: #ffffff;">
      Shop Now 🚀
    </a>

    <p style="color: #475569; font-size: 14px;">
      Get out there and Power Your Sport!
    </p>
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
    subject: "The PowerMySport Shop is LIVE! 🎉",
    html,
  });
};

interface OrderConfirmationEmailOptions {
  email: string;
  name: string;
  orderNumber: string;
  totalAmount: number;
  items: Array<{
    productName: string;
    variantLabel: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  paymentMethod: string;
}

export const sendOrderConfirmationEmail = async (
  options: OrderConfirmationEmailOptions
): Promise<void> => {
  const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const itemsHtml = options.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: bold; color: #0f172a;">${item.productName}</div>
        <div style="font-size: 12px; color: #64748b;">${item.variantLabel}</div>
      </td>
      <td style="padding: 12px 0; text-align: center; border-bottom: 1px solid #e2e8f0; color: #475569;">
        x${item.quantity}
      </td>
      <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">
        ₹${(item.lineTotal / 100).toFixed(2)}
      </td>
    </tr>
  `
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;padding:28px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background-color:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); padding:30px 28px 24px;text-align:center;">
              <div style="font-size:34px;line-height:34px;">🛍️</div>
              <h1 style="margin:12px 0 0;font-size:30px;line-height:34px;color:#ffffff;font-weight:800;">Order Confirmed!</h1>
              <p style="margin:10px 0 0;font-size:15px;line-height:22px;color:rgba(255,255,255,0.9);">Thank you for your purchase. Your order has been placed successfully.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 28px 22px;background-color:#ffffff;">
              <p style="margin:0 0 8px;font-size:18px;line-height:26px;color:#0f172a;font-weight:700;">Hi ${options.name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#475569;">Your payment has been captured and order <strong>#${options.orderNumber}</strong> is now being processed.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:20px;">
                <tr>
                  <td style="font-size:15px;font-weight:800;color:#1e293b;" colspan="3">Items Ordered</td>
                </tr>
                ${itemsHtml}
                <tr>
                  <td colspan="2" style="padding: 16px 0 0; font-size: 15px; font-weight: bold; color: #0f172a;">Total Amount Paid</td>
                  <td style="padding: 16px 0 0; text-align: right; font-size: 18px; font-weight: 800; color: #ff6b35;">
                    ₹${(options.totalAmount / 100).toFixed(2)}
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:20px;">
                <tr>
                  <td style="font-size:15px;font-weight:800;color:#1e293b;">Shipping Address</td>
                </tr>
                <tr>
                  <td style="font-size:14px;line-height:20px;color:#475569;padding-top:8px;">
                    <strong>${options.shippingAddress.fullName}</strong><br/>
                    ${options.shippingAddress.addressLine1}<br/>
                    ${options.shippingAddress.addressLine2 ? `${options.shippingAddress.addressLine2}<br/>` : ""}
                    ${options.shippingAddress.city}, ${options.shippingAddress.state} - ${options.shippingAddress.postalCode}<br/>
                    ${options.shippingAddress.country}
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
                <tr>
                  <td align="center">
                    <a href="${frontendBaseUrl}/shop/account?tab=orders" style="display:inline-block;padding:13px 28px;background-color:#ff6b35;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:800;letter-spacing:0.2px;">View Order Status</a>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-top:1px solid #e2e8f0;padding-top:20px;">
                <tr>
                  <td align="center" style="font-size:12px;line-height:18px;color:#94a3b8;">
                    If you have any questions, please contact support from your dashboard.<br/>
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
    subject: `Order Confirmed: #${options.orderNumber} 🛍️ | PowerMySport`,
    html,
  });
};

interface SupportTicketReceivedOptions {
  name?: string | undefined;
  email: string;
  ticketId: string;
  subject: string;
  category?: string | undefined;
}

export const sendSupportTicketReceivedEmail = async (
  options: SupportTicketReceivedOptions
): Promise<void> => {
  const html = renderEmailShell({
    heading: "We've received your request",
    intro: `Hi ${options.name || "there"}, thanks for reaching out. Our support team has received your ticket and will get back to you soon.`,
    bodyHtml: detailTable([
      ["Ticket", `#${options.ticketId.slice(-8)}`],
      ["Subject", options.subject],
      ...(options.category ? ([["Category", options.category]] as [string, string][]) : []),
    ]),
    ctaLabel: "View my tickets",
    ctaUrl: `${emailFrontendUrl()}/dashboard`,
  });
  await sendEmail({
    to: options.email,
    subject: `We've received your support request (#${options.ticketId.slice(-8)})`,
    html,
  });
};

interface SupportTicketStatusOptions {
  name?: string | undefined;
  email: string;
  ticketId: string;
  subject: string;
  status: string;
  note?: string | undefined;
}

export const sendSupportTicketStatusEmail = async (
  options: SupportTicketStatusOptions
): Promise<void> => {
  const resolved = ["RESOLVED", "CLOSED"].includes(options.status.toUpperCase());
  const html = renderEmailShell({
    heading: resolved ? "Your support ticket was updated" : "Update on your support ticket",
    intro: `Hi ${options.name || "there"}, there's an update on your support ticket.`,
    bodyHtml:
      detailTable([
        ["Ticket", `#${options.ticketId.slice(-8)}`],
        ["Subject", options.subject],
        ["New status", options.status.replace(/_/g, " ")],
      ]) +
      (options.note
        ? `<p style="margin-top:8px;"><strong>Note from our team:</strong><br/>${options.note}</p>`
        : ""),
    ctaLabel: "View ticket",
    ctaUrl: `${emailFrontendUrl()}/dashboard`,
    accent: resolved ? "#16a34a" : "#ff6b35",
  });
  await sendEmail({
    to: options.email,
    subject: `Support ticket #${options.ticketId.slice(-8)} — ${options.status.replace(/_/g, " ")}`,
    html,
  });
};

interface PayoutProcessedOptions {
  name?: string | undefined;
  email: string;
  amount: number;
  bookingCount: number;
  role: "Coach" | "VenueLister";
}

export const sendPayoutProcessedEmail = async (options: PayoutProcessedOptions): Promise<void> => {
  const html = renderEmailShell({
    heading: "You've been paid 🎉",
    intro: `Hi ${options.name || "there"}, a payout has been processed to your account.`,
    bodyHtml: detailTable([
      ["Amount", formatInr(options.amount)],
      ["Bookings settled", String(options.bookingCount)],
      ["Account type", options.role === "Coach" ? "Coach" : "Venue owner"],
    ]),
    ctaLabel: "View earnings",
    ctaUrl: `${emailFrontendUrl()}/${options.role === "Coach" ? "coach" : "venue-lister"}/earnings`,
    accent: "#16a34a",
  });
  await sendEmail({
    to: options.email,
    subject: `Payout processed: ${formatInr(options.amount)} — PowerMySport`,
    html,
  });
};

interface DisputeStatusOptions {
  name?: string | undefined;
  email: string;
  disputeType: string;
  status: "OPEN" | "RESOLVED" | "CLOSED";
  bookingId: string;
  resolution?: string | undefined;
  refundAmount?: number | undefined;
}

export const sendDisputeStatusEmail = async (options: DisputeStatusOptions): Promise<void> => {
  const isResolved = options.status !== "OPEN";
  const html = renderEmailShell({
    heading: isResolved ? "Your dispute has been resolved" : "We've received your dispute",
    intro: isResolved
      ? `Hi ${options.name || "there"}, your dispute has been reviewed and resolved.`
      : `Hi ${options.name || "there"}, your dispute has been logged and our team will review it.`,
    bodyHtml: detailTable([
      ["Booking", `#${options.bookingId.slice(-8)}`],
      ["Type", options.disputeType.replace(/_/g, " ")],
      ["Status", options.status],
      ...(options.resolution
        ? ([["Resolution", options.resolution.replace(/_/g, " ")]] as [string, string][])
        : []),
      ...(options.refundAmount
        ? ([["Refund", formatInr(options.refundAmount)]] as [string, string][])
        : []),
    ]),
    ctaLabel: "View booking",
    ctaUrl: `${emailFrontendUrl()}/dashboard/my-bookings`,
    accent: isResolved ? "#16a34a" : "#ff6b35",
  });
  await sendEmail({
    to: options.email,
    subject: isResolved
      ? `Your dispute for booking #${options.bookingId.slice(-8)} was resolved`
      : `We've received your dispute for booking #${options.bookingId.slice(-8)}`,
    html,
  });
};
