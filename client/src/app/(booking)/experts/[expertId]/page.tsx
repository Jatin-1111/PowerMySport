"use client";

import api from "@/lib/api/axios";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { SlotPicker } from "@/modules/expert/components/SlotPicker";
import {
    expertApi,
    type Expert,
    type ExpertReview,
    type ExpertSessionMode,
} from "@/modules/expert/services/expert";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { FadeIn } from "@/modules/shared/ui/motion/FadeIn";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import {
    ArrowLeft,
    Award,
    CalendarCheck,
    CalendarClock,
    Globe,
    Languages,
    MapPin,
    MessageSquareText,
    Quote,
    ShieldCheck,
    Sparkles,
    Star,
    Timer,
    Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface DependentOption {
  _id: string;
  name: string;
  type: "SELF" | "DEPENDENT";
}

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function ExpertHeroAvatar({ expert }: { expert: Expert }) {
  const [failed, setFailed] = useState(false);
  const initial = (expert.name || "E").charAt(0).toUpperCase();
  if (!expert.photoUrl || failed) {
    return (
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-white/20 bg-white/10 text-3xl font-bold text-white/70 sm:h-28 sm:w-28">
        {initial}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={expert.photoUrl}
      alt={expert.name || "Expert"}
      onError={() => setFailed(true)}
      className="h-24 w-24 shrink-0 rounded-full border-4 border-white/20 object-cover sm:h-28 sm:w-28"
    />
  );
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Skeleton className="mb-6 h-5 w-32" />
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <Card className="overflow-hidden border border-slate-200 bg-white p-0 shadow-sm">
              <Skeleton className="h-40 w-full rounded-none" />
              <div className="space-y-3 p-6">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-16 w-full" />
              </div>
            </Card>
          </div>
          <Card className="border border-slate-200 bg-white shadow-sm">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="mt-4 h-32 w-full" />
            <Skeleton className="mt-4 h-11 w-full" />
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ExpertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const expertId = String(params?.expertId || "");
  const user = useAuthStore((s) => s.user);

  const [expert, setExpert] = useState<Expert | null>(null);
  const [reviews, setReviews] = useState<ExpertReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [mode, setMode] = useState<ExpertSessionMode>("ONLINE");
  const [note, setNote] = useState("");
  const [slot, setSlot] = useState<string | null>(null);
  const [dependents, setDependents] = useState<DependentOption[]>([]);
  const [selectedDependentId, setSelectedDependentId] = useState<string | null>(null);

  // Fetch the parent's children so they can optionally attach one to this
  // booking — auto-select when there's exactly one, same rule as the wizard.
  useEffect(() => {
    if (!user) return;
    api
      .get<{ success: boolean; data: DependentOption[] }>("/auth/players")
      .then((res) => {
        if (!res.data.success || !Array.isArray(res.data.data)) return;
        const deps = res.data.data.filter((p) => p.type === "DEPENDENT");
        setDependents(deps);
        if (deps.length === 1) setSelectedDependentId(deps[0]._id);
      })
      .catch(() => {});
  }, [user]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [e, r] = await Promise.all([
        expertApi.getExpert(expertId),
        expertApi.getExpertReviews(expertId),
      ]);
      if (e.success && e.data) {
        setExpert(e.data);
        if (e.data.sessionMode === "IN_PERSON") setMode("IN_PERSON");
      } else {
        setError(e.message || "Expert not found.");
      }
      if (r.success && r.data) setReviews(r.data);
    } catch {
      setError("Failed to load expert.");
    } finally {
      setLoading(false);
    }
  }, [expertId]);

  useEffect(() => {
    if (expertId) load();
  }, [expertId, load]);

  const handleConnect = async () => {
    if (!user) {
      router.push(`/login?redirect=/experts/${expertId}`);
      return;
    }
    if (!slot) {
      toast.error("Please pick a session time first.");
      return;
    }
    setConnecting(true);
    try {
      const res = await expertApi.initiateSession(expertId, {
        scheduledAt: slot,
        mode: expert?.sessionMode === "BOTH" ? mode : undefined,
        clientNote: note.trim() || undefined,
        playerId: selectedDependentId || undefined,
      });
      if (res.success && res.data?.redirectUrl) {
        // Hand off to PhonePe hosted checkout.
        window.location.href = res.data.redirectUrl;
      } else {
        toast.error(res.message || "Could not start payment.");
        setConnecting(false);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not start payment.";
      toast.error(msg);
      setConnecting(false);
    }
  };

  if (loading) return <DetailSkeleton />;

  if (error || !expert) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20">
        <EmptyState
          icon={ShieldCheck}
          title={error || "Expert not found."}
          description="This expert may no longer be active, or the link is incorrect."
          actionLabel="Back to experts"
          onAction={() => router.push("/experts")}
        />
      </div>
    );
  }

  const modeLabel =
    expert.sessionMode === "BOTH"
      ? "Online or in-person"
      : expert.sessionMode === "ONLINE"
        ? "Online"
        : "In-person";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/experts"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-power-orange"
          >
            <ArrowLeft className="h-4 w-4" /> All experts
          </Link>
          <Link
            href="/experts/sessions"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-power-orange"
          >
            <CalendarCheck className="h-4 w-4" /> My sessions
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          {/* Profile */}
          <div className="space-y-6">
            <SlideUp>
              <Card className="overflow-hidden border border-slate-200 bg-white p-0 shadow-sm">
                {/* Dark hero strip */}
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-8 text-white sm:px-8">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-power-orange/20 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-turf-green/10 blur-3xl" />
                  <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
                    <ExpertHeroAvatar expert={expert} />
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                        <Award className="h-3.5 w-3.5" /> Verified Expert
                      </span>
                      <h1 className="font-title mt-2 text-2xl font-bold sm:text-3xl">
                        {expert.name || "Expert"}
                      </h1>
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-300 sm:justify-start">
                        {expert.city && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" /> {expert.city}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Globe className="h-3.5 w-3.5" /> {modeLabel}
                        </span>
                        {expert.languages && expert.languages.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Languages className="h-3.5 w-3.5" />{" "}
                            {expert.languages.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    {expert.reviewCount > 0 && (
                      <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/20">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        {expert.rating.toFixed(1)}
                        <span className="text-xs font-normal text-slate-300">
                          ({expert.reviewCount})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* White content area */}
                <div className="p-6 sm:p-8">
                  <div className="flex flex-wrap gap-1.5">
                    {(expert.sports || []).map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-power-orange/10 px-2.5 py-0.5 text-xs font-medium text-power-orange"
                      >
                        {s}
                      </span>
                    ))}
                    {(expert.expertise || []).map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  {expert.bio && (
                    <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                      {expert.bio}
                    </p>
                  )}
                  {expert.achievements && (
                    <div className="mt-4 rounded-xl bg-slate-50 p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Award className="h-4 w-4 text-power-orange" />{" "}
                        Achievements
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
                        {expert.achievements}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </SlideUp>

            {/* Reviews */}
            <FadeIn delay={0.1}>
              <Card className="border border-slate-200 bg-white shadow-sm">
                <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                    <Star className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Reviews
                    </h2>
                    <p className="text-xs text-slate-500">
                      {reviews.length > 0
                        ? `${reviews.length} review${reviews.length === 1 ? "" : "s"} from past sessions`
                        : "No reviews yet"}
                    </p>
                  </div>
                </div>
                {reviews.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Be the first to book a session and leave a review.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((r, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-900">
                            {r.reviewerName || "A player"}
                          </span>
                          <span className="flex items-center gap-0.5 text-amber-500">
                            {Array.from({ length: 5 }).map((_, s) => (
                              <Star
                                key={s}
                                className={`h-3.5 w-3.5 ${s < Math.round(r.rating) ? "fill-amber-500" : "text-slate-200"}`}
                              />
                            ))}
                          </span>
                        </div>
                        {r.review && (
                          <p className="mt-2 flex gap-1.5 text-sm leading-relaxed text-slate-600">
                            <Quote className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                            {r.review}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </FadeIn>
          </div>

          {/* Connect / pay card */}
          <div className="lg:sticky lg:top-6">
            <FadeIn delay={0.15}>
              <Card className="border border-slate-200 bg-white shadow-lg">
                <p className="text-sm text-slate-500">Session fee</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-extrabold text-slate-900">
                    {formatInr(expert.sessionFee)}
                  </p>
                  {expert.sessionDurationMinutes && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                      <Timer className="h-3.5 w-3.5" />{" "}
                      {expert.sessionDurationMinutes} min
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Pick a time and pay securely to confirm your session.
                </p>

                <div className="mt-5">
                  <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <CalendarClock className="h-3.5 w-3.5" /> Choose a time
                  </label>
                  <SlotPicker
                    expertId={expertId}
                    value={slot}
                    onChange={setSlot}
                    timezone={expert.timezone}
                  />
                </div>

                {expert.sessionMode === "BOTH" && (
                  <div className="mt-4">
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Globe className="h-3.5 w-3.5" /> Session mode
                    </label>
                    <select
                      value={mode}
                      onChange={(e) =>
                        setMode(e.target.value as ExpertSessionMode)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                    >
                      <option value="ONLINE">Online</option>
                      <option value="IN_PERSON">In-person</option>
                    </select>
                  </div>
                )}

                {dependents.length > 0 && (
                  <div className="mt-4">
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Users className="h-3.5 w-3.5" /> Who is this session for?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {dependents.map((dep) => (
                        <button
                          key={dep._id}
                          type="button"
                          onClick={() =>
                            setSelectedDependentId((prev) =>
                              prev === dep._id ? null : dep._id,
                            )
                          }
                          className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ${
                            selectedDependentId === dep._id
                              ? "border-power-orange bg-power-orange/5 text-power-orange"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {dep.name}
                        </button>
                      ))}
                    </div>
                    {selectedDependentId && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400">
                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-power-orange" />
                        We&apos;ll share {dependents.find((d) => d._id === selectedDependentId)?.name}&apos;s sport profile with the expert so they&apos;re ready for your call.
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4">
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <MessageSquareText className="h-3.5 w-3.5" /> What would you
                    like to discuss? (optional)
                  </label>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Is football sustainable with his school schedule? Should we push for state trials?"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-all focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                  />
                </div>

                <Button
                  onClick={handleConnect}
                  disabled={!slot}
                  loading={connecting}
                  fullWidth
                  size="lg"
                  className="mt-5"
                >
                  {slot
                    ? `Book — Pay ${formatInr(expert.sessionFee)}`
                    : "Select a time to continue"}
                </Button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> Secure payment via
                  PhonePe
                </p>
              </Card>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  );
}
