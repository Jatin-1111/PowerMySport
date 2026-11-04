"use client";

import api from "@/lib/api/axios";
import { useAuthStore } from "@/modules/auth/store/authStore";
import ParentExperiencesBand from "@/modules/community/components/ParentExperiencesBand";
import {
  DetailSkeleton,
  ExpertPortrait,
  RatingStars,
} from "@/modules/expert/components/ExpertProfileParts";
import { SlotPicker } from "@/modules/expert/components/SlotPicker";
import {
  expertApi,
  type Expert,
  type ExpertReview,
  type ExpertSessionMode,
} from "@/modules/expert/services/expert";
import {
  CompleteProfileNudge,
  shouldShowTraitsNudge,
} from "@/modules/player/components/CompleteProfileNudge";
import { Button } from "@/modules/shared/ui/Button";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { FadeIn } from "@/modules/shared/ui/motion/FadeIn";
import { SlideUp } from "@/modules/shared/ui/motion/SlideUp";
import { ArrowLeft, CalendarCheck, Check, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface DependentOption {
  _id: string;
  name: string;
}

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/**
 * `initialExpert` is the profile the server page already fetched. Rendering it on
 * the first pass puts the profile in the HTML for crawlers and for a visitor
 * before JavaScript runs; without it the page shipped only a skeleton.
 */
export function ExpertDetailClient({ initialExpert = null }: { initialExpert?: Expert | null }) {
  const params = useParams();
  const router = useRouter();
  const expertId = String(params?.expertId || "");
  const user = useAuthStore((s) => s.user);

  const [expert, setExpert] = useState<Expert | null>(initialExpert);
  const [reviews, setReviews] = useState<ExpertReview[]>([]);
  const [loading, setLoading] = useState(!initialExpert);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [mode, setMode] = useState<ExpertSessionMode>(
    initialExpert?.sessionMode === "IN_PERSON" ? "IN_PERSON" : "ONLINE"
  );
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
        const deps = res.data.data;
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
          setNote(
            (prev) => prev || (brief!.issueLabel ? `Here to help with: ${brief!.issueLabel}` : prev)
          );
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
      // Keep showing the server-rendered profile while it refreshes.
      if (!initialExpert) setLoading(true);
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
  }, [expertId, initialExpert]);

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
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not start payment.";
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

  type Fact = { label: string; value: string };
  const facts = [
    expert.city ? { label: "Based in", value: expert.city } : null,
    { label: "Format", value: modeLabel },
    expert.languages && expert.languages.length > 0
      ? { label: "Languages", value: expert.languages.join(", ") }
      : null,
    expert.sessionDurationMinutes
      ? { label: "Session length", value: `${expert.sessionDurationMinutes} minutes` }
      : null,
  ].filter((f): f is Fact => f !== null);

  const focus = [
    expert.sports && expert.sports.length > 0
      ? { label: "Sports", value: expert.sports.join(", ") }
      : null,
    expert.expertise && expert.expertise.length > 0
      ? { label: "Expertise", value: expert.expertise.join(", ") }
      : null,
  ].filter((f): f is Fact => f !== null);

  const sectionHeading = "font-editorial text-ink mb-4 text-2xl font-normal sm:text-3xl";
  const fieldLabel = "text-ink mb-2.5 block text-sm font-medium";
  const choice = (active: boolean) =>
    `focus-visible:ring-ink rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 ${
      active
        ? "border-ink bg-paper-deep text-ink"
        : "border-hairline text-ink-body hover:border-ink/40 bg-white"
    }`;

  return (
    <div className="bg-paper min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <nav aria-label="Expert pages" className="mb-10 flex items-center justify-between text-sm">
          <Link
            href="/booking?tab=experts"
            className="text-ink-body hover:text-ink focus-visible:ring-ink group inline-flex items-center gap-1.5 rounded font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2"
          >
            <ArrowLeft
              aria-hidden
              strokeWidth={1.5}
              className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transition-none"
            />
            All experts
          </Link>
          <Link
            href="/experts/sessions"
            className="text-ink-body hover:text-ink hover:decoration-ink decoration-ink/30 focus-visible:ring-ink inline-flex items-center gap-1.5 rounded font-medium underline underline-offset-4 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2"
          >
            <CalendarCheck aria-hidden strokeWidth={1.5} className="h-4 w-4" />
            My sessions
          </Link>
        </nav>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-16">
          {/* Profile */}
          <div className="min-w-0">
            <header className="flex flex-col gap-8 sm:flex-row sm:items-end">
              <ExpertPortrait expert={expert} />
              <div className="min-w-0">
                <p className="text-ink-muted mb-3 flex items-center gap-1.5 text-sm font-medium">
                  <Check aria-hidden strokeWidth={2} className="text-ink h-4 w-4" />
                  Verified expert
                </p>
                <h1 className="font-editorial text-ink text-balance text-4xl font-light leading-[1.05] sm:text-5xl lg:text-6xl">
                  {expert.name || "Expert"}
                </h1>
                {expert.reviewCount > 0 && (
                  <p className="text-ink-body mt-4 flex items-center gap-2 text-sm">
                    <RatingStars value={expert.rating} />
                    <span className="text-ink font-semibold tabular-nums">
                      {expert.rating.toFixed(1)}
                    </span>
                    <span className="text-ink-muted">
                      ({expert.reviewCount} {expert.reviewCount === 1 ? "review" : "reviews"})
                    </span>
                  </p>
                )}
                {/* On small screens the booking panel sits below the profile; this
                    takes the visitor straight to it. */}
                <Button asChild size="md" className="mt-6 lg:hidden">
                  <a href="#book">Book a session · {formatInr(expert.sessionFee)}</a>
                </Button>
              </div>
            </header>

            <dl className="border-hairline mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-y py-6 sm:grid-cols-4">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-ink-muted text-sm">{f.label}</dt>
                  <dd className="text-ink mt-1 text-pretty font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>

            {focus.length > 0 && (
              <dl className="mt-6 space-y-4">
                {focus.map((f) => (
                  <div key={f.label} className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-6">
                    <dt className="text-ink-muted text-sm">{f.label}</dt>
                    <dd className="text-ink text-pretty">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {expert.bio && (
              <SlideUp>
                <section className="mt-16" aria-labelledby="about-heading">
                  <h2 id="about-heading" className={sectionHeading}>
                    About
                  </h2>
                  <p className="text-ink-body max-w-[65ch] whitespace-pre-line text-base leading-relaxed sm:text-lg">
                    {expert.bio}
                  </p>
                </section>
              </SlideUp>
            )}

            {expert.achievements && (
              <SlideUp>
                <section className="mt-14" aria-labelledby="achievements-heading">
                  <h2 id="achievements-heading" className={sectionHeading}>
                    Achievements
                  </h2>
                  <p className="text-ink-body max-w-[65ch] whitespace-pre-line text-base leading-relaxed sm:text-lg">
                    {expert.achievements}
                  </p>
                </section>
              </SlideUp>
            )}

            <FadeIn delay={0.1}>
              <section className="mt-14" aria-labelledby="reviews-heading">
                <h2 id="reviews-heading" className={sectionHeading}>
                  Reviews
                </h2>
                {reviews.length === 0 ? (
                  <p className="text-ink-body max-w-[52ch] text-pretty">
                    No reviews yet. Reviews appear here after a parent completes a session.
                  </p>
                ) : (
                  <>
                    {expert.reviewCount > 0 && (
                      <p className="mb-6 flex items-baseline gap-3">
                        <span className="font-editorial text-ink text-5xl font-light tabular-nums">
                          {expert.rating.toFixed(1)}
                        </span>
                        <span className="text-ink-muted text-sm">
                          from {expert.reviewCount}{" "}
                          {expert.reviewCount === 1 ? "review" : "reviews"}
                        </span>
                      </p>
                    )}
                    <ul className="border-hairline border-t">
                      {reviews.map((r, i) => (
                        <li key={i} className="border-hairline border-b py-6">
                          <div className="flex items-baseline justify-between gap-4">
                            <p className="text-ink font-semibold">{r.reviewerName || "A parent"}</p>
                            <RatingStars value={r.rating} />
                          </div>
                          {r.review && (
                            <p className="text-ink-body mt-2 max-w-[65ch] text-pretty leading-relaxed">
                              {r.review}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </FadeIn>

            <div className="mt-16">
              <ParentExperiencesBand
                kind="EXPERT"
                refId={expertId}
                name={expert.name || "this expert"}
              />
            </div>
          </div>

          {/* Booking */}
          <aside
            id="book"
            aria-label="Book a session"
            className="min-w-0 scroll-mt-24 lg:top-24 lg:[@media(min-height:860px)]:sticky"
          >
            <FadeIn delay={0.15}>
              <div className="border-hairline overflow-hidden rounded-2xl border bg-white">
                <div className="border-hairline border-b p-6 sm:p-8">
                  <p className="text-ink-muted text-sm">Session fee</p>
                  <p className="mt-1 flex items-baseline gap-3">
                    <span className="font-editorial text-ink text-5xl font-light tabular-nums">
                      {formatInr(expert.sessionFee)}
                    </span>
                    {expert.sessionDurationMinutes && (
                      <span className="text-ink-muted text-sm">
                        for {expert.sessionDurationMinutes} min
                      </span>
                    )}
                  </p>
                  <p className="text-ink-body mt-3 text-sm leading-relaxed">
                    Pick a time and pay securely to confirm your session.
                  </p>
                </div>

                <div className="space-y-7 p-6 sm:p-8">
                  <div role="group" aria-labelledby="slot-label">
                    <span id="slot-label" className={fieldLabel}>
                      Choose a time
                    </span>
                    <SlotPicker
                      expertId={expertId}
                      value={slot}
                      onChange={setSlot}
                      timezone={expert.timezone}
                    />
                  </div>

                  {expert.sessionMode === "BOTH" && (
                    <div role="group" aria-labelledby="mode-label">
                      <span id="mode-label" className={fieldLabel}>
                        Session mode
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {(["ONLINE", "IN_PERSON"] as ExpertSessionMode[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            aria-pressed={mode === m}
                            onClick={() => setMode(m)}
                            className={choice(mode === m)}
                          >
                            {m === "ONLINE" ? "Online" : "In-person"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {dependents.length > 0 && (
                    <div role="group" aria-labelledby="who-label">
                      <span id="who-label" className={fieldLabel}>
                        Who is this for?
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {dependents.map((dep) => (
                          <button
                            key={dep._id}
                            type="button"
                            aria-pressed={selectedDependentId === dep._id}
                            onClick={() =>
                              setSelectedDependentId((prev) => (prev === dep._id ? null : dep._id))
                            }
                            className={choice(selectedDependentId === dep._id)}
                          >
                            {dep.name}
                          </button>
                        ))}
                      </div>
                      {selectedDependentId && (
                        <p className="text-ink-muted mt-3 flex items-start gap-2 text-sm leading-relaxed">
                          <Sparkles
                            aria-hidden
                            strokeWidth={1.5}
                            className="mt-0.5 h-4 w-4 shrink-0"
                          />
                          <span>
                            We&apos;ll share {selectedDependent?.name}&apos;s sport profile with the
                            expert so they&apos;re ready for your call.
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label htmlFor="expert-note" className={fieldLabel}>
                      What would you like to discuss?{" "}
                      <span className="text-ink-muted font-normal">(optional)</span>
                    </label>
                    <textarea
                      id="expert-note"
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Is football sustainable with his school schedule? Should we push for state trials?"
                      className="border-hairline text-ink placeholder:text-ink-muted focus-visible:ring-ink w-full resize-none rounded-lg border bg-white px-3.5 py-3 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2"
                    />
                  </div>

                  <div>
                    <Button
                      onClick={handleConnect}
                      disabled={!slot}
                      loading={connecting}
                      fullWidth
                      size="lg"
                    >
                      {slot
                        ? `Book for ${formatInr(expert.sessionFee)}`
                        : "Select a time to continue"}
                    </Button>
                    <p className="text-ink-muted mt-3 flex items-center justify-center gap-1.5 text-sm">
                      <ShieldCheck aria-hidden strokeWidth={1.5} className="h-4 w-4" />
                      Secure payment via PhonePe
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>
          </aside>
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
