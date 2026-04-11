"use client";

import { bookingApi } from "@/modules/booking/services/booking";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { ConfirmDialog } from "@/modules/shared/ui/ConfirmDialog";
import { ListSkeleton } from "@/modules/shared/ui/Skeleton";
import { Booking, Coach, Venue } from "@/types";
import { formatDate, formatTime } from "@/utils/format";
import {
  Calendar,
  Clock,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Award,
  CalendarX,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";

interface PaginationInfo {
  total: number;
  page: number;
  totalPages: number;
}

type TabType = "venues" | "coaches";

export default function BookingsPage() {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    totalPages: 0,
  });
  const [itemsPerPage] = useState(10);
  const [activeTab, setActiveTab] = useState<TabType>("venues");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCoveringPaymentId, setIsCoveringPaymentId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setIsLoading(true);
        const response = await bookingApi.getMyBookings({
          page: currentPage,
          limit: itemsPerPage,
        });
        if (response.success && response.data) {
          setBookings(response.data);
          if (response.pagination) {
            setPagination(response.pagination);
          }
        }
      } catch (error) {
        console.error("Failed to fetch bookings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookings();
  }, [currentPage, itemsPerPage]);

  const handleCancelClick = (bookingId: string) => {
    setBookingToCancel(bookingId);
    setConfirmDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!bookingToCancel) return;

    try {
      setIsCancelling(true);
      await bookingApi.cancelBooking(bookingToCancel);
      setBookings(bookings.filter((b) => b.id !== bookingToCancel));
      toast.success("Booking cancelled successfully");
      setConfirmDialogOpen(false);
      setBookingToCancel(null);
    } catch (error) {
      console.error("Failed to cancel booking:", error);
      toast.error("Failed to cancel booking. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCoverPayments = async (bookingId: string) => {
    try {
      setIsCoveringPaymentId(bookingId);
      const response = await bookingApi.coverUnpaidShares(bookingId);
      if (response.success) {
        toast.success("Unpaid shares covered successfully");
        if (response.data) {
          setBookings((prev) =>
            prev.map((b) =>
              b.id === bookingId ? { ...b, ...response.data } : b,
            ),
          );
        }
      }
    } catch {
      toast.error("Failed to cover unpaid payments. Please try again.");
    } finally {
      setIsCoveringPaymentId(null);
    }
  };

  // Filter bookings by type
  const venueBookings = bookings.filter((b) => b.venueId && !b.coachId);
  const coachBookings = bookings.filter((b) => b.coachId);
  const filteredBookings =
    activeTab === "venues" ? venueBookings : coachBookings;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "My Bookings" },
          ]}
        />

        <PlayerPageHeader
          badge="Player"
          title="My Bookings"
          subtitle="Keep track of your upcoming sessions, payments, and history in one place."
        />
        <ListSkeleton count={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My Bookings" },
        ]}
      />

      <PlayerPageHeader
        badge="Player"
        title="My Bookings"
        subtitle="Keep track of your upcoming sessions, payments, and history in one place."
        action={
          <div className="flex flex-wrap gap-3">
            <Link href="/venues">
              <Button variant="secondary">Browse Venues</Button>
            </Link>
            <Link href="/coaches">
              <Button variant="primary">Find a Coach</Button>
            </Link>
          </div>
        }
      />

      {bookings.length === 0 ? (
        <Card className="shop-surface premium-shadow">
          <EmptyState
            icon={CalendarX}
            title="No bookings yet"
            description="Explore venues or connect with a coach to schedule your first session."
            actionLabel="Browse Venues"
            onAction={() => (window.location.href = "/venues")}
            secondaryActionLabel="Find a Coach"
            onSecondaryAction={() => (window.location.href = "/coaches")}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Tabs */}
          <Card className="shop-surface premium-shadow">
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => {
                  setActiveTab("venues");
                  setCurrentPage(1);
                }}
                className={`flex-1 px-6 py-4 font-semibold text-center transition-colors border-b-2 ${
                  activeTab === "venues"
                    ? "border-power-orange text-power-orange"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <MapPin className="h-5 w-5" />
                  <span>Venue Bookings</span>
                  <span className="ml-2 bg-slate-100 text-slate-700 text-xs rounded-full px-2 py-1 font-medium">
                    {venueBookings.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => {
                  setActiveTab("coaches");
                  setCurrentPage(1);
                }}
                className={`flex-1 px-6 py-4 font-semibold text-center transition-colors border-b-2 ${
                  activeTab === "coaches"
                    ? "border-power-orange text-power-orange"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Award className="h-5 w-5" />
                  <span>Coach Bookings</span>
                  <span className="ml-2 bg-slate-100 text-slate-700 text-xs rounded-full px-2 py-1 font-medium">
                    {coachBookings.length}
                  </span>
                </div>
              </button>
            </div>
          </Card>

          {/* Bookings List */}
          {filteredBookings.length === 0 ? (
            <Card className="shop-surface premium-shadow">
              <EmptyState
                icon={activeTab === "venues" ? MapPin : Award}
                title={`No ${activeTab} bookings`}
                description={
                  activeTab === "venues"
                    ? "You haven't booked any venues yet."
                    : "You haven't booked any coaches yet."
                }
                actionLabel={
                  activeTab === "venues" ? "Browse Venues" : "Find a Coach"
                }
                onAction={() =>
                  (window.location.href =
                    activeTab === "venues" ? "/venues" : "/coaches")
                }
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking) => (
                <Card
                  key={booking.id}
                  className="shop-surface premium-shadow hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      {/* Venue Booking */}
                      {activeTab === "venues" &&
                      typeof booking.venueId === "object" &&
                      booking.venueId !== null ? (
                        <>
                          <Link
                            href={`/venues/${(booking.venueId as any)._id || (booking.venueId as any).id}`}
                            className="text-lg font-semibold mb-2 text-slate-900 hover:text-power-orange transition-colors inline-block"
                          >
                            {(booking.venueId as any).name || "Venue"}
                          </Link>
                          {(booking.venueId as any).address && (
                            <p className="text-sm text-slate-500 flex items-center gap-2 mb-2">
                              <MapPin className="h-4 w-4 text-slate-400" />
                              {(booking.venueId as any).address}
                            </p>
                          )}
                        </>
                      ) : activeTab === "venues" ? (
                        <h3 className="text-lg font-semibold mb-2 text-slate-900">
                          Venue ID:{" "}
                          {typeof booking.venueId === "string"
                            ? booking.venueId
                            : "N/A"}
                        </h3>
                      ) : null}

                      {/* Coach Booking */}
                      {activeTab === "coaches" && booking.coach ? (
                        <>
                          <div className="text-lg font-semibold mb-2 text-slate-900 flex items-center gap-2">
                            <Award className="h-5 w-5 text-power-orange" />
                            {booking.coach.sports?.[0] || "Coach"} Coach
                          </div>
                          <p className="text-sm text-slate-600 mb-2">
                            Service Mode:{" "}
                            <span className="font-medium">
                              {booking.coach.serviceMode === "FREELANCE"
                                ? "Freelance"
                                : booking.coach.serviceMode === "OWN_VENUE"
                                  ? "Own Venue"
                                  : "Hybrid"}
                            </span>
                          </p>
                        </>
                      ) : null}

                      {/* Common Details */}
                      <p className="text-slate-600 flex flex-wrap items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>{formatDate(booking.date)}</span>
                        <span className="text-slate-300">|</span>
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span>
                          {formatTime(booking.startTime)} -{" "}
                          {formatTime(booking.endTime)}
                        </span>
                      </p>

                      {booking.sport && (
                        <p className="text-sm text-slate-600 mt-2">
                          Sport:{" "}
                          <span className="font-medium">{booking.sport}</span>
                        </p>
                      )}

                      {booking.participantName && (
                        <p className="text-sm text-slate-600 mt-1">
                          Participant:{" "}
                          <span className="font-medium">
                            {booking.participantName}
                          </span>
                        </p>
                      )}

                      {booking.status === "CONFIRMED" &&
                        booking.checkInCode && (
                          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                              Check-in Code
                            </span>
                            <span className="font-mono text-sm font-bold text-emerald-900">
                              {booking.checkInCode}
                            </span>
                          </div>
                        )}

                      <p className="text-slate-900 font-semibold mt-3 flex items-center gap-1">
                        <IndianRupee className="h-4 w-4 text-slate-700" />
                        <span>{booking.totalAmount}</span>
                      </p>

                      <span
                        className={`inline-block mt-2 px-3 py-1 rounded text-sm font-semibold ${
                          booking.status === "CONFIRMED"
                            ? "bg-green-100 text-green-700 border border-green-300"
                            : booking.status === "IN_PROGRESS"
                              ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                              : "bg-red-100 text-red-700 border border-red-300"
                        }`}
                      >
                        {booking.status.charAt(0).toUpperCase() +
                          booking.status
                            .slice(1)
                            .toLowerCase()
                            .replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {booking.status === "CONFIRMED" &&
                        booking.paymentType === "SPLIT" &&
                        booking.organizerId === user?.id && (
                          <Button
                            onClick={() => handleCoverPayments(booking.id)}
                            variant="secondary"
                            disabled={isCoveringPaymentId === booking.id}
                            className="flex items-center gap-2"
                          >
                            <CreditCard className="h-4 w-4" />
                            {isCoveringPaymentId === booking.id
                              ? "Processing..."
                              : "Cover Unpaid"}
                          </Button>
                        )}
                      {booking.status === "CONFIRMED" && (
                        <Button
                          onClick={() => handleCancelClick(booking.id)}
                          variant="danger"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && filteredBookings.length > 0 && (
            <Card className="shop-surface premium-shadow">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-slate-600">
                  Page {currentPage} of {pagination.totalPages} •{" "}
                  {filteredBookings.length} {activeTab} bookings
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || isLoading}
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setCurrentPage((p) =>
                        Math.min(pagination.totalPages, p + 1),
                      )
                    }
                    disabled={
                      currentPage === pagination.totalPages || isLoading
                    }
                    className="flex items-center gap-2"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={handleCancelConfirm}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmLabel="Yes, Cancel Booking"
        cancelLabel="Keep Booking"
        variant="danger"
        loading={isCancelling}
      />
    </div>
  );
}
