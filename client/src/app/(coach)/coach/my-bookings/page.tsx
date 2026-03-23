"use client";

import { bookingApi } from "@/modules/booking/services/booking";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Booking, Venue } from "@/types";
import { formatDate, formatTime } from "@/utils/format";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  IndianRupee,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  StaggerContainer,
  StaggerItem,
} from "@/modules/shared/ui/motion/StaggerContainer";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";

const PAGE_SIZE = 10;

const getStatusBadgeClass = (status: Booking["status"]) => {
  switch (status) {
    case "CONFIRMED":
      return "bg-green-100 text-green-700 border border-green-300";
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-700 border border-blue-300";
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-700 border border-emerald-300";
    case "NO_SHOW":
      return "bg-yellow-100 text-yellow-700 border border-yellow-300";
    default:
      return "bg-red-100 text-red-700 border border-red-300";
  }
};

const formatStatusLabel = (status: Booking["status"]) =>
  status.charAt(0).toUpperCase() +
  status.slice(1).toLowerCase().replace(/_/g, " ");

export default function CoachBookingsPage() {
  const [allCoachBookings, setAllCoachBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setIsLoading(true);
        const response = await bookingApi.getMyBookings();
        if (response.success && response.data) {
          const coachBookings = response.data.filter((b) => b.coachId);
          setAllCoachBookings(coachBookings);
        }
      } catch (error) {
        console.error("Failed to fetch bookings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookings();
  }, []);

  const totalPages = Math.max(
    1,
    Math.ceil(allCoachBookings.length / PAGE_SIZE),
  );

  const paginatedBookings = useMemo(
    () =>
      allCoachBookings.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [allCoachBookings, currentPage],
  );

  const stats = useMemo(() => {
    const confirmed = allCoachBookings.filter(
      (booking) => booking.status === "CONFIRMED",
    ).length;
    const completed = allCoachBookings.filter(
      (booking) => booking.status === "COMPLETED",
    ).length;
    const totalEarnings = allCoachBookings
      .filter((booking) =>
        ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(booking.status),
      )
      .reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);

    return {
      total: allCoachBookings.length,
      confirmed,
      completed,
      totalEarnings,
    };
  }, [allCoachBookings]);

  if (isLoading) {
    return <div className="text-center py-12">Loading bookings...</div>;
  }

  return (
    <div className="space-y-6">
      <PlayerPageHeader
        badge="Coach"
        title="My Bookings"
        subtitle="Track your sessions, upcoming slots, and earnings in one place."
        action={
          <Link href="/coach/profile">
            <Button variant="secondary">Go to Profile</Button>
          </Link>
        }
      />

      {allCoachBookings.length === 0 ? (
        <Card className="bg-white">
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-power-orange/10 px-4 py-2 text-sm font-semibold text-power-orange">
              No bookings yet
            </div>
            <p className="max-w-md text-slate-600">
              Player bookings for your sessions will appear here once they start
              booking with you.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <StaggerContainer className="grid gap-4 md:grid-cols-4">
            <StaggerItem className="h-full">
            <Card className="glass-panel premium-shadow hover:shadow-xl transition-all h-full">
              <p className="mb-1 text-sm text-slate-600 dark:text-slate-400">Total Bookings</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
            </Card>
            </StaggerItem>
            <StaggerItem className="h-full">
            <Card className="glass-panel premium-shadow hover:shadow-xl transition-all h-full">
              <p className="mb-1 text-sm text-slate-600 dark:text-slate-400">Confirmed</p>
              <p className="text-3xl font-bold text-green-600">
                {stats.confirmed}
              </p>
            </Card>
            </StaggerItem>
            <StaggerItem className="h-full">
            <Card className="glass-panel premium-shadow hover:shadow-xl transition-all h-full">
              <p className="mb-1 text-sm text-slate-600 dark:text-slate-400">Completed</p>
              <p className="text-3xl font-bold text-emerald-600">
                {stats.completed}
              </p>
            </Card>
            </StaggerItem>
            <StaggerItem className="h-full">
            <Card className="glass-panel premium-shadow hover:shadow-xl transition-all h-full">
              <p className="mb-1 text-sm text-slate-600 dark:text-slate-400">Tracked Earnings</p>
              <p className="text-3xl font-bold text-power-orange">
                ₹{stats.totalEarnings}
              </p>
            </Card>
            </StaggerItem>
          </StaggerContainer>

          <StaggerContainer className="space-y-4">
            {paginatedBookings.map((booking) => (
              <StaggerItem key={booking.id}>
              <Card
                className="glass-panel hover:shadow-lg transition-all"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Session #{booking.id.slice(-6)}
                      </h3>
                      <span
                        className={`inline-block rounded px-3 py-1 text-sm font-semibold ${getStatusBadgeClass(
                          booking.status,
                        )}`}
                      >
                        {formatStatusLabel(booking.status)}
                      </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-sm text-slate-600">
                          Date & Time
                        </p>
                        <p className="flex items-center gap-2 font-semibold text-slate-900">
                          <Calendar className="h-4 w-4 text-slate-500" />
                          {formatDate(booking.date)}
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                          <Clock className="h-4 w-4 text-slate-400" />
                          {formatTime(booking.startTime)} -{" "}
                          {formatTime(booking.endTime)}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-sm text-slate-600">Venue</p>
                        {typeof booking.venueId === "object" &&
                        booking.venueId !== null ? (
                          <>
                            <Link
                              href={`/venues/${(booking.venueId as Venue).id || (booking.venueId as Venue)._id}`}
                              className="inline-flex items-center gap-2 font-semibold text-slate-900 transition-colors hover:text-power-orange"
                            >
                              <MapPin className="h-4 w-4 text-slate-400" />
                              {(booking.venueId as Venue).name || "Venue"}
                            </Link>
                            {(booking.venueId as Venue).address && (
                              <p className="mt-1 text-sm text-slate-600">
                                {(booking.venueId as Venue).address}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="font-semibold text-slate-900">
                            Venue ID: {String(booking.venueId || "N/A")}
                          </p>
                        )}
                        {booking.sport && (
                          <p className="mt-1 text-sm text-slate-600">
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
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-2 text-sm font-semibold text-slate-900">
                        Session Value
                      </p>
                      <p className="flex items-center gap-1 text-2xl font-bold text-power-orange">
                        <IndianRupee className="h-5 w-5" />
                        {booking.totalAmount}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>

          {totalPages > 1 && (
            <SlideUp delay={0.2} yOffset={10}>
            <Card className="glass-panel">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages} • {allCoachBookings.length}{" "}
                  bookings
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1 || isLoading}
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={currentPage === totalPages || isLoading}
                    className="flex items-center gap-2"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
            </SlideUp>
          )}
        </div>
      )}
    </div>
  );
}
