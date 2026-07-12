import prisma from "../../lib/prisma";
import { sendShopLaunchEmail } from "../../utils/email";

/**
 * Process pending waitlist signups and send them notification emails.
 * Updates their status to NOTIFIED after sending the email.
 *
 * TODO(prisma): the Prisma `ShopWaitlist` model does NOT carry the
 * `status` ("PENDING" | "NOTIFIED") field the Mongoose model had, so we can
 * neither filter to un-notified rows nor mark rows NOTIFIED after sending.
 * As ported, this fetches the first 50 rows and emails them, which will
 * re-notify the same signups on every run. Add a `status` column (default
 * PENDING, indexed) to the ShopWaitlist model and restore the filter/update
 * below to regain the once-only-notify guarantee.
 */
export const processWaitlistNotifications = async (): Promise<void> => {
  try {
    const pendingEntries = await prisma.shopWaitlist.findMany({
      // TODO(prisma): re-add `where: { status: "PENDING" }` once the model has it.
      take: 50,
    });

    if (pendingEntries.length === 0) {
      return;
    }

    let notifiedCount = 0;

    for (const entry of pendingEntries) {
      try {
        await sendShopLaunchEmail(entry.email);
        console.log(`[Shop Waitlist] Sent launch email to: ${entry.email}`);

        // Update status only if email sent successfully
        // TODO(prisma): mark NOTIFIED once the ShopWaitlist model has a status
        // field, e.g.:
        //   await prisma.shopWaitlist.update({
        //     where: { id: entry.id },
        //     data: { status: "NOTIFIED" },
        //   });
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
