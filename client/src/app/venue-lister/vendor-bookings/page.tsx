"use client";

import React, { useEffect, useState } from "react";
import { Booking } from "@/types";
import { bookingApi } from "@/lib/booking";
import { formatDate, formatTime } from "@/utils/format";

export default function VenueBookingsPage() {
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

  if (isLoading) {
    return <div className="text-center py-12">Loading bookings...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-deep-slate">
        Venue Bookings
      </h1>

      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground mb-4">No bookings yet</p>
          <p className="text-sm text-muted-foreground">
            Bookings will appear here once players book your venues
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-card rounded-lg p-6 shadow border border-border hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-deep-slate">
                      Booking #{booking.id.slice(-6)}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        booking.status === "CONFIRMED"
                          ? "bg-turf-green/10 text-turf-green border border-turf-green"
                          : booking.status === "PENDING"
                            ? "bg-yellow-500/10 text-yellow-600 border border-yellow-500"
                            : "bg-error-red/10 text-error-red border border-error-red"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Date & Time
                      </p>
                      <p className="font-semibold">
                        📅 {formatDate(booking.date)}
                      </p>
                      <p className="text-sm">
                        ⏰ {formatTime(booking.startTime)} -{" "}
                        {formatTime(booking.endTime)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">
                        Player Details
                      </p>
                      <p className="font-semibold">User ID: {booking.userId}</p>
                    </div>
                  </div>

                  {/* Payment Details */}
                  {booking.venuePayment && (
                    <div className="bg-muted rounded-lg p-4 mt-3">
                      <p className="text-sm font-semibold mb-2">
                        Payment Details
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">
                            Venue Fee:
                          </span>
                          <span className="font-semibold ml-2">
                            ₹{booking.venuePayment.amount}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>
                          <span
                            className={`ml-2 font-semibold ${
                              booking.venuePayment.status === "COMPLETED"
                                ? "text-turf-green"
                                : "text-yellow-600"
                            }`}
                          >
                            {booking.venuePayment.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-power-orange">
                    ₹{booking.totalAmount}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
