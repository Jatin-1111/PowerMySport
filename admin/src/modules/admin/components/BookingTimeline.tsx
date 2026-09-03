"use client";

import { useEffect, useState } from "react";
import { adminApi, type BookingEvent } from "@/modules/admin/services/admin";

/**
 * Renders a booking's append-only lifecycle log.
 *
 * This is the read side of the BookingEvent audit trail — the answer to "who
 * changed this booking, when, and through which surface", which the booking
 * document itself cannot give because it is mutated in place.
 */

const ACTOR_LABEL: Record<BookingEvent["actorType"], string> = {
  USER: "Customer",
  PROVIDER: "Provider",
  ADMIN: "Admin",
  SYSTEM: "System",
  GATEWAY: "Payment gateway",
};

const CHANNEL_LABEL: Record<BookingEvent["channel"], string> = {
  CLIENT_WEB: "customer app",
  PROVIDER_WEB: "provider dashboard",
  ADMIN_PANEL: "admin panel",
  CRON: "scheduled job",
  WEBHOOK: "webhook",
  SYSTEM: "system",
};

/** Colour by what the event means operationally, not by actor. */
const toneForType = (type: string): string => {
  if (type.startsWith("PAYMENT_") && type.endsWith("_FAILED")) return "bg-red-100 text-red-700";
  if (type.startsWith("REFUND_") && type.endsWith("_FAILED")) return "bg-red-100 text-red-700";
  if (type === "CANCELLED" || type === "PROVIDER_REJECTED" || type === "NO_SHOW")
    return "bg-red-100 text-red-700";
  if (type === "EXPIRED") return "bg-amber-100 text-amber-700";
  if (type.startsWith("REFUND_")) return "bg-amber-100 text-amber-700";
  if (type === "PAYOUT_RELEASED") return "bg-emerald-100 text-emerald-700";
  if (type === "PAYMENT_CONFIRMED" || type === "PROVIDER_CONFIRMED")
    return "bg-emerald-100 text-emerald-700";
  if (type === "COMPLETED") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
};

const formatEventTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const actorName = (event: BookingEvent): string | null => {
  const actor = event.actorUserId;
  if (!actor) return null;
  if (typeof actor === "string") return null;
  return actor.name || actor.email || null;
};

export function BookingTimeline({ subjectId }: { subjectId: string }) {
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await adminApi.getBookingTimeline(subjectId);
        if (cancelled) return;
        setEvents(response.success && response.data ? response.data : []);
      } catch {
        if (!cancelled) setError("Could not load the timeline.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading timeline…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No events recorded. Bookings created before the audit log was introduced have no history.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {events.map((event) => {
        const name = actorName(event);
        const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;
        const isOpen = Boolean(expanded[event._id]);

        return (
          <li key={event._id} className="relative">
            <span className="absolute top-1.5 -left-[1.4rem] h-2.5 w-2.5 rounded-full bg-slate-300 ring-2 ring-white" />

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold ${toneForType(event.type)}`}
              >
                {event.type.replace(/_/g, " ")}
              </span>
              {event.fromStatus && event.toStatus && event.fromStatus !== event.toStatus && (
                <span className="font-mono text-xs text-slate-500">
                  {event.fromStatus} → {event.toStatus}
                </span>
              )}
              {typeof event.amountPaise === "number" && (
                <span className="text-xs font-semibold text-slate-700">
                  ₹{(event.amountPaise / 100).toLocaleString("en-IN")}
                </span>
              )}
            </div>

            {event.summary && <p className="mt-1 text-sm text-slate-700">{event.summary}</p>}

            <p className="mt-1 text-xs text-slate-500">
              {formatEventTime(event.occurredAt)} ·{" "}
              {ACTOR_LABEL[event.actorType] ?? event.actorType}
              {name ? ` (${name})` : ""} via {CHANNEL_LABEL[event.channel] ?? event.channel}
            </p>

            {hasMetadata && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [event._id]: !prev[event._id],
                    }))
                  }
                  className="text-power-orange mt-1 text-xs font-medium hover:underline"
                >
                  {isOpen ? "Hide details" : "Show details"}
                </button>
                {isOpen && (
                  <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-600">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                )}
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
