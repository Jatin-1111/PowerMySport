"use client";

import { Card } from "@/components/ui/Card";
import { statsApi } from "@/lib/stats";
import { Booking } from "@/types";
import { formatDate, formatTime } from "@/utils/format";
import { useEffect, useState } from "react";

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
      <h1 className="text-3xl font-bold mb-6 text-slate-900">All Bookings</h1>

      {bookings.length === 0 ? (
        <Card className="text-center bg-white">
          <p className="text-slate-600">No bookings yet</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <Card key={booking.id} className="bg-white">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Booking #{booking.id.slice(-6)}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        booking.status === "CONFIRMED"
                          ? "bg-green-100 text-green-700 border border-green-300"
                          : "bg-yellow-100 text-yellow-700 border border-yellow-300"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Date & Time</p>
                      <p className="font-semibold text-slate-900">
                        {formatDate(booking.date)}
                      </p>
                      <p className="text-sm text-slate-900">
                        {formatTime(booking.startTime)} -{" "}
                        {formatTime(booking.endTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Venue</p>
                      <p className="font-semibold text-slate-900">
                        ID: {booking.venueId}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Player</p>
                      <p className="font-semibold text-slate-900">
                        ID: {booking.userId}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-power-orange">
                    ₹{booking.totalAmount}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
