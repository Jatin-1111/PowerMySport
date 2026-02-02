"use client";

import React, { useEffect, useState } from "react";
import { Booking } from "@/types";
import { bookingApi } from "@/lib/booking";
import { formatDate, formatTime } from "@/utils/format";

export default function VendorBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would fetch venue bookings
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return <div className="text-center py-12">Loading bookings...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Venue Bookings</h1>

      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-600">No bookings yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="bg-white rounded-lg p-6 shadow">
              <h3 className="text-lg font-semibold mb-2">
                Booking #{booking.id}
              </h3>
              <p className="text-gray-600">
                📅 {formatDate(booking.date)} • ⏰{" "}
                {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
              </p>
              <p className="text-gray-600 mt-2">💰 ₹{booking.totalAmount}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
