import { log as __rootLog } from "../../utils/logger";
import type { BookingWhatsAppPayload } from "./WhatsAppNotificationService";
import { sendWhatsAppTemplate, whatsappSendingConfigured } from "./whatsappService";

const log = __rootLog.child("whatsappTemplates");

/**
 * The booking messages parents get from us first, as approved WhatsApp templates.
 *
 * Each template's name, language and number of body variables are fixed by what
 * Meta approved, so the builders below are the one place that knows them. If a
 * template is reworded in WhatsApp Manager, only the variable order matters here.
 *
 *   booking_confirmed   {{1}} name, {{2}} sport, {{3}} date and time, {{4}} where
 *   booking_cancelled   {{1}} name, {{2}} sport, {{3}} date and time, {{4}} refund note
 *   booking_rescheduled {{1}} name, {{2}} sport, {{3}} old time, {{4}} new time
 *   booking_reminder    {{1}} name, {{2}} sport, {{3}} date and time
 */

export type BookingTemplateEvent = BookingWhatsAppPayload["event"] | "BOOKING_REMINDER";

export interface BookingTemplate {
  name: string;
  params: string[];
}

/** Sending templates is opt-in: they are paid messages, and only approved ones are accepted. */
export function templatesEnabled(): boolean {
  return process.env.WHATSAPP_TEMPLATES === "on";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-25T12:30:00.000Z" as "25 Oct 2026, 6:00 PM" in Indian time, or "" when it is not a date. */
export function formatIstDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const month = MONTHS[Number(get("month")) - 1] ?? "";
  return `${Number(get("day"))} ${month} ${get("year")}, ${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`;
}

/**
 * Meta rejects a variable that holds a newline, a tab or four spaces in a row,
 * and an empty one. Names and venues come from users, so every value is cleaned.
 */
export function cleanParam(value: unknown): string {
  const text = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, 200);
  return text || "-";
}

/** The template and its variables for a booking event, or null when it cannot be filled in. */
export function buildBookingTemplate(
  event: BookingTemplateEvent,
  payload: Omit<BookingWhatsAppPayload, "event">
): BookingTemplate | null {
  const when = formatIstDateTime(payload.dateTime);
  if (!when) return null;
  const head = [cleanParam(payload.playerName), cleanParam(payload.sport)];

  switch (event) {
    case "BOOKING_CONFIRMED": {
      const where = [
        payload.venue ? `Venue: ${cleanParam(payload.venue)}.` : "",
        payload.coachName ? `Coach: ${cleanParam(payload.coachName)}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return {
        name: "booking_confirmed",
        params: [...head, when, where || "Open your dashboard for the details."],
      };
    }
    case "BOOKING_CANCELLED": {
      const note =
        payload.refundAmount && payload.refundAmount > 0
          ? `A refund of Rs ${Math.round(payload.refundAmount)} is on its way.`
          : "Check your dashboard for the payment details.";
      return { name: "booking_cancelled", params: [...head, when, note] };
    }
    case "BOOKING_RESCHEDULED": {
      const next = payload.newDateTime ? formatIstDateTime(payload.newDateTime) : "";
      if (!next) return null;
      return { name: "booking_rescheduled", params: [...head, when, next] };
    }
    case "BOOKING_REMINDER":
      return { name: "booking_reminder", params: [...head, when] };
    default:
      return null;
  }
}

/** Sends the booking template for an event straight from this server. Never throws. */
export async function sendBookingTemplate(
  event: BookingTemplateEvent,
  payload: Omit<BookingWhatsAppPayload, "event">
): Promise<boolean> {
  try {
    if (!whatsappSendingConfigured()) return false;
    const template = buildBookingTemplate(event, payload);
    if (!template) {
      log.warn(`No template sent for ${event}: the booking details are incomplete`);
      return false;
    }
    return await sendWhatsAppTemplate(payload.playerPhone, template.name, template.params);
  } catch (err) {
    log.error(`Template send failed for ${event}`, err);
    return false;
  }
}
