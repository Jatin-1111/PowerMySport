"use client";

import { bookingApi } from "@/modules/booking/services/booking";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Booking } from "@/types";
import { formatDate, formatTime } from "@/utils/format";
import {
  Calendar,
  Clock,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface PaginationInfo {
  total: number;
  page: number;
  totalPages: number;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    totalPages: 0,
  });
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setIsLoading(true);
        const response = await bookingApi.getMyBookings({
          page: currentPage,
          limit: itemsPerPage,
        });
        if (response.success && response.data) {
          setBookings(response.data);
          if (response.pagination) {
            setPagination(response.pagination);
          }
        }
      } catch (error) {
        console.error("Failed to fetch bookings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookings();
  }, [currentPage, itemsPerPage]);

  const handleCancel = async (bookingId: string) => {
    try {
      await bookingApi.cancelBooking(bookingId);
      setBookings(bookings.filter((b) => b.id !== bookingId));
    } catch (error) {
      console.error("Failed to cancel booking:", error);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading bookings...</div>;
  }

  return (
    <div className="space-y-6">
      <PlayerPageHeader
        badge="Player"
        title="My Bookings"
        subtitle="Keep track of your upcoming sessions, payments, and history in one place."
        action={
          <div className="flex flex-wrap gap-3">
            <Link href="/venues">
              <Button variant="secondary">Browse Venues</Button>
            </Link>
            <Link href="/coaches">
              <Button variant="primary">Find a Coach</Button>
            </Link>
          </div>
        }
      />

      {bookings.length === 0 ? (
        <Card className="bg-white">
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-power-orange/10 px-4 py-2 text-sm font-semibold text-power-orange">
              No bookings yet
            </div>
            <p className="max-w-md text-slate-600">
              Explore venues or connect with a coach to schedule your first
              session.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/venues">
                <Button variant="secondary">Browse Venues</Button>
              </Link>
              <Link href="/coaches">
                <Button variant="primary">Browse Coaches</Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card
                key={booking.id}
                className="bg-white hover:shadow-lg transition-shadow"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    {typeof booking.venueId === "object" &&
                    booking.venueId !== null ? (
                      <>
                        <Link
                          href={`/venues/${(booking.venueId as any)._id || (booking.venueId as any).id}`}
                          className="text-lg font-semibold mb-2 text-slate-900 hover:text-power-orange transition-colors inline-block"
                        >
                          {(booking.venueId as any).name || "Venue"}
                        </Link>
                      </>
                    ) : (
                      <h3 className="text-lg font-semibold mb-2 text-slate-900">
                        Venue ID: {booking.venueId}
                      </h3>
                    )}
                    <p className="text-slate-600 flex flex-wrap items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>{formatDate(booking.date)}</span>
                      <span className="text-slate-300">|</span>
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span>
                        {formatTime(booking.startTime)} -{" "}
                        {formatTime(booking.endTime)}
                      </span>
                    </p>
                    {typeof booking.venueId === "object" &&
                      booking.venueId !== null &&
                      (booking.venueId as any).address && (
                        <p className="text-sm text-slate-500 mt-1">
                          {(booking.venueId as any).address}
                        </p>
                      )}
                    {booking.sport && (
                      <p className="text-sm text-slate-600 mt-1">
                        Sport:{" "}
                        <span className="font-medium">{booking.sport}</span>
                      </p>
                    )}
                    {booking.status === "CONFIRMED" && booking.checkInCode && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                          Check-in Code
                        </span>
                        <span className="font-mono text-sm font-bold text-emerald-900">
                          {booking.checkInCode}
                        </span>
                      </div>
                    )}
                    <p className="text-slate-900 font-semibold mt-2 flex items-center gap-1">
                      <IndianRupee className="h-4 w-4 text-slate-700" />
                      <span>{booking.totalAmount}</span>
                    </p>
                    <span
                      className={`inline-block mt-2 px-3 py-1 rounded text-sm font-semibold ${
                        booking.status === "CONFIRMED"
                          ? "bg-green-100 text-green-700 border border-green-300"
                          : "bg-red-100 text-red-700 border border-red-300"
                      }`}
                    >
                      {booking.status.charAt(0).toUpperCase() +
                        booking.status.slice(1)}
                    </span>
                  </div>
                  {booking.status === "CONFIRMED" && (
                    <Button
                      onClick={() => handleCancel(booking.id)}
                      variant="danger"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <Card className="bg-white">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-slate-600">
                  Page {pagination.page} of {pagination.totalPages} •{" "}
                  {pagination.total} total bookings
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || isLoading}
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setCurrentPage((p) =>
                        Math.min(pagination.totalPages, p + 1),
                      )
                    }
                    disabled={
                      currentPage === pagination.totalPages || isLoading
                    }
                    className="flex items-center gap-2"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
