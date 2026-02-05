"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { bookingApi } from "@/lib/booking";
import { Booking } from "@/types";
import { formatDate, formatTime } from "@/utils/format";
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
    <div>
      <h1 className="text-3xl font-bold mb-6 text-slate-900">My Bookings</h1>

      {bookings.length === 0 ? (
        <Card className="text-center bg-white">
          <p className="text-slate-600 mb-4">No bookings yet</p>
          <a
            href="/dashboard/search"
            className="text-power-orange font-semibold hover:text-orange-600 transition-colors"
          >
            Search venues to book
          </a>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <Card
              key={booking.id}
              className="bg-white hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-slate-900">
                    Venue ID: {booking.venueId}
                  </h3>
                  <p className="text-slate-600">
                    📅 {formatDate(booking.date)} • ⏰{" "}
                    {formatTime(booking.startTime)} -{" "}
                    {formatTime(booking.endTime)}
                  </p>
                  <p className="text-slate-900 font-semibold mt-2">
                    💰 ₹{booking.totalAmount}
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
