"use client";

import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CancelSubscriptionModal } from "@/components/ui/CancelSubscriptionModal";
import { useFriendSocket } from "@/hooks/useFriendSocket";
import { toast } from "@/lib/toast";
import { coachApi } from "@/modules/coach/services/coach";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { ListSkeleton } from "@/modules/shared/ui/Skeleton";
import type { CoachSubscription } from "@/types";
import { AnimatePresence, motion, Variants } from "framer-motion";
import { CalendarRange, RotateCcw, TrendingUp, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type SubscriptionFilter = "ALL" | "LIVE" | "ENDED";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PAST_DUE: "bg-amber-50 text-amber-700 border-amber-200",
  CANCELLED: "bg-slate-100 text-slate-700 border-slate-200",
  EXPIRED: "bg-rose-50 text-rose-700 border-rose-200",
};

const isLiveStatus = (status: string) =>
  status === "ACTIVE" || status === "PAST_DUE";

const getStatusStyle = (status: string) =>
  STATUS_STYLES[status] || "bg-slate-100 text-slate-700 border-slate-200";

// Animation Variants for Staggered Lists
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<CoachSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SubscriptionFilter>("ALL");

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const { socket } = useFriendSocket();

  const openCancelModal = (subscriptionId: string) => {
    setSelectedSubId(subscriptionId);
    setCancelModalOpen(true);
  };

  const executeCancellation = async (reason: string) => {
    if (!selectedSubId) return;

    setIsCancelling(true);
    try {
      const response = await coachApi.cancelCoachSubscription(
        selectedSubId,
        reason,
      );
      if (!response.success) throw new Error(response.message);

      toast.success("Subscription cancelled successfully");
      setCancelModalOpen(false);
      await loadSubscriptions();
    } catch (error) {
      toast.error("Failed to cancel subscription");
    } finally {
      setIsCancelling(false);
      setSelectedSubId(null);
    }
  };

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const response = await coachApi.getMySubscriptions();
      const nextSubscriptions = Array.isArray(response.data?.subscriptions)
        ? response.data.subscriptions
        : response.data?.subscriptions
          ? [response.data.subscriptions as CoachSubscription]
          : [];
      setSubscriptions(nextSubscriptions);
    } catch (error) {
      console.error("Failed to load subscriptions:", error);
      toast.error("Failed to load your subscriptions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSubscriptions();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      void loadSubscriptions();
    };
    socket.on("subscription:updated", handleUpdate);
    socket.on("wallet:updated", handleUpdate);

    return () => {
      socket.off("subscription:updated", handleUpdate);
      socket.off("wallet:updated", handleUpdate);
    };
  }, [socket]);

  const counts = useMemo(() => {
    const live = subscriptions.filter((subscription) =>
      isLiveStatus(subscription.status),
    ).length;
    return {
      all: subscriptions.length,
      live,
      ended: Math.max(0, subscriptions.length - live),
    };
  }, [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    if (filter === "LIVE") {
      return subscriptions.filter((subscription) =>
        isLiveStatus(subscription.status),
      );
    }

    if (filter === "ENDED") {
      return subscriptions.filter(
        (subscription) => !isLiveStatus(subscription.status),
      );
    }

    return subscriptions;
  }, [filter, subscriptions]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My Subscriptions" },
        ]}
      />

      <PlayerPageHeader
        badge="Player"
        title="My Subscriptions"
        subtitle="Track all your coach subscriptions, renew active plans, and cancel when needed."
      />

      {/* Stats strip */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-3 sm:grid-cols-3"
      >
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {counts.all}
            </p>
          </div>
        </motion.div>
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Active / Past Due
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {counts.live}
            </p>
          </div>
        </motion.div>
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 premium-shadow shop-surface">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ended
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {counts.ended}
            </p>
          </div>
        </motion.div>
      </motion.div>

      <Card className="shop-surface premium-shadow overflow-hidden p-0">
        <ProfileSectionHeader
          icon={TrendingUp}
          title="Manage Subscriptions"
          description="Use filters to focus on live plans or completed ones."
        />
        <CardContent className="px-6 py-5 space-y-4">
          {/* Filter buttons */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "All", value: "ALL", count: counts.all },
              { label: "Live", value: "LIVE", count: counts.live },
              { label: "Ended", value: "ENDED", count: counts.ended },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setFilter(item.value as SubscriptionFilter)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition-all ${
                  filter === item.value
                    ? "border-power-orange bg-power-orange text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {item.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                    filter === item.value
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.count}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <ListSkeleton count={4} />
          ) : filteredSubscriptions.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60">
                <EmptyState
                  icon={Wallet}
                  title="No subscriptions yet"
                  description="Browse coaches and purchase a subscription plan to manage it here."
                  actionLabel="Browse Coaches"
                  onAction={() => router.push("/booking?tab=coaches")}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-3"
            >
              <AnimatePresence mode="popLayout">
                {filteredSubscriptions.map((subscription) => {
                  const subscriptionId = subscription.id || subscription._id;

                  const packageInfo = subscription.packageId as
                    | {
                        _id?: string;
                        id?: string;
                        name?: string;
                        description?: string;
                      }
                    | string
                    | null
                    | undefined;

                  const coachInfo = subscription.coachId as
                    | {
                        _id?: string;
                        id?: string;
                        userId?: { name?: string } | string;
                        sports?: string[];
                      }
                    | string
                    | null
                    | undefined;

                  const packageId =
                    typeof packageInfo === "string"
                      ? packageInfo
                      : packageInfo?._id || packageInfo?.id;
                  const packageName =
                    typeof packageInfo === "string"
                      ? "Subscription package"
                      : packageInfo?.name || "Subscription package";

                  const coachId =
                    typeof coachInfo === "string"
                      ? coachInfo
                      : coachInfo?._id || coachInfo?.id;
                  const coachName =
                    typeof coachInfo === "string"
                      ? "Coach"
                      : typeof coachInfo?.userId === "object" &&
                          coachInfo.userId?.name
                        ? coachInfo.userId.name
                        : coachInfo?.sports?.[0]
                          ? `${coachInfo.sports[0]} Coach`
                          : "Coach";

                  const canManage =
                    subscriptionId && isLiveStatus(subscription.status);
                  const isLive = isLiveStatus(subscription.status);

                  return (
                    <motion.div
                      layout
                      variants={itemVariants}
                      exit={{
                        opacity: 0,
                        scale: 0.95,
                        transition: { duration: 0.2 },
                      }}
                      key={
                        subscriptionId ||
                        `${coachName}-${packageName}-${subscription.createdAt}`
                      }
                    >
                      <div className="flex rounded-xl border border-slate-200/70 bg-slate-50/40 overflow-hidden">
                        {/* Status accent stripe */}
                        <div
                          className={`w-1 shrink-0 ${isLive ? "bg-turf-green" : "bg-slate-300"}`}
                        />
                        <div className="flex flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <p className="text-base font-semibold text-slate-900">
                              {packageName}
                            </p>
                            <p className="text-sm text-slate-600">
                              {coachName}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <CalendarRange size={13} />
                                Started{" "}
                                {new Date(
                                  subscription.currentPeriodStart,
                                ).toLocaleDateString("en-IN")}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <RotateCcw size={13} />
                                Expires{" "}
                                {new Date(
                                  subscription.currentPeriodEnd,
                                ).toLocaleDateString("en-IN")}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-start gap-3 sm:items-end">
                            <Badge
                              variant="outline"
                              className={getStatusStyle(subscription.status)}
                            >
                              {subscription.status}
                            </Badge>
                            <div className="flex flex-wrap gap-2">
                              {coachId && packageId ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-sm text-slate-800"
                                  onClick={() =>
                                    router.push(
                                      `/dashboard/subscription-checkout?coachId=${encodeURIComponent(coachId)}&packageId=${encodeURIComponent(packageId)}`,
                                    )
                                  }
                                >
                                  Renew Plan
                                </Button>
                              ) : null}

                              {canManage ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                                  disabled={
                                    isCancelling &&
                                    selectedSubId === subscriptionId
                                  }
                                  onClick={() => {
                                    if (subscriptionId) {
                                      openCancelModal(subscriptionId);
                                    }
                                  }}
                                >
                                  {isCancelling &&
                                  selectedSubId === subscriptionId
                                    ? "Cancelling..."
                                    : "Cancel"}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Modal Wrapper */}
      <CancelSubscriptionModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={executeCancellation}
        isLoading={isCancelling}
      />
    </motion.div>
  );
}
