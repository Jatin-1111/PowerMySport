import { User } from "../../client/models/User";
import { normalizeIndianPhone } from "./WhatsAppNotificationService";

/**
 * Whether people agreed to get WhatsApp messages from us. Meta requires an opt-in
 * before a business messages someone first, and the date and place it was given
 * are what we can show if asked.
 */

export type ConsentSource = "signup" | "settings" | "booking";

export interface WhatsAppConsentState {
  granted: boolean;
  at: Date | null;
}

export async function getWhatsAppConsent(userId: string): Promise<WhatsAppConsentState> {
  const user = await User.findById(userId).select("whatsappConsent").lean();
  return {
    granted: user?.whatsappConsent?.granted === true,
    at: user?.whatsappConsent?.at ?? null,
  };
}

/** Records a yes or a no. A yes keeps the first date it was given on if already granted. */
export async function setWhatsAppConsent(
  userId: string,
  granted: boolean,
  source: ConsentSource
): Promise<WhatsAppConsentState> {
  const now = new Date();
  if (granted) {
    const existing = await User.findById(userId).select("whatsappConsent").lean();
    if (existing?.whatsappConsent?.granted === true) {
      return { granted: true, at: existing.whatsappConsent.at ?? null };
    }
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          "whatsappConsent.granted": true,
          "whatsappConsent.at": now,
          "whatsappConsent.source": source,
        },
        $unset: { "whatsappConsent.withdrawnAt": "" },
      }
    );
    return { granted: true, at: now };
  }
  await User.updateOne(
    { _id: userId },
    { $set: { "whatsappConsent.granted": false, "whatsappConsent.withdrawnAt": now } }
  );
  return { granted: false, at: null };
}

/** True only when the person has said yes. A missing record is a no. */
export function hasWhatsAppConsent(
  user: { whatsappConsent?: { granted?: boolean } } | null
): boolean {
  return user?.whatsappConsent?.granted === true;
}

/**
 * Replying STOP on WhatsApp takes the number off our list too. Accounts keep their
 * phone in whatever form it was typed ("9876543210", "+91 98765 43210"), so
 * candidates are found by the last four digits and then compared on all ten.
 */
export async function withdrawConsentForPhone(from: string): Promise<number> {
  const tenDigits = normalizeIndianPhone(from).slice(-10);
  if (!/^\d{10}$/.test(tenDigits)) return 0;

  const candidates = await User.find({
    "whatsappConsent.granted": true,
    phone: { $regex: `${tenDigits.slice(-4)}\\s*$` },
  })
    .select("_id phone")
    .lean();
  const ids = candidates
    .filter((u) => (u.phone ?? "").replace(/\D/g, "").slice(-10) === tenDigits)
    .map((u) => u._id);
  if (ids.length === 0) return 0;

  const result = await User.updateMany(
    { _id: { $in: ids } },
    { $set: { "whatsappConsent.granted": false, "whatsappConsent.withdrawnAt": new Date() } }
  );
  return result.modifiedCount;
}
