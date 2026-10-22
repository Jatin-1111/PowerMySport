import { User } from "../../client/models/User";
import { normalizeIndianPhone } from "./WhatsAppNotificationService";

/**
 * Which account a WhatsApp number belongs to, so the assistant can answer from that
 * parent's own children and rankings the way the website does.
 *
 * A phone on an account is not verified, so a number is trusted only when exactly one
 * live account holds it. Two accounts on one number (a shared family phone, or someone
 * who typed another person's number) means nobody is identified and the assistant
 * answers from public data alone. Never guess between them.
 *
 * Accounts keep the phone as it was typed ("9876543210", "+91 98765 43210"), so
 * candidates are found by the last four digits and then compared on all ten.
 */
export async function findUserIdByPhone(from: string): Promise<string | undefined> {
  const tenDigits = normalizeIndianPhone(from).slice(-10);
  if (!/^\d{10}$/.test(tenDigits)) return undefined;

  const candidates = await User.find({
    phone: { $regex: `${tenDigits.slice(-4)}\\s*$` },
    isActive: { $ne: false },
    deletionRequestedAt: null,
  })
    .select("_id phone")
    .limit(5)
    .lean();

  const matches = candidates.filter(
    (u) => (u.phone ?? "").replace(/\D/g, "").slice(-10) === tenDigits
  );
  return matches.length === 1 ? String(matches[0]!._id) : undefined;
}
