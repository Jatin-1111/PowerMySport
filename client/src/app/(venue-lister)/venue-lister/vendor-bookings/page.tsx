"use client";

import { Card } from "@/modules/shared/ui/Card";
import { bookingApi } from "@/modules/booking/services/booking";
import { Booking } from "@/types";
import { formatDate, formatTime } from "@/utils/format";
import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

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
      <h1 className="text-3xl font-bold mb-6 text-slate-900">Venue Bookings</h1>

      {bookings.length === 0 ? (
        <Card className="text-center bg-white">
          <p className="text-slate-600 mb-4">No bookings yet</p>
          <p className="text-sm text-slate-600">
            Bookings will appear here once players book your venues
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <Card
              key={booking.id}
              className="bg-white hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Booking #{booking.id.slice(-6)}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        booking.status === "CONFIRMED" ||
                        booking.status === "IN_PROGRESS" ||
                        booking.status === "COMPLETED"
                          ? "bg-green-100 text-green-700 border border-green-300"
                          : booking.status === "PENDING_PAYMENT"
                            ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                            : "bg-red-100 text-red-700 border border-red-300"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-sm text-slate-600">Date & Time</p>
                      <p className="font-semibold text-slate-900 flex items-center gap-1">
                        <Calendar size={16} />
                        {formatDate(booking.date)}
                      </p>
                      <p className="text-sm text-slate-900">
                        ? {formatTime(booking.startTime)} -{" "}
                        {formatTime(booking.endTime)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-600">Player Details</p>
                      <p className="font-semibold text-slate-900">
                        User ID: {booking.userId}
                      </p>
                    </div>
                  </div>

                  {/* Payment Details */}
                  {booking.venuePayment && (
                    <div className="bg-slate-50 rounded-lg p-4 mt-3 border border-slate-200">
                      <p className="text-sm font-semibold mb-2 text-slate-900">
                        Payment Details
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-600">Venue Fee:</span>
                          <span className="font-semibold ml-2 text-slate-900">
                            ?{booking.venuePayment.amount}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">Status:</span>
                          <span
                            className={`ml-2 font-semibold ${
                              booking.venuePayment.status === "COMPLETED"
                                ? "text-green-700"
                                : "text-yellow-700"
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
                    ?{booking.totalAmount}
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
