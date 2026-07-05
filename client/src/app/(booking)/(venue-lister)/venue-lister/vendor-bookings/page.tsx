"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { bookingApi } from "@/modules/booking/services/booking";
import { Booking } from "@/types";
import { formatDate, formatTime } from "@/utils/format";
import { toast } from "@/lib/toast";
import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import Link from "next/link";

export default function VenueBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checkInCode, setCheckInCode] = useState("");
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

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

  const handleCodeCheckIn = async () => {
    const normalizedCode = checkInCode.trim().toUpperCase();
    if (!normalizedCode) {
      setCheckInMessage("Please enter a check-in code.");
      return;
    }

    if (normalizedCode.length !== 8) {
      setCheckInMessage("Enter the full 8-character check-in code.");
      return;
    }

    try {
      setCheckInLoading(true);
      setCheckInMessage(null);

      const response = await bookingApi.checkInBookingByCode(normalizedCode);

      if (response.success && response.data) {
        setBookings((prev) =>
          prev.map((booking) =>
            booking.id === response.data?.id
              ? { ...booking, status: response.data.status }
              : booking,
          ),
        );
        setCheckInMessage("Check-in successful.");
        setCheckInCode("");
        return;
      }

      setCheckInMessage(response.message || "Unable to verify check-in code.");
    } catch (error: any) {
      setCheckInMessage(
        error?.response?.data?.message || "Unable to verify check-in code.",
      );
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleApproveBooking = async (bookingId: string) => {
    try {
      setApprovingId(bookingId);
      const response = await bookingApi.confirmBookingByProvider(bookingId);
      const confirmedStatus = response.data?.status;
      if (response.success && confirmedStatus) {
        setBookings((prev) =>
          prev.map((booking) =>
            booking.id === bookingId
              ? { ...booking, status: confirmedStatus }
              : booking,
          ),
        );
        toast.success("Booking confirmed.");
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Unable to confirm booking.",
      );
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    try {
      setRejectingId(bookingId);
      const response = await bookingApi.rejectBookingByProvider(
        bookingId,
        "Rejected by venue",
      );
      const rejectedBooking = response.data?.booking;
      if (response.success && rejectedBooking) {
        setBookings((prev) =>
          prev.map((booking) =>
            booking.id === bookingId
              ? { ...booking, status: rejectedBooking.status }
              : booking,
          ),
        );
        toast.success("Booking rejected.");
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Unable to reject booking.",
      );
    } finally {
      setRejectingId(null);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading bookings...</div>;
  }

  return (
    <div className="space-y-6">
      <PlayerPageHeader
        badge="Venue Lister"
        title="Bookings"
        subtitle="Review incoming bookings, track schedules, and monitor payment status."
        action={
          <div className="flex flex-wrap gap-3">
            <Link href="/venue-lister/inventory">
              <Button variant="secondary">Manage Inventory</Button>
            </Link>
            <Link href="/venue-lister">
              <Button variant="primary">Back to Dashboard</Button>
            </Link>
          </div>
        }
      />

      {bookings.length === 0 ? (
        <Card className="bg-white">
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-power-orange/10 px-4 py-2 text-sm font-semibold text-power-orange">
              No bookings yet
            </div>
            <p className="max-w-md text-slate-600">
              Bookings will appear here once players reserve your venues.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/venue-lister/inventory">
                <Button variant="secondary">Manage Inventory</Button>
              </Link>
              <Link href="/venue-lister">
                <Button variant="primary">Go to Dashboard</Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="bg-white">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900 mb-1">
                  Player Check-in
                </p>
                <p className="text-xs text-slate-500 mb-2">
                  Enter the player's 8-character code to verify arrival.
                </p>
                <input
                  type="text"
                  value={checkInCode}
                  maxLength={8}
                  onChange={(event) => {
                    const nextValue = event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 8);
                    setCheckInCode(nextValue);
                  }}
                  placeholder="Enter 8-character code"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm uppercase tracking-[0.35em] font-mono"
                  autoComplete="one-time-code"
                />
              </div>
              <Button
                variant="primary"
                onClick={handleCodeCheckIn}
                disabled={checkInLoading}
              >
                {checkInLoading ? "Verifying..." : "Verify Check-in"}
              </Button>
            </div>
            {checkInMessage && (
              <p className="mt-3 text-sm text-slate-700">{checkInMessage}</p>
            )}
          </Card>

          {bookings.map((booking) => (
            <Card
              key={booking.id}
              className="bg-white hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Booking Request
                    </h3>
                    <span
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        booking.status === "CONFIRMED" ||
                        booking.status === "IN_PROGRESS" ||
                        booking.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                          : booking.status === "PENDING_CONFIRMATION"
                            ? "bg-amber-100 text-amber-700 border border-amber-300"
                            : booking.status === "PENDING_INVITES"
                              ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
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
                        {formatTime(booking.startTime)} -{" "}
                        {formatTime(booking.endTime)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-600">Player Details</p>
                      <p className="font-semibold text-slate-900">
                        Privacy protected
                      </p>
                    </div>
                  </div>

                  {/* Payment Details */}
                  {booking.payments?.find(
                    (payment) => payment.userType === "VenueLister",
                  ) && (
                    <div className="bg-slate-50 rounded-lg p-4 mt-3 border border-slate-200">
                      <p className="text-sm font-semibold mb-2 text-slate-900">
                        Payment Details
                      </p>
                      {(() => {
                        const venuePayment = booking.payments?.find(
                          (payment) => payment.userType === "VenueLister",
                        );

                        if (!venuePayment) {
                          return null;
                        }

                        return (
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-slate-600">Venue Fee:</span>
                              <span className="font-semibold ml-2 text-slate-900">
                                ₹{venuePayment.amount}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-600">Status:</span>
                              <span
                                className={`ml-2 font-semibold ${
                                  venuePayment.status === "PAID"
                                    ? "text-emerald-700"
                                    : "text-yellow-700"
                                }`}
                              >
                                {venuePayment.status}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-power-orange">
                    ₹{booking.totalAmount}
                  </p>
                  {booking.status === "PENDING_CONFIRMATION" && (
                    <div className="mt-3 flex flex-col gap-2">
                      <Button
                        variant="primary"
                        onClick={() => handleApproveBooking(booking.id)}
                        disabled={approvingId === booking.id}
                      >
                        {approvingId === booking.id
                          ? "Confirming..."
                          : "Confirm booking"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleRejectBooking(booking.id)}
                        disabled={rejectingId === booking.id}
                      >
                        {rejectingId === booking.id ? "Rejecting..." : "Reject"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
