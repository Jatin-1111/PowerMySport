import { ShopWaitlist } from "../models/ShopWaitlist";
import { sendShopLaunchEmail } from "../../utils/email";

/**
 * Process pending waitlist signups and send them notification emails.
 * Updates their status to NOTIFIED after sending the email.
 */
export const processWaitlistNotifications = async (): Promise<void> => {
  try {
    const pendingEntries = await ShopWaitlist.find({ status: "PENDING" }).limit(
      50,
    );

    if (pendingEntries.length === 0) {
      return;
    }

    let notifiedCount = 0;

    for (const entry of pendingEntries) {
      try {
        await sendShopLaunchEmail(entry.email);
        console.log(`[Shop Waitlist] Sent launch email to: ${entry.email}`);

        // Update status only if email sent successfully
        entry.status = "NOTIFIED";
        await entry.save();
        notifiedCount++;
      } catch (emailError) {
        console.error(
          `❌ Failed to send launch email to ${entry.email}:`,
          emailError,
        );
      }
    }

    if (notifiedCount > 0) {
      console.log(`✅ Processed ${notifiedCount} waitlist notifications.`);
    }
  } catch (error) {
    console.error("❌ Error processing waitlist notifications:", error);
  }
};
