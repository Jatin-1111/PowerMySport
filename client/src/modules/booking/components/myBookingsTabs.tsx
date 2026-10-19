"use client";

import { Award, Building2, MapPin, Users } from "lucide-react";
import Link from "next/link";
import type { AcademyRef, Booking, BookingExpertRef, Coach, Venue } from "@/types";
import type { BookingTabId } from "@/modules/booking/utils/bookingBuckets";
import { cn } from "@/utils/cn";

/**
 * One definition of the four kinds of booking a parent can have.
 *
 * The tab row, the empty state and the card heading all used to derive the kind
 * separately, in nested ternaries that only knew about three of them — which is
 * how expert consultations ended up absent from the list while being a first
 * class booking everywhere else. Adding a fifth kind now means adding one entry
 * here, not editing three chains.
 */

interface BookingTabConfig {
  id: BookingTabId;
  label: string;
  icon: typeof MapPin;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel: string;
  browseHref: string;
}

const isExpertsLive = process.env.NEXT_PUBLIC_EXPERTS_IS_LIVE === "true";

const ALL_TABS: BookingTabConfig[] = [
  {
    id: "venues",
    label: "Venue Bookings",
    icon: MapPin,
    emptyTitle: "No venue bookings",
    emptyDescription: "You haven't booked any venues yet.",
    emptyActionLabel: "Browse Venues",
    browseHref: "/booking?tab=venues",
  },
  {
    id: "coaches",
    label: "Coach Bookings",
    icon: Award,
    emptyTitle: "No coach bookings",
    emptyDescription: "You haven't booked any coaches yet.",
    emptyActionLabel: "Find a Coach",
    browseHref: "/booking?tab=coaches",
  },
  {
    id: "academies",
    label: "Academy Bookings",
    icon: Building2,
    emptyTitle: "No academy bookings",
    emptyDescription: "You haven't booked any academy sessions yet.",
    emptyActionLabel: "Browse Academies",
    browseHref: "/booking?tab=academies",
  },
  {
    id: "experts",
    label: "Expert Sessions",
    icon: Users,
    emptyTitle: "No expert sessions",
    emptyDescription: "You haven't booked a 1:1 session with an expert yet.",
    emptyActionLabel: "Find an Expert",
    browseHref: "/booking?tab=experts",
  },
];

/**
 * Which tabs to show.
 *
 * The experts flag gates *booking a new* session, not seeing one already paid
 * for — so the tab also appears whenever the parent actually has expert
 * bookings. Without that, turning the flag off would hide sessions they have
 * already been charged for, while the server still counts them in the totals.
 */
export const visibleBookingTabs = (counts: Record<BookingTabId, number>): BookingTabConfig[] =>
  ALL_TABS.filter((tab) => tab.id !== "experts" || isExpertsLive || counts.experts > 0);

/** Looks up every tab, not just the visible ones, so the active id always resolves. */
export const bookingTabConfig = (id: BookingTabId): BookingTabConfig =>
  ALL_TABS.find((tab) => tab.id === id) ?? ALL_TABS[0];

export function BookingTabBar({
  activeTab,
  counts,
  onTabChange,
}: {
  activeTab: BookingTabId;
  counts: Record<BookingTabId, number>;
  onTabChange: (tab: BookingTabId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Booking types"
      className="border-hairline flex gap-x-7 overflow-x-auto overflow-y-hidden border-b"
    >
      {visibleBookingTabs(counts).map((tab) => {
        const isSelected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`booking-tab-${tab.id}`}
            aria-controls={`booking-tabpanel-${tab.id}`}
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "focus-visible:ring-ink shrink-0 whitespace-nowrap border-b-2 px-0.5 py-3.5 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              isSelected
                ? "border-ink text-ink"
                : "text-ink-muted hover:text-ink border-transparent"
            )}
          >
            {tab.label}
            <span className="text-ink-muted ml-2 tabular-nums">{counts[tab.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

const asObject = <T,>(value: unknown): T | null =>
  value && typeof value === "object" ? (value as T) : null;

function HeadingRow({
  icon: Icon,
  iconClass,
  children,
}: {
  icon: typeof MapPin;
  iconClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1 inline-flex items-center gap-2 text-base font-bold text-slate-900">
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconClass)}>
        <Icon className="h-4 w-4" />
      </span>
      {children}
    </div>
  );
}

function SubLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-sm text-slate-500">
      <MapPin className="h-3.5 w-3.5 text-slate-400" />
      {children}
    </p>
  );
}

function Pending({ what }: { what: string }) {
  return (
    <div className="mb-2">
      <h3 className="text-base font-bold text-slate-900">{what} details pending</h3>
      <p className="text-sm text-slate-500">
        We&apos;ll show the full details once they are resolved.
      </p>
    </div>
  );
}

/** The provider name and location line at the top of a booking card. */
export function BookingProviderHeading({ booking, tab }: { booking: Booking; tab: BookingTabId }) {
  if (tab === "venues") {
    const venue = asObject<Venue & { _id?: string }>(booking.venueId);
    if (!venue) return <Pending what="Venue" />;
    return (
      <>
        <Link
          href={`/venues/${venue._id || venue.id}`}
          className="hover:text-power-orange transition-colors"
        >
          <HeadingRow icon={MapPin} iconClass="bg-indigo-100 text-indigo-600">
            {venue.name || "Venue"}
          </HeadingRow>
        </Link>
        {venue.address && <SubLine>{venue.address}</SubLine>}
      </>
    );
  }

  if (tab === "coaches") {
    const coach = asObject<Coach>(booking.coachId);
    if (!coach) return <Pending what="Coach" />;
    const user = asObject<{ name?: string }>(coach.userId);
    return (
      <>
        <HeadingRow icon={Award} iconClass="bg-purple-100 text-purple-600">
          {user?.name || coach.sports?.[0] || "Coach"}
        </HeadingRow>
        <p className="mb-2 text-sm text-slate-500">
          Service:{" "}
          <span className="font-medium text-slate-700">
            {coach.serviceMode === "FREELANCE"
              ? "Freelance"
              : coach.serviceMode === "OWN_VENUE"
                ? "Own Venue"
                : "Hybrid"}
          </span>
        </p>
      </>
    );
  }

  if (tab === "academies") {
    const academy = asObject<AcademyRef>(booking.academyId);
    if (!academy) return <Pending what="Academy" />;
    const address = [academy.address, academy.city, academy.state, academy.pincode]
      .filter(Boolean)
      .join(", ");
    return (
      <>
        <HeadingRow icon={Building2} iconClass="bg-teal-100 text-teal-600">
          {academy.name || "Academy"}
        </HeadingRow>
        {address && <SubLine>{address}</SubLine>}
      </>
    );
  }

  const expert = asObject<BookingExpertRef>(booking.expertId);
  if (!expert) return <Pending what="Expert" />;
  const mode = booking.expert?.mode;
  return (
    <>
      <Link
        href={`/experts/${expert._id || expert.id}`}
        className="hover:text-power-orange transition-colors"
      >
        <HeadingRow icon={Users} iconClass="bg-orange-100 text-power-orange">
          {expert.name || "Expert"}
        </HeadingRow>
      </Link>
      <p className="mb-2 text-sm text-slate-500">
        {mode === "IN_PERSON" ? "In-person session" : "Online session"}
        {expert.city ? ` · ${expert.city}` : ""}
      </p>
    </>
  );
}
