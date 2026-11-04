"use client";

import { Badge } from "@/modules/shared/ui/Badge";
import {
  DELIVERY_LABELS,
  type CoachOffering,
  type CoachOfferingSlot,
  type CoachSessionOccurrence,
  type SessionDelivery,
} from "@/types/coachPrograms";
import { Globe, Home, MapPin, Users } from "lucide-react";

/**
 * Shared presentation for coaching programmes.
 *
 * Everything here is deliberately capacity-agnostic: a 1:1 programme and a
 * batch render through the same components with a different number, because
 * they are the same thing in the model.
 */

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DeliveryBadge = ({
  kind,
  platform,
}: {
  kind: CoachOffering["deliveryKind"];
  platform?: string;
}) => {
  const Icon = kind === "ONLINE" ? Globe : kind === "STUDENT_LOCATION" ? Home : MapPin;

  return (
    <Badge variant="secondary" className="inline-flex items-center gap-1">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {kind === "ONLINE" && platform ? `Online · ${platform}` : DELIVERY_LABELS[kind]}
    </Badge>
  );
};

/** "Tue & Thu, 6:00 PM · 60 min" — the pattern, not a list of dates. */
export const formatSchedule = (schedule: CoachOfferingSlot[], timezone?: string): string => {
  if (!schedule.length) return "No sessions scheduled";

  const days = schedule.map((slot) => DAY_LABELS[slot.dayOfWeek] ?? "?").join(" & ");

  const first = schedule[0];
  if (!first) return "No sessions scheduled";

  const time = to12Hour(first.startTime);
  const sameTime = schedule.every((slot) => slot.startTime === first.startTime);
  const zone = timezone === "Asia/Kolkata" ? "IST" : timezone;

  return sameTime
    ? `${days}, ${time}${zone ? ` ${zone}` : ""} · ${first.durationMinutes} min`
    : `${days} · ${schedule.length} sessions a week`;
};

const to12Hour = (hhmm: string): string => {
  const [h = "0", m = "00"] = hhmm.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${suffix}`;
};

/**
 * Seats, phrased for the shape of the programme. A private programme saying
 * "0 of 1 seats left" reads like a bug; "Taken" is what a parent means.
 */
export const SeatsLabel = ({ offering }: { offering: CoachOffering }) => {
  const seatsLeft =
    offering.seatsLeft ?? Math.max(0, offering.capacity - (offering.enrolledCount ?? 0));

  if (offering.capacity === 1) {
    return (
      <span className="text-muted-foreground text-sm">
        {seatsLeft > 0 ? "One-to-one · available" : "One-to-one · taken"}
      </span>
    );
  }

  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
      <Users className="h-3.5 w-3.5" aria-hidden="true" />
      {seatsLeft > 0
        ? `${seatsLeft} of ${offering.capacity} seats left`
        : `Full (${offering.capacity} students)`}
    </span>
  );
};

/**
 * A session's date and time, rendered in the VIEWER's timezone.
 *
 * `scheduledAt` is an instant, so this is correct for a student watching from
 * another country — which is the point of storing instants rather than the
 * coach's wall-clock time.
 */
export const formatSessionTime = (scheduledAt: string): string =>
  new Date(scheduledAt).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

/** How a student actually gets to this session. */
export const ConnectionDetail = ({
  delivery,
  status,
}: {
  delivery?: SessionDelivery;
  status?: CoachSessionOccurrence["status"];
}) => {
  if (!delivery) return null;
  if (status && status !== "SCHEDULED") return null;

  if (delivery.kind === "ONLINE") {
    return delivery.meetingLink ? (
      <a
        href={delivery.meetingLink}
        target="_blank"
        rel="noopener noreferrer"
        className="text-power-orange text-sm font-medium underline underline-offset-2"
      >
        Join class
      </a>
    ) : (
      <span className="text-muted-foreground text-sm">
        Your coach hasn&apos;t shared the link yet
      </span>
    );
  }

  return delivery.addressSnapshot ? (
    <span className="text-muted-foreground inline-flex items-start gap-1 text-sm">
      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {delivery.addressSnapshot}
    </span>
  ) : null;
};

export const StatusBadge = ({ status }: { status: CoachSessionOccurrence["status"] }) => {
  if (status === "COMPLETED") return <Badge variant="secondary">Done</Badge>;
  if (status.startsWith("CANCELLED")) {
    return <Badge variant="destructive">Cancelled</Badge>;
  }
  return <Badge variant="outline">Scheduled</Badge>;
};

/** Paise are the storage unit everywhere in this codebase; rupees are display. */
export const formatPaise = (paise: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
