"use client";

import { toast } from "@/lib/toast";
import { adminApi } from "@/modules/admin/services/admin";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { statsApi } from "@/modules/analytics/services/stats";
import { Card } from "@/modules/shared/ui/Card";
import { Booking } from "@/types";
import { formatDate, formatTime } from "@/utils/format";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

type BookingActionType = "REFUND" | "DISPUTE";
type BookingTabType = "ALL" | "VENUE" | "COACH";
const PAYMENT_ACTIONS_ENABLED = false;

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<BookingTabType>("ALL");
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<BookingActionType | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [refundType, setRefundType] = useState<
    "FULL" | "PARTIAL" | "VENUE_ONLY" | "COACH_ONLY"
  >("FULL");
  const [disputeType, setDisputeType] = useState<
    "NO_SHOW" | "POOR_QUALITY" | "PAYMENT_ISSUE" | "OTHER"
  >("OTHER");
  const [resolution, setResolution] = useState<
    "FULL_REFUND" | "PARTIAL_REFUND" | "NO_REFUND"
  >("NO_REFUND");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const PAGE_SIZE = 10;

  const getBookingId = (booking: Booking): string => {
    const fallback = booking as Booking & { _id?: string };
    return booking.id || fallback._id || "";
  };

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await statsApi.getAllBookings({
        page: currentPage,
        limit: PAGE_SIZE,
      });
      if (response.success && response.data) {
        setBookings(response.data);
        if (response.pagination) {
          setPagination(response.pagination);
        }
        return;
      }

      setError(response.message || "Failed to load bookings.");
    } catch (error) {
      console.error("Failed to load bookings:", error);
      setError("Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  const openAction = (booking: Booking, type: BookingActionType) => {
    if (!PAYMENT_ACTIONS_ENABLED) {
      toast.error("Refund and dispute actions are not available yet.");
      return;
    }

    const bookingId = getBookingId(booking);
    if (!bookingId) {
      toast.error("Booking ID not found.");
      return;
    }

    setActionBookingId(bookingId);
    setActionType(type);
    setReason("");
    setEvidence("");
    setRefundType("FULL");
    setDisputeType("OTHER");
    setResolution("NO_REFUND");
  };

  const closeAction = () => {
    setActionBookingId(null);
    setActionType(null);
    setReason("");
    setEvidence("");
  };

  const submitAction = async () => {
    if (!actionBookingId || !actionType) return;
    if (!reason.trim()) {
      toast.error("Reason is required.");
      return;
    }

    setActionLoading(true);
    try {
      if (actionType === "REFUND") {
        await adminApi.processRefund(actionBookingId, {
          refundType,
          reason: reason.trim(),
        });
        toast.success("Refund request submitted.");
      } else {
        await adminApi.handleDispute(actionBookingId, {
          disputeType,
          resolution,
          evidence: evidence.trim() || undefined,
        });
        toast.success("Dispute request submitted.");
      }

      closeAction();
      await loadBookings();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit booking action.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Filter bookings based on active tab
  const filteredBookings = bookings.filter((booking) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "COACH") return !!booking.coachId;
    if (activeTab === "VENUE") return !!booking.venueId && !booking.coachId;
    return true;
  });

  // Count bookings by type
  const bookingCounts = {
    all: bookings.length,
    coach: bookings.filter((b) => !!b.coachId).length,
    venue: bookings.filter((b) => !!b.venueId && !b.coachId).length,
  };

  if (loading) {
    return <div className="text-center py-12">Loading bookings...</div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Admin"
          title="All Bookings"
          subtitle="View and monitor all venue bookings across the platform."
        />
        <Card className="bg-white">
          <div className="py-10 text-center space-y-3">
            <p className="text-red-600 font-semibold">{error}</p>
            <button
              onClick={loadBookings}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="All Bookings"
        subtitle="View and monitor all bookings across the platform."
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab("ALL");
            setCurrentPage(1);
          }}
          className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === "ALL"
              ? "border-power-orange text-power-orange"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          All Bookings
          <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-xs">
            {bookingCounts.all}
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab("VENUE");
            setCurrentPage(1);
          }}
          className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === "VENUE"
              ? "border-power-orange text-power-orange"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Venue Bookings
          <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-xs">
            {bookingCounts.venue}
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab("COACH");
            setCurrentPage(1);
          }}
          className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === "COACH"
              ? "border-power-orange text-power-orange"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Coach Bookings
          <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-xs">
            {bookingCounts.coach}
          </span>
        </button>
      </div>

      {filteredBookings.length === 0 ? (
        <Card className="bg-white">
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-power-orange/10 px-4 py-2 text-sm font-semibold text-power-orange">
              {activeTab === "ALL"
                ? "No bookings yet"
                : activeTab === "VENUE"
                  ? "No venue bookings"
                  : "No coach bookings"}
            </div>
            <p className="max-w-md text-slate-600">
              {activeTab === "ALL"
                ? "Bookings will appear here once players start booking."
                : activeTab === "VENUE"
                  ? "Venue bookings will appear here once players book venues."
                  : "Coach bookings will appear here once players book coaches."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {!PAYMENT_ACTIONS_ENABLED && (
            <Card className="bg-white">
              <p className="text-sm text-slate-700">
                Refund and dispute processing will be enabled after payment
                gateway integration.
              </p>
            </Card>
          )}

          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <Card
                key={getBookingId(booking) || booking.id}
                className="bg-white hover:shadow-lg transition-shadow"
              >
                {(() => {
                  const isCoachBooking = !!booking.coachId;
                  const venueName =
                    booking.venueName ||
                    (typeof booking.venueId === "object"
                      ? booking.venueId?.name
                      : undefined) ||
                    "Unknown venue";
                  const populatedCoach = booking.coach as
                    | { userId?: string | { name?: string } }
                    | undefined;
                  const coachName =
                    typeof booking.coachId === "object"
                      ? (booking.coachId as any)?.name || "Unknown coach"
                      : typeof populatedCoach?.userId === "object"
                        ? populatedCoach.userId?.name || "Unknown coach"
                        : "Unknown coach";
                  const playerName = booking.playerName || "Unknown player";

                  return (
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold text-slate-900">
                            Booking #{booking.id.slice(-6)}
                          </h3>
                          <span
                            className={`px-3 py-1 rounded text-sm font-semibold ${
                              booking.status === "CONFIRMED"
                                ? "bg-green-100 text-green-700 border border-green-300"
                                : booking.status === "CANCELLED"
                                  ? "bg-red-100 text-red-700 border border-red-300"
                                  : "bg-yellow-100 text-yellow-700 border border-yellow-300"
                            }`}
                          >
                            {booking.status}
                          </span>
                          <span
                            className={`px-3 py-1 rounded text-xs font-semibold ${
                              isCoachBooking
                                ? "bg-blue-100 text-blue-700 border border-blue-300"
                                : "bg-purple-100 text-purple-700 border border-purple-300"
                            }`}
                          >
                            {isCoachBooking ? "COACH" : "VENUE"}
                          </span>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-slate-600">
                              Date & Time
                            </p>
                            <p className="font-semibold text-slate-900">
                              {formatDate(booking.date)}
                            </p>
                            <p className="text-sm text-slate-900">
                              {formatTime(booking.startTime)} -{" "}
                              {formatTime(booking.endTime)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600">
                              {isCoachBooking ? "Coach" : "Venue"}
                            </p>
                            <p className="font-semibold text-slate-900">
                              {isCoachBooking ? coachName : venueName}
                            </p>
                            {booking.sport && (
                              <p className="text-sm text-slate-600">
                                {booking.sport}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-slate-600">Player</p>
                            <p className="font-semibold text-slate-900">
                              {playerName}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-2xl font-bold text-power-orange">
                          ₹{booking.totalAmount}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 md:flex md:flex-col">
                          <button
                            onClick={() => openAction(booking, "REFUND")}
                            disabled={!PAYMENT_ACTIONS_ENABLED}
                            className="rounded-lg border border-orange-300 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Refund
                          </button>
                          <button
                            onClick={() => openAction(booking, "DISPUTE")}
                            disabled={!PAYMENT_ACTIONS_ENABLED}
                            className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Dispute
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {actionBookingId === getBookingId(booking) && actionType && (
                  <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
                    <p className="text-sm font-semibold text-slate-800">
                      {actionType === "REFUND"
                        ? "Process refund"
                        : "Handle dispute"}
                    </p>

                    {actionType === "REFUND" ? (
                      <select
                        value={refundType}
                        onChange={(event) =>
                          setRefundType(
                            event.target.value as
                              | "FULL"
                              | "PARTIAL"
                              | "VENUE_ONLY"
                              | "COACH_ONLY",
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="FULL">FULL</option>
                        <option value="PARTIAL">PARTIAL</option>
                        <option value="VENUE_ONLY">VENUE_ONLY</option>
                        <option value="COACH_ONLY">COACH_ONLY</option>
                      </select>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        <select
                          value={disputeType}
                          onChange={(event) =>
                            setDisputeType(
                              event.target.value as
                                | "NO_SHOW"
                                | "POOR_QUALITY"
                                | "PAYMENT_ISSUE"
                                | "OTHER",
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        >
                          <option value="NO_SHOW">NO_SHOW</option>
                          <option value="POOR_QUALITY">POOR_QUALITY</option>
                          <option value="PAYMENT_ISSUE">PAYMENT_ISSUE</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                        <select
                          value={resolution}
                          onChange={(event) =>
                            setResolution(
                              event.target.value as
                                | "FULL_REFUND"
                                | "PARTIAL_REFUND"
                                | "NO_REFUND",
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        >
                          <option value="FULL_REFUND">FULL_REFUND</option>
                          <option value="PARTIAL_REFUND">PARTIAL_REFUND</option>
                          <option value="NO_REFUND">NO_REFUND</option>
                        </select>
                      </div>
                    )}

                    <textarea
                      rows={3}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Reason"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />

                    {actionType === "DISPUTE" && (
                      <textarea
                        rows={3}
                        value={evidence}
                        onChange={(event) => setEvidence(event.target.value)}
                        placeholder="Evidence / details (optional)"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={submitAction}
                        disabled={actionLoading || !reason.trim()}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? "Submitting..." : "Submit"}
                      </button>
                      <button
                        onClick={closeAction}
                        disabled={actionLoading}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-sm text-slate-600 sm:text-left">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                {Math.min(currentPage * PAGE_SIZE, pagination.total)} of{" "}
                {pagination.total} bookings
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>

                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .slice(
                    Math.max(0, currentPage - 2),
                    Math.min(pagination.totalPages, currentPage + 1),
                  )
                  .map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded font-medium transition-colors ${
                        currentPage === page
                          ? "bg-power-orange text-white"
                          : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                <button
                  onClick={() =>
                    setCurrentPage(
                      Math.min(pagination.totalPages, currentPage + 1),
                    )
                  }
                  disabled={currentPage === pagination.totalPages}
                  className="p-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
