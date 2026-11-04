"use client";

import { queryKeys } from "@/lib/query/keys";
import { toast } from "@/lib/toast";
import { bookingApi } from "@/modules/booking/services/booking";
import { RequestRows } from "@/modules/shared/components/bookings/RequestRows";
import { SessionCheckIn } from "@/modules/shared/components/bookings/SessionCheckIn";
import { SessionRows } from "@/modules/shared/components/bookings/SessionRows";
import { useSessionCheckIn } from "@/modules/shared/hooks/useSessionCheckIn";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { UnderlineFilter } from "@/modules/shared/ui/UnderlineFilter";
import { bookingKey } from "@/modules/shared/utils/bookingDisplay";
import {
  countByFilter,
  filterSessions,
  requestsOf,
  type BookingFilter,
} from "@/modules/shared/utils/bookingGroups";
import { plural } from "@/modules/shared/utils/figures";
import type { Booking } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useVenueBookings } from "../../hooks/useVenueBookings";
import { bookingVenueName, venueEarning } from "../../utils/overview";

const PAGE_SIZE = 10;

/** The API's own message when it sent one, else ours. */
const messageOf = (error: unknown, fallback: string): string =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/**
 * The venue's bookings: requests to answer first, then a check-in field, then
 * every other booking by when it is. A venue cannot see who booked, so each
 * row leads with the venue; what the venue itself earns is shown, not the
 * total the player paid.
 */
export function VenueBookings() {
  const queryClient = useQueryClient();
  const { venues, bookings } = useVenueBookings();
  const [filter, setFilter] = useState<BookingFilter>("upcoming");
  const [currentPage, setCurrentPage] = useState(1);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const all = useMemo(() => bookings.data ?? [], [bookings.data]);
  const venueList = useMemo(() => venues.data ?? [], [venues.data]);

  /** Reflect one booking's new status in the shared cache without a refetch. */
  const setStatus = (bookingId: string, status: Booking["status"]) =>
    queryClient.setQueryData<Booking[]>(queryKeys.venueConsole.bookings, (current) =>
      (current ?? []).map((booking, index) =>
        bookingKey(booking, index) === bookingId ? { ...booking, status } : booking
      )
    );

  const checkIn = useSessionCheckIn((started) =>
    setStatus(started.id || (started as unknown as { _id?: string })._id || "", started.status)
  );

  const requests = useMemo(() => requestsOf(all), [all]);
  const counts = useMemo(() => countByFilter(all), [all]);
  const sessions = useMemo(() => filterSessions(all, filter), [all, filter]);

  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const pageSessions = sessions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const now = new Date();
  const titleOf = (booking: Booking) => bookingVenueName(booking, venueList);

  const changeFilter = (next: BookingFilter) => {
    setFilter(next);
    setCurrentPage(1);
  };

  const handleApprove = async (bookingId: string) => {
    try {
      setApprovingId(bookingId);
      const response = await bookingApi.confirmBookingByProvider(bookingId);
      const status = response.data?.status;
      if (response.success && status) {
        setStatus(bookingId, status);
        toast.success("Booking confirmed.");
      }
    } catch (error: unknown) {
      toast.error(messageOf(error, "Unable to confirm booking."));
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    try {
      setRejectingId(bookingId);
      const response = await bookingApi.rejectBookingByProvider(bookingId, "Rejected by venue");
      const rejected = response.data?.booking;
      if (response.success && rejected) {
        setStatus(bookingId, rejected.status);
        toast.success("Booking declined.");
      }
    } catch (error: unknown) {
      toast.error(messageOf(error, "Unable to decline booking."));
    } finally {
      setRejectingId(null);
    }
  };

  const header = (
    <header>
      <p className="text-ink-body text-sm">Venue console</p>
      <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
        Bookings
      </h1>
      {bookings.isSuccess && all.length > 0 && (
        <p className="text-ink-body mt-3">
          {plural(all.length, "booking")}, {counts.upcoming} upcoming
          {requests.length > 0 && `, ${requests.length} waiting for your reply`}.
        </p>
      )}
    </header>
  );

  if (bookings.isPending) {
    return (
      <div className="space-y-10" role="status" aria-busy="true">
        <span className="sr-only">Loading your bookings</span>
        <div aria-hidden="true">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-11 w-56" />
        </div>
        <div aria-hidden="true" className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (bookings.isError) {
    return (
      <div className="space-y-10">
        {header}
        <div role="alert" className="bg-paper-deep max-w-xl rounded-2xl p-6 sm:p-8">
          <h2 className="font-editorial text-ink text-2xl font-light tracking-tight">
            We could not load your bookings
          </h2>
          <p className="text-ink-body mt-2 text-pretty">
            Check your connection and try again. Your bookings are safe.
          </p>
          <Button className="mt-5" variant="secondary" onClick={() => bookings.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (all.length === 0) {
    return (
      <div className="space-y-10">
        {header}
        <div className="border-hairline max-w-xl border-t pt-6">
          <p className="text-ink-body text-pretty">
            No bookings yet. Players can book once a venue is approved, and each request appears
            here for you to confirm or decline.
          </p>
          <p className="mt-4">
            <Link href="/venue-lister/inventory" className={`${TEXT_LINK} ring-offset-paper`}>
              Check your venues
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 sm:space-y-12">
      {header}

      {requests.length > 0 && (
        <RequestRows
          requests={requests}
          now={now}
          titleOf={titleOf}
          amountOf={venueEarning}
          approvingId={approvingId}
          rejectingId={rejectingId}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      <SessionCheckIn
        code={checkIn.code}
        onCodeChange={checkIn.setCode}
        loading={checkIn.loading}
        message={checkIn.message}
        startedBooking={checkIn.startedBooking}
        onSubmit={() => void checkIn.submit()}
        title="Check a player in"
        description="Enter the 8-character code the player shows you when they arrive."
        submitLabel="Check in"
        startedTitleOf={titleOf}
      />

      <section aria-labelledby="sessions-heading">
        <h2 id="sessions-heading" className="sr-only">
          Bookings
        </h2>
        <UnderlineFilter
          label="Filter bookings"
          value={filter}
          onChange={changeFilter}
          items={[
            { label: "Upcoming", value: "upcoming", count: counts.upcoming },
            { label: "Past", value: "past", count: counts.past },
            { label: "All", value: "all", count: counts.all },
          ]}
        />

        {pageSessions.length === 0 ? (
          <p className="text-ink-body border-hairline max-w-[56ch] text-pretty border-b py-6">
            {filter === "upcoming"
              ? "No upcoming bookings. Confirmed bookings appear here, soonest first."
              : "Nothing here yet."}
          </p>
        ) : (
          <SessionRows
            sessions={pageSessions}
            now={now}
            titleOf={titleOf}
            amountOf={venueEarning}
          />
        )}

        {totalPages > 1 && (
          <nav aria-label="Pages" className="mt-6 flex items-center justify-between gap-4 text-sm">
            <p className="text-ink-body tabular-nums">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-3">
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}
