"use client";

import { bookingApi } from "@/modules/booking/services/booking";
import { Card } from "@/modules/shared/ui/Card";
import { Booking, Venue } from "@/types";
import { formatDate, formatTime } from "@/utils/format";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function CoachBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    totalEarnings: 0,
  });

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setIsLoading(true);
        // Fetch all bookings without pagination from server
        const response = await bookingApi.getMyBookings();
        if (response.success && response.data) {
          // Filter for coach bookings only
          const coachBookings = response.data.filter((b) => b.coachId);

          // Calculate total pages based on ALL coach bookings
          setTotalPages(Math.ceil(coachBookings.length / pageSize));

          // Calculate stats from all coach bookings
          const confirmed = coachBookings.filter(
            (b) => b.status === "CONFIRMED",
          ).length;

          setStats({
            total: coachBookings.length,
            confirmed,
            totalEarnings: 0, // Payment data not available in Booking type
          });

          // Store all bookings for client-side pagination
          setBookings(coachBookings);
        }
      } catch (error) {
        console.error("Failed to fetch bookings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookings();
  }, [pageSize]);

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
        <>
          <div className="space-y-4">
            {bookings
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((booking) => (
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
                              : booking.status === "IN_PROGRESS"
                                ? "bg-blue-100 text-blue-700 border border-blue-300"
                                : booking.status === "COMPLETED"
                                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                  : booking.status === "NO_SHOW"
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
                            {formatTime(booking.startTime)} -{" "}
                            {formatTime(booking.endTime)}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-slate-600 mb-1">Venue</p>
                          {typeof booking.venueId === "object" &&
                          booking.venueId !== null ? (
                            <>
                              <Link
                                href={`/venues/${(booking.venueId as Venue).id}`}
                                className="font-semibold text-slate-900 hover:text-power-orange transition-colors"
                              >
                                {(booking.venueId as Venue).name || "Venue"}
                              </Link>
                              {(booking.venueId as Venue).address && (
                                <p className="text-sm text-slate-600 mt-1">
                                  {(booking.venueId as Venue).address}
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

                      {/* Session Details */}
                      <div className="bg-slate-50 rounded-lg p-4 mt-3 border border-slate-200">
                        <p className="text-sm font-semibold mb-2 text-slate-900">
                          Total Amount
                        </p>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-2xl font-bold text-power-orange">
                              ₹{booking.totalAmount}
                            </span>
                          </div>
                          {booking.status === "CONFIRMED" && (
                            <div>
                              <span className="px-3 py-1 rounded text-sm font-semibold bg-green-100 text-green-700 border border-green-300">
                                Confirmed
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 px-4 py-3 bg-white rounded-lg border border-slate-200">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">
                  Page{" "}
                  <span className="font-semibold text-slate-900">
                    {currentPage}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-900">
                    {totalPages}
                  </span>
                </span>
              </div>

              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
