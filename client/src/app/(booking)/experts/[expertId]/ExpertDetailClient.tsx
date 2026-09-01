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
import { CompleteProfileNudge, shouldShowTraitsNudge } from "@/modules/player/components/CompleteProfileNudge";
import { Button } from "@/modules/shared/ui/Button";
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
    Zap,
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
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-white/20 bg-white/10 text-4xl font-bold text-white/70 backdrop-blur-sm sm:h-32 sm:w-32 sm:text-5xl">
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
      className="h-24 w-24 shrink-0 rounded-2xl border-2 border-white/20 object-cover shadow-2xl sm:h-32 sm:w-32"
    />
  );
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#F4F3F0]">
      <div className="relative bg-slate-900 pb-10 pt-6">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8 flex justify-between">
            <Skeleton className="h-8 w-28 rounded-full opacity-30" />
            <Skeleton className="h-8 w-28 rounded-full opacity-30" />
          </div>
          <div className="flex items-end gap-6">
            <Skeleton className="h-32 w-32 rounded-2xl opacity-30" />
            <div className="mb-2 space-y-3">
              <Skeleton className="h-4 w-24 rounded-full opacity-30" />
              <Skeleton className="h-9 w-52 opacity-30" />
              <Skeleton className="h-4 w-64 rounded-full opacity-30" />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <Skeleton className="h-36 w-full rounded-2xl" />
            <Skeleton className="h-52 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function ExpertDetailClient() {
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
  const [traitsNudgeOpen, setTraitsNudgeOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ success: boolean; data: DependentOption[] }>("/auth/players")
      .then((res) => {
        if (!res.data.success || !Array.isArray(res.data.data)) return;
        const deps = res.data.data.filter((p) => p.type === "DEPENDENT");
        setDependents(deps);

        // One-time handoff from the "Yes, I know the sport" flow: it already
        // saved the child's profile and points here with which dependent and
        // issue it was about, so the brief carries forward instead of the
        // parent having to re-explain it in "What to discuss?".
        let brief: { dependentId?: string; issueLabel?: string | null } | null = null;
        try {
          const raw = localStorage.getItem("pms_expert_brief");
          if (raw) brief = JSON.parse(raw);
        } catch {}
        if (brief?.dependentId && deps.some((d) => d._id === brief!.dependentId)) {
          setSelectedDependentId(brief.dependentId);
          setNote((prev) => prev || (brief!.issueLabel ? `Here to help with: ${brief!.issueLabel}` : prev));
        } else if (deps.length === 1) {
          setSelectedDependentId(deps[0]._id);
        }
        try {
          localStorage.removeItem("pms_expert_brief");
        } catch {}
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

  const selectedDependent = dependents.find((d) => d._id === selectedDependentId);

  const proceedToPayment = async () => {
    setConnecting(true);
    try {
      const res = await expertApi.initiateSession(expertId, {
        scheduledAt: slot!,
        mode: expert?.sessionMode === "BOTH" ? mode : undefined,
        clientNote: note.trim() || undefined,
        playerId: selectedDependentId || undefined,
      });
      if (res.success && res.data?.redirectUrl) {
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

  const handleConnect = () => {
    if (!user) {
      router.push(`/login?redirect=/experts/${expertId}`);
      return;
    }
    if (!slot) {
      toast.error("Please pick a session time first.");
      return;
    }
    if (shouldShowTraitsNudge(selectedDependent)) {
      setTraitsNudgeOpen(true);
      return;
    }
    proceedToPayment();
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
          onAction={() => router.push("/booking?tab=experts")}
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
    <div className="min-h-screen bg-[#F4F3F0]">
      {/* ── Full-width Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-power-orange/15 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-indigo-500/10 blur-[80px]" />
        {/* Nav */}
        <div className="relative mx-auto max-w-6xl px-6 pt-6">
          <div className="flex items-center justify-between">
            <Link href="/booking?tab=experts" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> All experts
            </Link>
            <Link href="/experts/sessions" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white">
              <CalendarCheck className="h-3.5 w-3.5" /> My sessions
            </Link>
          </div>
        </div>
        {/* Hero content */}
        <div className="relative mx-auto max-w-6xl px-6 pb-10 pt-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <ExpertHeroAvatar expert={expert} />
            <div className="flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-power-orange/30 bg-power-orange/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-power-orange">
                <Award className="h-3 w-3" /> Verified Expert
              </span>
              <h1 className="font-title mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                {expert.name || "Expert"}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {expert.city && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur-sm">
                    <MapPin className="h-3 w-3" /> {expert.city}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur-sm">
                  <Globe className="h-3 w-3" /> {modeLabel}
                </span>
                {expert.languages && expert.languages.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur-sm">
                    <Languages className="h-3 w-3" /> {expert.languages.join(", ")}
                  </span>
                )}
                {expert.reviewCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-400 ring-1 ring-amber-400/20">
                    <Star className="h-3 w-3 fill-amber-400" />
                    {expert.rating.toFixed(1)}
                    <span className="font-normal text-amber-400/70">({expert.reviewCount})</span>
                  </span>
                )}
              </div>
            </div>
            {/* Price callout — desktop */}
            <div className="hidden shrink-0 flex-col items-end gap-1 lg:flex">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Session fee</span>
              <span className="text-4xl font-black text-white">{formatInr(expert.sessionFee)}</span>
              {expert.sessionDurationMinutes && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Timer className="h-3 w-3" /> {expert.sessionDurationMinutes} min
                </span>
              )}
            </div>
          </div>
          {/* Sport / expertise tags */}
          {((expert.sports?.length ?? 0) > 0 || (expert.expertise?.length ?? 0) > 0) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {(expert.sports || []).map((s) => (
                <span key={s} className="rounded-full bg-power-orange/20 px-3 py-1 text-xs font-semibold text-power-orange ring-1 ring-power-orange/20">{s}</span>
              ))}
              {(expert.expertise || []).map((s) => (
                <span key={s} className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/10">{s}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
          {/* Left */}
          <div className="space-y-4">
            {expert.bio && (
              <SlideUp>
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Zap className="h-3.5 w-3.5 text-power-orange" /> About
                  </h2>
                  <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{expert.bio}</p>
                </div>
              </SlideUp>
            )}
            {expert.achievements && (
              <SlideUp>
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Award className="h-3.5 w-3.5 text-power-orange" /> Achievements
                  </h2>
                  <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{expert.achievements}</p>
                </div>
              </SlideUp>
            )}
            <FadeIn delay={0.1}>
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Star className="h-3.5 w-3.5 text-amber-400" /> Reviews
                  </h2>
                  {reviews.length > 0 && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                    </span>
                  )}
                </div>
                {reviews.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
                      <Star className="h-5 w-5 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">No reviews yet</p>
                    <p className="text-xs text-slate-400">Be the first to book a session and leave a review.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((r, i) => (
                      <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition-colors hover:bg-slate-50">
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-xs font-bold text-slate-600">
                            {(r.reviewerName || "A").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-slate-900">{r.reviewerName || "A player"}</span>
                              <span className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, s) => (
                                  <Star key={s} className={`h-3 w-3 ${s < Math.round(r.rating) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                                ))}
                              </span>
                            </div>
                            {r.review && (
                              <p className="mt-1.5 flex gap-1.5 text-sm leading-relaxed text-slate-600">
                                <Quote className="mt-0.5 h-3 w-3 shrink-0 text-slate-300" />
                                {r.review}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FadeIn>
          </div>

          {/* Right — booking */}
          <div className="lg:sticky lg:top-6">
            <FadeIn delay={0.15}>
              <div className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-100">
                {/* Header */}
                <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Session fee</p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-900">{formatInr(expert.sessionFee)}</span>
                        {expert.sessionDurationMinutes && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                            <Timer className="h-3 w-3" /> {expert.sessionDurationMinutes} min
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-power-orange/10">
                      <CalendarClock className="h-5 w-5 text-power-orange" />
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">Pick a time and pay securely to confirm your session.</p>
                </div>
                {/* Body */}
                <div className="space-y-5 p-6">
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <CalendarClock className="h-3 w-3 text-power-orange" /> Choose a time
                    </label>
                    <SlotPicker expertId={expertId} value={slot} onChange={setSlot} timezone={expert.timezone} />
                  </div>
                  {expert.sessionMode === "BOTH" && (
                    <div>
                      <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <Globe className="h-3 w-3 text-power-orange" /> Session mode
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["ONLINE", "IN_PERSON"] as ExpertSessionMode[]).map((m) => (
                          <button key={m} type="button" onClick={() => setMode(m)}
                            className={`rounded-xl border py-2.5 text-sm font-semibold transition-all ${mode === m ? "border-power-orange bg-orange-50 text-power-orange" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                            {m === "ONLINE" ? "Online" : "In-person"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {dependents.length > 0 && (
                    <div>
                      <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <Users className="h-3 w-3 text-power-orange" /> Who is this for?
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {dependents.map((dep) => (
                          <button key={dep._id} type="button"
                            onClick={() => setSelectedDependentId((prev) => prev === dep._id ? null : dep._id)}
                            className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ${selectedDependentId === dep._id ? "border-power-orange bg-power-orange/5 text-power-orange" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
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
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <MessageSquareText className="h-3 w-3 text-power-orange" /> What to discuss?{" "}
                      <span className="normal-case font-normal text-slate-400">(optional)</span>
                    </label>
                    <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Is football sustainable with his school schedule? Should we push for state trials?"
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700 placeholder-slate-400 transition-all focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                    />
                  </div>
                  <Button onClick={handleConnect} disabled={!slot} loading={connecting} fullWidth size="lg">
                    {slot ? `Book — Pay ${formatInr(expert.sessionFee)}` : "Select a time to continue"}
                  </Button>
                  <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    Secure payment via PhonePe
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>

      {selectedDependent && (
        <CompleteProfileNudge
          isOpen={traitsNudgeOpen}
          dependentId={selectedDependent._id}
          dependentName={selectedDependent.name}
          onProceed={() => {
            setTraitsNudgeOpen(false);
            proceedToPayment();
          }}
        />
      )}
    </div>
  );
}