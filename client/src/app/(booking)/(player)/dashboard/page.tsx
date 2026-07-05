"use client";

import { toast } from "@/lib/toast";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
  Calendar,
  UserPlus,
  Mail,
  MapPin,
  Users,
  TrendingUp,
  ChevronRight,
  Zap,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/modules/shared/ui/Card";
import { Button } from "@/modules/shared/ui/Button";
import { Badge } from "@/components/ui/badge";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { DashboardCalendar } from "@/modules/player/components/DashboardCalendar";
import { bookingApi } from "@/modules/booking/services/booking";
import { coachApi } from "@/modules/coach/services/coach";
import { friendService } from "@/modules/shared/services/friend";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import {
  StaggerContainer,
  StaggerItem,
} from "@/modules/shared/ui/motion/StaggerContainer";
import { motion } from "framer-motion";
import type { Booking, CoachSubscription } from "@/types";
import { useFriendSocket } from "@/hooks/useFriendSocket";

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
  const user = useAuthStore((state) => state.user);
  const [upcomingBookings, setUpcomingBookings] = useState<UpcomingBooking[]>(
    [],
  );
  const [activeSubscriptions, setActiveSubscriptions] = useState<
    CoachSubscription[]
  >([]);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  const [pendingInvitations, setPendingInvitations] = useState(0);
  const [cancellingSubscriptionId, setCancellingSubscriptionId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);

  const { socket } = useFriendSocket();

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      loadDashboardData();
    };
    socket.on("booking:updated", handleUpdate);
    socket.on("subscription:updated", handleUpdate);
    
    return () => {
      socket.off("booking:updated", handleUpdate);
      socket.off("subscription:updated", handleUpdate);
    };
  }, [socket]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [
        bookingsResult,
        subscriptionsResult,
        friendCountResult,
        invitationCountResult,
      ] = await Promise.allSettled([
        bookingApi.getMyBookings({ page: 1, limit: 3 }),
        coachApi.getMySubscriptions(),
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

      if (subscriptionsResult?.status === "fulfilled") {
        const subscriptionData = subscriptionsResult.value.data?.subscriptions;
        const normalizedSubscriptions = Array.isArray(subscriptionData)
          ? subscriptionData
          : subscriptionData
            ? [subscriptionData as CoachSubscription]
            : [];
        setActiveSubscriptions(normalizedSubscriptions);
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

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!window.confirm("Cancel this subscription?")) {
      return;
    }

    setCancellingSubscriptionId(subscriptionId);
    try {
      const response = await coachApi.cancelCoachSubscription(subscriptionId);
      if (!response.success) {
        throw new Error(response.message || "Failed to cancel subscription");
      }

      toast.success("Subscription cancelled");
      await loadDashboardData();
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to cancel subscription",
      );
    } finally {
      setCancellingSubscriptionId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/60 p-6 shadow-sm sm:p-8">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-3 h-5 w-64 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const liveSubscriptions = activeSubscriptions.filter((subscription) =>
    ["ACTIVE", "PAST_DUE"].includes(subscription.status),
  );

  return (
    <div className="space-y-6">
      <PlayerPageHeader
        badge={user?.userType === "Parent" ? "Parent Dashboard" : "Player Dashboard"}
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening with your activities."
      />

      {/* Notification Stats Strip */}
      <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Pending Friend Requests */}
        <StaggerItem className="h-full">
          <motion.div
            className="flex h-full cursor-pointer flex-col rounded-xl border border-slate-200/70 bg-white/70 p-4 shop-surface premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            onClick={() => router.push("/dashboard/friends")}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <UserPlus className="h-5 w-5" />
              </div>
              {pendingFriendRequests > 0 && (
                <Badge className="border-red-200 bg-red-50 text-red-700 hover:bg-red-50">
                  Action needed
                </Badge>
              )}
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {pendingFriendRequests}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Friend Requests
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {pendingFriendRequests === 0
                ? "No pending requests"
                : `${pendingFriendRequests} waiting for your response`}
            </p>
          </motion.div>
        </StaggerItem>

        {/* Pending Invitations */}
        <StaggerItem className="h-full">
          <motion.div
            className="flex h-full cursor-pointer flex-col rounded-xl border border-slate-200/70 bg-white/70 p-4 shop-surface premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            onClick={() => router.push("/dashboard/invitations")}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-power-orange">
                <Mail className="h-5 w-5" />
              </div>
              {pendingInvitations > 0 && (
                <Badge className="border-red-200 bg-red-50 text-red-700 hover:bg-red-50">
                  Action needed
                </Badge>
              )}
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {pendingInvitations}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Booking Invitations
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {pendingInvitations === 0
                ? "No pending invitations"
                : `${pendingInvitations} invitations awaiting`}
            </p>
          </motion.div>
        </StaggerItem>

        {/* Upcoming Bookings */}
        <StaggerItem className="h-full">
          <motion.div
            className="flex h-full cursor-pointer flex-col rounded-xl border border-slate-200/70 bg-white/70 p-4 shop-surface premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            onClick={() => router.push("/dashboard/my-bookings")}
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <Calendar className="h-5 w-5" />
              </div>
              {upcomingBookings.length > 0 && (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                  Scheduled
                </Badge>
              )}
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {upcomingBookings.length}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Upcoming Bookings
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {upcomingBookings.length === 0
                ? "No upcoming sessions"
                : `${upcomingBookings.length} sessions scheduled`}
            </p>
          </motion.div>
        </StaggerItem>
      </StaggerContainer>

      {/* Calendar */}
      <SlideUp delay={0.15} yOffset={18}>
        <DashboardCalendar />
      </SlideUp>

      {/* Active Subscriptions */}
      {liveSubscriptions.length > 0 && (
        <SlideUp delay={0.2} yOffset={18}>
          <Card className="shop-surface premium-shadow overflow-hidden p-0">
            <ProfileSectionHeader
              icon={TrendingUp}
              title="Active Subscriptions"
              description="Plans you purchased from coaches and their expiry dates."
              action={
                <Link href="/dashboard/subscriptions">
                  <Button variant="outline" size="sm" icon={<ChevronRight size={14} />}>
                    Manage all
                  </Button>
                </Link>
              }
            />
            <CardContent className="px-6 py-5 space-y-3">
              {liveSubscriptions.slice(0, 3).map((subscription) => {
                const subscriptionId = subscription.id || subscription._id;
                const packageData = subscription.packageId as
                  | { name?: string; price?: number }
                  | string
                  | null
                  | undefined;
                const packageReference = subscription.packageId as
                  | { _id?: string; id?: string }
                  | string
                  | null
                  | undefined;
                const packageName =
                  typeof packageData === "string"
                    ? "Subscription package"
                    : packageData?.name || "Subscription package";
                const packageId =
                  typeof packageReference === "string"
                    ? packageReference
                    : packageReference?._id || packageReference?.id;
                const coachData = subscription.coachId as
                  | { userId?: { name?: string } | string; sports?: string[] }
                  | string
                  | null
                  | undefined;
                const coachReference = subscription.coachId as
                  | { _id?: string; id?: string }
                  | string
                  | null
                  | undefined;
                const coachId =
                  typeof coachReference === "string"
                    ? coachReference
                    : coachReference?._id || coachReference?.id;
                const coachName =
                  typeof coachData === "string"
                    ? "Coach"
                    : typeof coachData?.userId === "object" &&
                        coachData.userId?.name
                      ? coachData.userId.name
                      : coachData?.sports?.[0]
                        ? `${coachData.sports[0]} Coach`
                        : "Coach";

                return (
                  <div
                    key={subscription.id || subscription._id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-slate-50/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {packageName}
                      </p>
                      <p className="text-sm text-slate-500">
                        {coachName} • Expires{" "}
                        {subscription.currentPeriodEnd
                          ? new Date(
                              subscription.currentPeriodEnd,
                            ).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "soon"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          subscription.status === "ACTIVE"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                            : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50"
                        }
                      >
                        {subscription.status}
                      </Badge>
                      {coachId && packageId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/dashboard/subscription-checkout?coachId=${encodeURIComponent(coachId)}&packageId=${encodeURIComponent(packageId)}`,
                            )
                          }
                        >
                          Renew
                        </Button>
                      ) : null}
                      {subscriptionId ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={cancellingSubscriptionId === subscriptionId}
                          onClick={() =>
                            void handleCancelSubscription(subscriptionId)
                          }
                        >
                          {cancellingSubscriptionId === subscriptionId
                            ? "Cancelling..."
                            : "Cancel"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </SlideUp>
      )}

      {/* Quick Actions */}
      <SlideUp delay={0.25} yOffset={20}>
        <Card className="shop-surface premium-shadow overflow-hidden p-0">
          <ProfileSectionHeader
            icon={Zap}
            title="Quick Actions"
            description="Get started with common activities"
          />
          <CardContent className="px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  href: "/venues",
                  icon: MapPin,
                  label: "Book Venue",
                  color: "bg-indigo-100 text-indigo-600",
                },
                {
                  href: "/coaches",
                  icon: Users,
                  label: "Find Coach",
                  color: "bg-purple-100 text-purple-600",
                },
                {
                  href: "/dashboard/friends",
                  icon: UserPlus,
                  label: "Manage Friends",
                  color: "bg-emerald-100 text-emerald-600",
                },
                {
                  href: "/dashboard/wallet",
                  icon: Wallet,
                  label: "My Wallet",
                  color: "bg-sky-100 text-sky-600",
                },
                {
                  href: "/dashboard/my-profile",
                  icon: TrendingUp,
                  label: "View Profile",
                  color: "bg-orange-100 text-power-orange",
                },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link key={href} href={href}>
                  <motion.div
                    className="flex flex-col items-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/40 px-4 py-5 text-center transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm cursor-pointer"
                    whileHover={{ y: -3, scale: 1.01 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800">
                      {label}
                    </span>
                  </motion.div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </SlideUp>
    </div>
  );
}
