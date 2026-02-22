"use client";

import { bookingApi } from "@/modules/booking/services/booking";
import { Card } from "@/modules/shared/ui/Card";
import { Booking } from "@/types";
import { formatDate, formatTime } from "@/utils/format";
import { Calendar } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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
            .filter((b) =>
              b.payments?.some(
                (p) => p.userType === "COACH" && p.status === "PAID",
              ),
            )
            .reduce((sum, b) => {
              const coachPayment = b.payments?.find(
                (p) => p.userType === "COACH",
              );
              return sum + (coachPayment?.amount || 0);
            }, 0);

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
      <h1 className="text-3xl font-bold mb-6 text-slate-900">My Bookings</h1>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white">
          <p className="text-sm text-slate-600 mb-1">Total Bookings</p>
          <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
        </Card>
        <Card className="bg-white">
          <p className="text-sm text-slate-600 mb-1">Confirmed</p>
          <p className="text-3xl font-bold text-green-600">{stats.confirmed}</p>
        </Card>
        <Card className="bg-white">
          <p className="text-sm text-slate-600 mb-1">Total Earnings</p>
          <p className="text-3xl font-bold text-power-orange">
            ₹{stats.totalEarnings}
          </p>
        </Card>
      </div>

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <Card className="text-center bg-white">
          <p className="text-slate-600 mb-4">No bookings yet</p>
          <p className="text-sm text-slate-500">
            Bookings will appear here once players book sessions with you
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
                      Session #{booking.id.slice(-6)}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        booking.status === "CONFIRMED"
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
                      <p className="text-sm text-slate-700">
                        ? {formatTime(booking.startTime)} -{" "}
                        {formatTime(booking.endTime)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-600 mb-1">Venue</p>
                      {typeof booking.venueId === "object" &&
                      booking.venueId !== null ? (
                        <>
                          <Link
                            href={`/venues/${(booking.venueId as any)._id || (booking.venueId as any).id}`}
                            className="font-semibold text-slate-900 hover:text-power-orange transition-colors"
                          >
                            {(booking.venueId as any).name || "Venue"}
                          </Link>
                          {(booking.venueId as any).address && (
                            <p className="text-sm text-slate-600 mt-1">
                              {(booking.venueId as any).address}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="font-semibold text-slate-900">
                          Venue ID: {booking.venueId}
                        </p>
                      )}
                      {booking.sport && (
                        <p className="text-sm text-slate-600 mt-1">
                          Sport: {booking.sport}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Payment Details */}
                  {(() => {
                    const coachPayment = booking.payments?.find(
                      (p) => p.userType === "COACH",
                    );
                    return coachPayment ? (
                      <div className="bg-slate-50 rounded-lg p-4 mt-3 border border-slate-200">
                        <p className="text-sm font-semibold mb-2 text-slate-900">
                          Your Earnings
                        </p>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-2xl font-bold text-power-orange">
                              ₹{coachPayment.amount}
                            </span>
                          </div>
                          <div>
                            <span
                              className={`px-3 py-1 rounded text-sm font-semibold ${
                                coachPayment.status === "PAID"
                                  ? "bg-green-100 text-green-700 border border-green-300"
                                  : "bg-yellow-100 text-yellow-700 border border-yellow-300"
                              }`}
                            >
                              {coachPayment.status === "PAID"
                                ? "Paid"
                                : "Pending"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
