"use client";

import { bookingApi } from "@/modules/booking/services/booking";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { ConfirmDialog } from "@/modules/shared/ui/ConfirmDialog";
import { ListSkeleton } from "@/modules/shared/ui/Skeleton";
import { Badge } from "@/components/ui/badge";
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
  FileText,
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
const canViewInvoice = (status: Booking["status"]): boolean => {
  return ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"].includes(status);
};

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING_CONFIRMATION: "bg-amber-50 text-amber-700 border-amber-200",
  PENDING_INVITES: "bg-blue-50 text-blue-700 border-blue-200",
  IN_PROGRESS: "bg-yellow-50 text-yellow-700 border-yellow-200",
  COMPLETED: "bg-slate-50 text-slate-600 border-slate-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  NO_SHOW: "bg-red-50 text-red-700 border-red-200",
};

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] || "bg-slate-50 text-slate-700 border-slate-200";
}

function formatBookingStatus(status: string) {
  return status
    .charAt(0)
    .toUpperCase()
    .concat(status.slice(1).toLowerCase().replace(/_/g, " "));
}

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

  // Stats
  const confirmedCount = bookings.filter((b) => b.status === "CONFIRMED").length;
  const upcomingCount = bookings.filter(
    (b) => new Date(b.date) >= new Date(),
  ).length;

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

      {/* Stats strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {bookings.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Upcoming
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {upcomingCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Confirmed
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {confirmedCount}
          </p>
        </div>
      </div>

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
          <Card className="shop-surface premium-shadow overflow-hidden p-0">
            <div className="flex flex-col border-b border-slate-200/60 sm:flex-row">
              <button
                onClick={() => {
                  setActiveTab("venues");
                  setCurrentPage(1);
                }}
                className={`flex-1 border-b-2 px-3 py-4 font-semibold transition-colors sm:px-6 ${
                  activeTab === "venues"
                    ? "border-power-orange bg-orange-50/50 text-power-orange"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${activeTab === "venues" ? "bg-power-orange text-white" : "bg-slate-100 text-slate-500"}`}>
                    <MapPin className="h-4 w-4" />
                  </div>
                  <span className="text-sm sm:text-base">Venue Bookings</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${activeTab === "venues" ? "bg-power-orange/10 text-power-orange" : "bg-slate-100 text-slate-600"}`}>
                    {venueBookings.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => {
                  setActiveTab("coaches");
                  setCurrentPage(1);
                }}
                className={`flex-1 border-b-2 px-3 py-4 font-semibold transition-colors sm:border-b-2 sm:border-l sm:px-6 ${
                  activeTab === "coaches"
                    ? "border-power-orange bg-orange-50/50 text-power-orange"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${activeTab === "coaches" ? "bg-power-orange text-white" : "bg-slate-100 text-slate-500"}`}>
                    <Award className="h-4 w-4" />
                  </div>
                  <span className="text-sm sm:text-base">Coach Bookings</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${activeTab === "coaches" ? "bg-power-orange/10 text-power-orange" : "bg-purple-100/70 text-purple-700"}`}>
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
                  className="shop-surface premium-shadow overflow-hidden p-0 transition-all duration-200 hover:shadow-md"
                >
                  {/* Colored left stripe based on status */}
                  <div className="flex">
                    <div
                      className={`w-1 shrink-0 ${
                        booking.status === "CONFIRMED"
                          ? "bg-emerald-400"
                          : booking.status === "PENDING_CONFIRMATION" ||
                              booking.status === "PENDING_INVITES"
                            ? "bg-amber-400"
                            : booking.status === "IN_PROGRESS"
                              ? "bg-yellow-400"
                              : "bg-slate-300"
                      }`}
                    />
                    <div className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                      <div className="flex-1">
                        {/* Venue Booking */}
                        {activeTab === "venues" &&
                        typeof booking.venueId === "object" &&
                        booking.venueId !== null ? (
                          <>
                            <Link
                              href={`/venues/${(booking.venueId as any)._id || (booking.venueId as any).id}`}
                              className="mb-1 inline-flex items-center gap-2 text-base font-bold text-slate-900 hover:text-power-orange transition-colors"
                            >
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
                                <MapPin className="h-4 w-4 text-blue-600" />
                              </div>
                              {(booking.venueId as any).name || "Venue"}
                            </Link>
                            {(booking.venueId as any).address && (
                              <p className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                {(booking.venueId as any).address}
                              </p>
                            )}
                          </>
                        ) : activeTab === "venues" ? (
                          <div className="mb-2">
                            <h3 className="text-base font-bold text-slate-900">
                              Venue details pending
                            </h3>
                            <p className="text-sm text-slate-500">
                              We'll show the full location once the venue
                              details are resolved.
                            </p>
                          </div>
                        ) : null}

                        {/* Coach Booking */}
                        {activeTab === "coaches" && booking.coach ? (
                          <>
                            <div className="mb-1 inline-flex items-center gap-2 text-base font-bold text-slate-900">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100">
                                <Award className="h-4 w-4 text-purple-600" />
                              </div>
                              {booking.coach.sports?.[0] || "Coach"} Coach
                            </div>
                            <p className="mb-2 text-sm text-slate-500">
                              Service:{" "}
                              <span className="font-medium text-slate-700">
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
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {formatDate(booking.date)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {formatTime(booking.startTime)} –{" "}
                            {formatTime(booking.endTime)}
                          </span>
                        </div>

                        {booking.sport && (
                          <p className="mt-2 text-sm text-slate-600">
                            Sport:{" "}
                            <span className="font-medium">{booking.sport}</span>
                          </p>
                        )}

                        {booking.participantName && (
                          <p className="mt-1 text-sm text-slate-600">
                            Participant:{" "}
                            <span className="font-medium">
                              {booking.participantName}
                            </span>
                          </p>
                        )}

                        {booking.status === "CONFIRMED" &&
                          booking.checkInCode && (
                            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                Check-in Code
                              </span>
                              <span className="font-mono text-sm font-bold text-emerald-900">
                                {booking.checkInCode}
                              </span>
                            </div>
                          )}

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                            <IndianRupee className="h-4 w-4 text-slate-600" />
                            {booking.totalAmount}
                          </span>
                          <Badge
                            className={`border text-xs font-semibold ${getStatusStyle(booking.status)}`}
                          >
                            {formatBookingStatus(booking.status)}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:w-auto">
                        {canViewInvoice(booking.status) && (
                          <Link
                            href={`/dashboard/my-bookings/${booking.id}/invoice`}
                          >
                            <Button variant="secondary" size="sm" icon={<FileText size={14} />}>
                              Invoice
                            </Button>
                          </Link>
                        )}
                        {booking.status === "CONFIRMED" &&
                          booking.paymentType === "SPLIT" &&
                          booking.organizerId === user?.id && (
                            <Button
                              onClick={() => handleCoverPayments(booking.id)}
                              variant="secondary"
                              size="sm"
                              disabled={isCoveringPaymentId === booking.id}
                              icon={<CreditCard size={14} />}
                            >
                              {isCoveringPaymentId === booking.id
                                ? "Processing..."
                                : "Cover Unpaid"}
                            </Button>
                          )}
                        {(booking.status === "CONFIRMED" ||
                          booking.status === "PENDING_CONFIRMATION" ||
                          booking.status === "PENDING_INVITES") && (
                          <Button
                            onClick={() => handleCancelClick(booking.id)}
                            variant="danger"
                            size="sm"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
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
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || isLoading}
                    icon={<ChevronLeft className="h-4 w-4" />}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) =>
                        Math.min(pagination.totalPages, p + 1),
                      )
                    }
                    disabled={
                      currentPage === pagination.totalPages || isLoading
                    }
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
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
