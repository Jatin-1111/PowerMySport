"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  UserPlus,
  Mail,
  MapPin,
  Users,
  TrendingUp,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { bookingApi } from "@/modules/booking/services/booking";
import { friendService } from "@/modules/shared/services/friend";
import type { Booking } from "@/types";

interface UpcomingBooking {
  id: string;
  venueName?: string;
  coachName?: string;
  sport?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>(
    [],
  );
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  const [pendingInvitations, setPendingInvitations] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [bookingsResult, friendCountResult, invitationCountResult] =
        await Promise.allSettled([
          bookingApi.getMyBookings({ page: 1, limit: 3 }),
          friendService.getPendingRequestsCount(),
          bookingApi.getPendingInvitationsCount(),
        ]);

      if (bookingsResult.status === "fulfilled") {
        const payload = bookingsResult.value;
        const bookings = Array.isArray(payload.data)
          ? payload.data
          : ((payload.data as { bookings?: Booking[] } | undefined)?.bookings ??
            []);

        const upcoming = bookings
          .filter((b: Booking) => new Date(b.date) >= new Date())
          .slice(0, 3)
          .map((b: Booking) => ({
            id: b.id || (b as { _id?: string })._id || "",
            venueName: (b.venueId as { name?: string })?.name,
            coachName: (b.coachId as { name?: string })?.name,
            sport: b.sport,
            date: b.date,
            startTime: b.startTime,
            endTime: b.endTime,
            status: b.status,
          }));

        setUpcomingBookings(upcoming);
      }

      if (friendCountResult.status === "fulfilled") {
        setPendingFriendRequests(friendCountResult.value.count || 0);
      }

      if (invitationCountResult.status === "fulfilled") {
        setPendingInvitations(invitationCountResult.value.count || 0);
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlayerPageHeader
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening with your activities."
      />

      {/* Notifications Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Pending Friend Requests */}
        <Card
          className="bg-white hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => router.push("/dashboard/friends")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-900">
              Friend Requests
            </CardTitle>
            <UserPlus className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {pendingFriendRequests}
            </div>
            <p className="text-xs text-slate-500">
              {pendingFriendRequests === 0
                ? "No pending requests"
                : "Pending requests"}
            </p>
            {pendingFriendRequests > 0 && (
              <Badge variant="destructive" className="mt-2">
                Action needed
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <Card
          className="bg-white hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => router.push("/dashboard/invitations")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-900">
              Booking Invitations
            </CardTitle>
            <Mail className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {pendingInvitations}
            </div>
            <p className="text-xs text-slate-500">
              {pendingInvitations === 0
                ? "No pending invitations"
                : "Pending invitations"}
            </p>
            {pendingInvitations > 0 && (
              <Badge variant="destructive" className="mt-2">
                Action needed
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Bookings */}
        <Card
          className="bg-white hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => router.push("/dashboard/my-bookings")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-900">
              Upcoming Bookings
            </CardTitle>
            <Calendar className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {upcomingBookings.length}
            </div>
            <p className="text-xs text-slate-500">
              {upcomingBookings.length === 0
                ? "No upcoming bookings"
                : "Sessions scheduled"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Bookings List */}
      {upcomingBookings.length > 0 && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-slate-900">Next Sessions</CardTitle>
            <CardDescription className="text-slate-500">
              Your upcoming bookings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                    <Calendar className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {booking.venueName || booking.coachName}
                    </p>
                    <p className="text-sm text-slate-500">
                      {booking.sport} •{" "}
                      {new Date(booking.date).toLocaleDateString()} at{" "}
                      {booking.startTime}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{booking.status}</Badge>
              </div>
            ))}
            <Link href="/dashboard/my-bookings">
              <Button variant="outline" className="w-full mt-2">
                View All Bookings
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-slate-900">Quick Actions</CardTitle>
          <CardDescription className="text-slate-500">
            Get started with common activities
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/venues">
            <Button
              variant="outline"
              className="w-full h-auto py-6 flex flex-col gap-2 text-slate-900 hover:bg-slate-50"
            >
              <MapPin className="h-6 w-6 text-orange-600" />
              <span className="text-slate-900">Book Venue</span>
            </Button>
          </Link>
          <Link href="/coaches">
            <Button
              variant="outline"
              className="w-full h-auto py-6 flex flex-col gap-2 text-slate-900 hover:bg-slate-50"
            >
              <Users className="h-6 w-6 text-orange-600" />
              <span className="text-slate-900">Find Coach</span>
            </Button>
          </Link>
          <Link href="/dashboard/friends">
            <Button
              variant="outline"
              className="w-full h-auto py-6 flex flex-col gap-2 text-slate-900 hover:bg-slate-50"
            >
              <UserPlus className="h-6 w-6 text-orange-600" />
              <span className="text-slate-900">Manage Friends</span>
            </Button>
          </Link>
          <Link href="/dashboard/my-profile">
            <Button
              variant="outline"
              className="w-full h-auto py-6 flex flex-col gap-2 text-slate-900 hover:bg-slate-50"
            >
              <TrendingUp className="h-6 w-6 text-orange-600" />
              <span className="text-slate-900">View Profile</span>
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
