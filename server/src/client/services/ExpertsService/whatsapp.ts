import { User } from "../../models/User";
import { Expert } from "../../models/ExpertProfile";
import type { ExpertSessionDocument } from "../../models/ExpertBooking";
import { hasWhatsAppConsent } from "../../../shared/services/whatsappConsent";
import {
  normalizeIndianPhone,
  notifyBookingWhatsApp,
} from "../../../shared/services/WhatsAppNotificationService";
import { log } from "./shared";

/**
 * Tells the parent on WhatsApp what the expert did with their session: accepted
 * the time, moved it, or called it off. It is the same message, the same consent
 * and the same two routes (n8n, or Meta templates when WHATSAPP_TEMPLATES is on)
 * as venue and coach bookings, so the one switch in Settings covers both.
 *
 * Only what the expert does is sent. A booking that has just been paid and is
 * waiting for the expert's reply says nothing, because it is not confirmed yet,
 * and a parent who cancels their own session is not messaged about their own click.
 *
 * Best-effort like every other WhatsApp message: it never throws, and it does
 * nothing for a parent with no phone number or who never agreed to WhatsApp.
 */
export type ExpertSessionWhatsAppEvent =
  | { type: "CONFIRMED" }
  | {
      type: "CANCELLED";
      /** True when the parent is owed their money back, so the message can say so. */
      refundOwed: boolean;
    }
  | {
      type: "RESCHEDULED";
      /** The time the session was moved from. */
      previousScheduledAt: Date | string | null | undefined;
    };

export const notifyExpertSessionWhatsApp = async (
  session: ExpertSessionDocument,
  event: ExpertSessionWhatsAppEvent
): Promise<void> => {
  try {
    if (!session.scheduledAt) return;

    const client = await User.findById(session.userId).select("phone name whatsappConsent").lean();
    if (!client?.phone || !hasWhatsAppConsent(client)) return;

    const expert = await Expert.findById(session.expertId)
      .populate("userId", "name")
      .select("userId sports")
      .lean();
    const expertName = (expert?.userId as { name?: string } | undefined)?.name;
    const sport = expert?.sports?.[0] ?? "Expert session";

    const common = {
      playerPhone: normalizeIndianPhone(client.phone),
      playerName: client.name || "there",
      coachName: expertName,
      sport,
    };

    if (event.type === "CONFIRMED") {
      notifyBookingWhatsApp({
        ...common,
        event: "BOOKING_CONFIRMED",
        dateTime: new Date(session.scheduledAt).toISOString(),
        where: [
          expertName ? `Expert: ${expertName}.` : "",
          session.mode === "IN_PERSON" ? "In person." : "Online.",
        ]
          .filter(Boolean)
          .join(" "),
      });
      return;
    }

    if (event.type === "CANCELLED") {
      notifyBookingWhatsApp({
        ...common,
        event: "BOOKING_CANCELLED",
        dateTime: new Date(session.scheduledAt).toISOString(),
        ...(event.refundOwed && session.amount > 0 ? { refundAmount: session.amount } : {}),
      });
      return;
    }

    if (!event.previousScheduledAt) return;
    notifyBookingWhatsApp({
      ...common,
      event: "BOOKING_RESCHEDULED",
      dateTime: new Date(event.previousScheduledAt).toISOString(),
      newDateTime: new Date(session.scheduledAt).toISOString(),
    });
  } catch (err) {
    log.warn(
      `notifyExpertSessionWhatsApp failed for session ${session._id.toString()}: ${(err as Error).message}`
    );
  }
};
