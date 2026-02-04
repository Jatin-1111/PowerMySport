"use client";

import React, { useEffect, useState } from "react";
import { Booking } from "@/types";
import { bookingApi } from "@/lib/booking";
import { formatDate, formatTime } from "@/utils/format";

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
    <div>
      <h1 className="text-3xl font-bold mb-6 text-deep-slate">My Bookings</h1>

      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground mb-4">No bookings yet</p>
          <a
            href="/dashboard/search"
            className="text-power-orange font-semibold hover:underline"
          >
            Search venues to book
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-card rounded-lg p-6 shadow border border-border hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-deep-slate">
                    Venue ID: {booking.venueId}
                  </h3>
                  <p className="text-muted-foreground">
                    📅 {formatDate(booking.date)} • ⏰{" "}
                    {formatTime(booking.startTime)} -{" "}
                    {formatTime(booking.endTime)}
                  </p>
                  <p className="text-deep-slate font-semibold mt-2">
                    💰 ₹{booking.totalAmount}
                  </p>
                  <span
                    className={`inline-block mt-2 px-3 py-1 rounded text-sm font-semibold ${
                      booking.status === "CONFIRMED"
                        ? "bg-turf-green/10 text-turf-green border border-turf-green"
                        : "bg-error-red/10 text-error-red border border-error-red"
                    }`}
                  >
                    {booking.status.charAt(0).toUpperCase() +
                      booking.status.slice(1)}
                  </span>
                </div>
                {booking.status === "CONFIRMED" && (
                  <button
                    onClick={() => handleCancel(booking.id)}
                    className="bg-error-red text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
