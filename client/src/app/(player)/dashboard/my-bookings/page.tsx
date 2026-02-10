"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { bookingApi } from "@/modules/booking/services/booking";
import { Booking } from "@/types";
import { formatDate, formatTime } from "@/utils/format";
import { Calendar, Clock, IndianRupee } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await bookingApi.getMyBookings();
        if (response.success && response.data) {
          setBookings(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch bookings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookings();
  }, []);

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
        <div className="space-y-4">
          {bookings.map((booking) => (
            <Card
              key={booking.id}
              className="bg-white hover:shadow-lg transition-shadow"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-slate-900">
                    Venue ID: {booking.venueId}
                  </h3>
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
      )}
    </div>
  );
}
