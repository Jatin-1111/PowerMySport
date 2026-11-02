"use client";

import { toast } from "@/lib/toast";
import { bookingApi } from "@/modules/booking/services/booking";
import { RequestRows } from "@/modules/coach/components/bookings/RequestRows";
import { SessionCheckIn } from "@/modules/coach/components/bookings/SessionCheckIn";
import { SessionRows } from "@/modules/coach/components/bookings/SessionRows";
import { useSessionCheckIn } from "@/modules/coach/hooks/useSessionCheckIn";
import { coachApi } from "@/modules/coach/services/coach";
import {
  countByFilter,
  filterSessions,
  requestsOf,
  type BookingFilter,
} from "@/modules/coach/utils/bookings";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { UnderlineFilter } from "@/modules/shared/ui/UnderlineFilter";
import { plural } from "@/modules/shared/utils/figures";
import type { Booking, Coach } from "@/types";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 10;

/** The API's own message when it sent one, else ours. */
const messageOf = (error: unknown, fallback: string): string =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** The list endpoints return raw documents, so the id may arrive as `_id`. */
const idOf = (booking: Booking): string =>
  booking.id || (booking as unknown as { _id?: string })._id || "";

export default function CoachBookingsPage() {
  const [allCoachBookings, setAllCoachBookings] = useState<Booking[]>([]);
  const [currentCoach, setCurrentCoach] = useState<Coach | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<BookingFilter>("upcoming");
  const [currentPage, setCurrentPage] = useState(1);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // A started session is in progress now; reflect it in the list without a refetch.
  const checkIn = useSessionCheckIn((started) =>
    setAllCoachBookings((prev) =>
      prev.map((booking) =>
        idOf(booking) === idOf(started) ? { ...booking, status: started.status } : booking
      )
    )
  );

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setIsLoading(true);
        setLoadFailed(false);
        const [bookingsResponse, coachResponse] = await Promise.all([
          bookingApi.getMyBookings(),
          coachApi.getMyProfile().catch(() => null),
        ]);

        if (bookingsResponse.success && bookingsResponse.data) {
          setAllCoachBookings(bookingsResponse.data.filter((b) => b.coachId));
        }

        if (coachResponse?.success && coachResponse.data) {
          setCurrentCoach(coachResponse.data);
        }
      } catch (error) {
        console.error("Failed to fetch bookings:", error);
        setLoadFailed(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookings();
  }, [reloadKey]);

  const requests = useMemo(() => requestsOf(allCoachBookings), [allCoachBookings]);
  const counts = useMemo(() => countByFilter(allCoachBookings), [allCoachBookings]);
  const sessions = useMemo(
    () => filterSessions(allCoachBookings, filter),
    [allCoachBookings, filter]
  );

  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const pageSessions = sessions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const now = new Date();

  const changeFilter = (next: BookingFilter) => {
    setFilter(next);
    setCurrentPage(1);
  };

  const handleApproveBooking = async (bookingId: string) => {
    try {
      setApprovingId(bookingId);
      const response = await bookingApi.confirmBookingByProvider(bookingId);
      const confirmedStatus = response.data?.status;
      if (response.success && confirmedStatus) {
        setAllCoachBookings((prev) =>
          prev.map((booking) =>
            idOf(booking) === bookingId ? { ...booking, status: confirmedStatus } : booking
          )
        );
        toast.success("Booking confirmed.");
      }
    } catch (error: unknown) {
      toast.error(messageOf(error, "Unable to confirm booking."));
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    try {
      setRejectingId(bookingId);
      const response = await bookingApi.rejectBookingByProvider(bookingId, "Rejected by coach");
      const rejectedBooking = response.data?.booking;
      if (response.success && rejectedBooking) {
        setAllCoachBookings((prev) =>
          prev.map((booking) =>
            idOf(booking) === bookingId ? { ...booking, status: rejectedBooking.status } : booking
          )
        );
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
      <p className="text-ink-body text-sm">Coach console</p>
      <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
        Bookings
      </h1>
      {!isLoading && !loadFailed && allCoachBookings.length > 0 && (
        <p className="text-ink-body mt-3">
          {plural(allCoachBookings.length, "booking")}, {counts.upcoming} upcoming
          {requests.length > 0 && `, ${requests.length} waiting for your reply`}.
        </p>
      )}
    </header>
  );

  if (isLoading) {
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

  if (loadFailed) {
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
          <Button className="mt-5" variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (allCoachBookings.length === 0) {
    return (
      <div className="space-y-10">
        {header}
        <div className="border-hairline max-w-xl border-t pt-6">
          <p className="text-ink-body text-pretty">
            No bookings yet. Clients can book you once your availability is open, and each request
            appears here for you to confirm or decline.
          </p>
          <p className="mt-4">
            <Link href="/coach/schedule" className={`${TEXT_LINK} ring-offset-paper`}>
              Open your schedule
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
          coach={currentCoach}
          approvingId={approvingId}
          rejectingId={rejectingId}
          onApprove={handleApproveBooking}
          onReject={handleRejectBooking}
        />
      )}

      <SessionCheckIn
        code={checkIn.code}
        onCodeChange={checkIn.setCode}
        loading={checkIn.loading}
        message={checkIn.message}
        startedBooking={checkIn.startedBooking}
        onSubmit={() => void checkIn.submit()}
      />

      <section aria-labelledby="sessions-heading">
        <h2 id="sessions-heading" className="sr-only">
          Sessions
        </h2>
        <UnderlineFilter
          label="Filter sessions"
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
              ? "No upcoming sessions. Confirmed sessions appear here, soonest first."
              : "Nothing here yet."}
          </p>
        ) : (
          <SessionRows sessions={pageSessions} now={now} coach={currentCoach} />
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
