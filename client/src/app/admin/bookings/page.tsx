"use client";

import React, { useEffect, useState } from "react";
import { statsApi } from "@/lib/stats";
import { Booking } from "@/types";
import { formatDate, formatTime } from "@/utils/format";

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBookings = async () => {
      try {
        const response = await statsApi.getAllBookings();
        if (response.success && response.data) {
          setBookings(response.data);
        }
      } catch (error) {
        console.error("Failed to load bookings:", error);
      } finally {
        setLoading(false);
      }
    };

    loadBookings();
  }, []);

  if (loading) {
    return <div className="text-center py-12">Loading bookings...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-deep-slate">All Bookings</h1>

      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground">No bookings yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-card rounded-lg p-6 border border-border"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold">
                      Booking #{booking.id.slice(-6)}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        booking.status === "CONFIRMED"
                          ? "bg-turf-green/10 text-turf-green border border-turf-green"
                          : "bg-yellow-500/10 text-yellow-600 border border-yellow-500"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Date & Time
                      </p>
                      <p className="font-semibold">
                        {formatDate(booking.date)}
                      </p>
                      <p className="text-sm">
                        {formatTime(booking.startTime)} -{" "}
                        {formatTime(booking.endTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Venue</p>
                      <p className="font-semibold">ID: {booking.venueId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Player</p>
                      <p className="font-semibold">ID: {booking.userId}</p>
                    </div>
                  </div>
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
