"use client";

import React, { useEffect, useState } from "react";
import { Booking } from "@/types";
import { bookingApi } from "@/lib/booking";
import { formatDate, formatTime } from "@/utils/format";

export default function CoachBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    totalEarnings: 0,
  });

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await bookingApi.getMyBookings();
        if (response.success && response.data) {
          const coachBookings = response.data.filter((b) => b.coachId);
          setBookings(coachBookings);

          // Calculate stats
          const confirmed = coachBookings.filter(
            (b) => b.status === "CONFIRMED",
          ).length;
          const earnings = coachBookings
            .filter((b) => b.coachPayment?.status === "COMPLETED")
            .reduce((sum, b) => sum + (b.coachPayment?.amount || 0), 0);

          setStats({
            total: coachBookings.length,
            confirmed,
            totalEarnings: earnings,
          });
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
      <h1 className="text-3xl font-bold mb-6 text-deep-slate">My Bookings</h1>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-lg p-4 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Total Bookings</p>
          <p className="text-3xl font-bold text-deep-slate">{stats.total}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Confirmed</p>
          <p className="text-3xl font-bold text-turf-green">
            {stats.confirmed}
          </p>
        </div>
        <div className="bg-card rounded-lg p-4 border border-border">
          <p className="text-sm text-muted-foreground mb-1">Total Earnings</p>
          <p className="text-3xl font-bold text-power-orange">
            ₹{stats.totalEarnings}
          </p>
        </div>
      </div>

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground mb-4">No bookings yet</p>
          <p className="text-sm text-muted-foreground">
            Bookings will appear here once players book sessions with you
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
                      Session #{booking.id.slice(-6)}
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
                      <p className="text-sm text-muted-foreground">Venue</p>
                      <p className="font-semibold">
                        Venue ID: {booking.venueId}
                      </p>
                    </div>
                  </div>

                  {/* Payment Details */}
                  {booking.coachPayment && (
                    <div className="bg-muted rounded-lg p-4 mt-3">
                      <p className="text-sm font-semibold mb-2">
                        Your Earnings
                      </p>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-2xl font-bold text-power-orange">
                            ₹{booking.coachPayment.amount}
                          </span>
                        </div>
                        <div>
                          <span
                            className={`px-3 py-1 rounded text-sm font-semibold ${
                              booking.coachPayment.status === "COMPLETED"
                                ? "bg-turf-green/10 text-turf-green border border-turf-green"
                                : "bg-yellow-500/10 text-yellow-600 border border-yellow-500"
                            }`}
                          >
                            {booking.coachPayment.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
