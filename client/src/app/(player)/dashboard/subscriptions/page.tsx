"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { coachApi } from "@/modules/coach/services/coach";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/modules/shared/ui/Card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { ListSkeleton } from "@/modules/shared/ui/Skeleton";
import { CalendarRange, RefreshCw, RotateCcw, Wallet } from "lucide-react";
import type { CoachSubscription } from "@/types";
import { CancelSubscriptionModal } from "@/components/ui/CancelSubscriptionModal";
import { motion, AnimatePresence, Variants } from "framer-motion";

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
    transition: { staggerChildren: 0.1 },
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
        action={
          <Button
            variant="outline"
            className="text-slate-800"
            onClick={() => void loadSubscriptions()}
            icon={<RefreshCw size={16} />}
          >
            Refresh
          </Button>
        }
      />

      {/* Stats Cards with smooth entrance */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-3 sm:grid-cols-3"
      >
        <motion.div variants={itemVariants}>
          <Card className="shop-surface premium-shadow h-full">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-2xl font-bold text-slate-900">{counts.all}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="shop-surface premium-shadow h-full">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-500">Active / Past Due</p>
              <p className="text-2xl font-bold text-slate-900">{counts.live}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="shop-surface premium-shadow h-full">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-500">Ended</p>
              <p className="text-2xl font-bold text-slate-900">
                {counts.ended}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <Card className="shop-surface premium-shadow">
        <CardHeader>
          <CardTitle className="text-slate-900">Manage Subscriptions</CardTitle>
          <CardDescription className="text-slate-500">
            Use filters to focus on live plans or completed ones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { label: "All", value: "ALL", count: counts.all },
              { label: "Live", value: "LIVE", count: counts.live },
              { label: "Ended", value: "ENDED", count: counts.ended },
            ].map((item) => (
              <Button
                key={item.value}
                variant={filter === item.value ? "primary" : "outline"}
                className="text-sm transition-all"
                onClick={() => setFilter(item.value as SubscriptionFilter)}
              >
                {item.label} ({item.count})
              </Button>
            ))}
          </div>

          {loading ? (
            <ListSkeleton count={4} />
          ) : filteredSubscriptions.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="border border-dashed border-slate-300 bg-white">
                <EmptyState
                  icon={Wallet}
                  title="No subscriptions yet"
                  description="Browse coaches and purchase a subscription plan to manage it here."
                  actionLabel="Browse Coaches"
                  onAction={() => router.push("/coaches")}
                />
              </Card>
            </motion.div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-3"
            >
              {/* Added AnimatePresence so items slide out when filtered */}
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

                  return (
                    <motion.div
                      layout // Layout animation for smooth re-ordering on filter
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
                      className="rounded-2xl border border-slate-200 bg-white/80 p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <p className="text-base font-semibold text-slate-900">
                            {packageName}
                          </p>
                          <p className="text-sm text-slate-600">{coachName}</p>
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

                        <Badge
                          variant="outline"
                          className={getStatusStyle(subscription.status)}
                        >
                          {subscription.status}
                        </Badge>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {coachId && packageId ? (
                          <Button
                            variant="outline"
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
                            variant="outline"
                            className="text-sm"
                            disabled={
                              isCancelling && selectedSubId === subscriptionId
                            }
                            onClick={() => {
                              if (subscriptionId) {
                                openCancelModal(subscriptionId);
                              }
                            }}
                          >
                            {isCancelling && selectedSubId === subscriptionId
                              ? "Cancelling..."
                              : "Cancel Subscription"}
                          </Button>
                        ) : null}
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
