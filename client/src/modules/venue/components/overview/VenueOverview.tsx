"use client";

import { useAuthStore } from "@/modules/auth/store/authStore";
import { NextSessions } from "@/modules/shared/components/bookings/NextSessions";
import { RequestsBand } from "@/modules/shared/components/bookings/RequestsBand";
import { ProviderFigures } from "@/modules/shared/components/dashboard/ProviderFigures";
import { Button } from "@/modules/shared/ui/Button";
import { FigureGridSkeleton } from "@/modules/shared/ui/FigureGrid";
import { selectRequests, selectUpcoming } from "@/modules/shared/utils/bookingTime";
import { plural } from "@/modules/shared/utils/figures";
import type { Booking } from "@/types";
import { useVenueOverview } from "../../hooks/useVenueOverview";
import {
  averageRating,
  bookingVenueName,
  describeVenueStatus,
  venueEarning,
  venueNeedingAttention,
} from "../../utils/overview";
import { OverviewSkeleton } from "./OverviewSkeleton";
import { VenueStatusBand } from "./VenueStatusBand";
import { YourVenues } from "./YourVenues";

/**
 * The venue lister's landing page. It answers, in order: is anything waiting
 * on me, what is coming up, and how are the venues doing. The requests band
 * appears only while there is a request to answer; the status band only while
 * a venue is not live.
 */
export function VenueOverview() {
  const { venues, earnings, analytics, bookings } = useVenueOverview();
  const userName = useAuthStore((state) => state.user?.name);

  if (venues.isPending) return <OverviewSkeleton />;

  if (venues.isError) {
    return (
      <div role="alert" className="bg-paper-deep max-w-xl rounded-2xl p-6 sm:p-8">
        <h1 className="font-editorial text-ink text-3xl font-light tracking-tight">
          We could not load your dashboard
        </h1>
        <p className="text-ink-body mt-3 text-pretty">
          Check your connection and try again. Your venues and bookings are safe.
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => venues.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const list = venues.data;
  const now = new Date();
  const requests = bookings.data ? selectRequests(bookings.data) : [];
  const upcoming = bookings.data ? selectUpcoming(bookings.data, now) : [];
  const attention = venueNeedingAttention(list);
  const live = list.filter((venue) => !describeVenueStatus(venue).headline).length;
  const titleOf = (booking: Booking) => bookingVenueName(booking, list);

  return (
    <div className="space-y-10 sm:space-y-14">
      <header className="min-w-0">
        <p className="text-ink-body text-sm">Venue console</p>
        <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
          {userName || "Your venues"}
        </h1>
        <p className="text-ink-body mt-3">
          {list.length === 0 ? "No venues yet" : `${plural(list.length, "venue")}, ${live} live`}
        </p>
      </header>

      {requests.length > 0 && (
        <RequestsBand
          requests={requests}
          now={now}
          href="/venue-lister/vendor-bookings"
          titleOf={titleOf}
          amountOf={venueEarning}
        />
      )}

      {attention && <VenueStatusBand view={describeVenueStatus(attention)} />}

      {earnings.isPending ? (
        <FigureGridSkeleton />
      ) : earnings.isError ? (
        <div role="alert" className="bg-paper-deep max-w-xl rounded-xl p-5">
          <p className="text-ink font-medium">We could not load your earnings</p>
          <p className="text-ink-body mt-1 text-sm">The rest of this page is up to date.</p>
          <Button className="mt-4" size="sm" variant="outline" onClick={() => earnings.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <ProviderFigures
          earnings={earnings.data}
          people={
            analytics.data
              ? {
                  total: analytics.data.overview.totalCustomers,
                  returning: analytics.data.overview.returningCustomers,
                }
              : undefined
          }
          peopleFailed={analytics.isError}
          peopleLabel="Customers"
          rating={averageRating(list)}
          noReviewsHint="Players can review after a completed booking"
        />
      )}

      <div className="grid gap-12 xl:grid-cols-12 xl:gap-16">
        <div className="xl:col-span-7">
          <NextSessions
            sessions={upcoming}
            now={now}
            failed={bookings.isError}
            titleOf={titleOf}
            href="/venue-lister/vendor-bookings"
            linkLabel="All bookings"
            emptyText="Nothing is booked yet. Confirmed bookings appear here, soonest first."
          />
        </div>
        <div className="xl:col-span-5">
          <YourVenues venues={list} />
        </div>
      </div>
    </div>
  );
}
