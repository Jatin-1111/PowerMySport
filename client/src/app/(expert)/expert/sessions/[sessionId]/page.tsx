"use client";

import {
    expertApi,
    type ExpertSession,
    type ExpertSessionPlayerDetail,
} from "@/modules/expert/services/expert";
import { formatSessionTimeWithZone } from "@/modules/expert/utils/time";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { FadeIn } from "@/modules/shared/ui/motion/FadeIn";
import {
    StaggerContainer,
    StaggerItem,
} from "@/modules/shared/ui/motion/StaggerContainer";
import {
    ArrowLeft,
    CalendarClock,
    Compass,
    HeartPulse,
    Target,
    Users,
} from "lucide-react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

const GENDER_LABEL: Record<string, string> = {
  MALE: "Boy",
  FEMALE: "Girl",
  OTHER: "Other",
};

const LABELS: Record<string, Record<string, string>> = {
  primaryObjective: {
    Recreational: "Recreational — just for fun & fitness",
    Fitness: "Fitness-focused",
    Compete: "Wants to compete",
  },
  budgetTier: { Budget: "Budget", Moderate: "Moderate", Premium: "Premium" },
  budgetRange: {
    "under-3k": "Under ₹3,000/mo",
    "3k-7k": "₹3,000–7,000/mo",
    "7k-15k": "₹7,000–15,000/mo",
    "15k-plus": "₹15,000+/mo",
  },
  build: { lean: "Lean", average: "Average build", stocky: "Stocky" },
  heightCategory: { short: "Short", average: "Average height", tall: "Tall" },
  energyType: { explosive: "Explosive energy", endurance: "Endurance-built" },
  motorType: { gross: "Gross motor skills", fine: "Fine motor skills" },
  visualTracking: {
    strong: "Strong visual tracking",
    moderate: "Moderate visual tracking",
    weak: "Weak visual tracking",
  },
  competitiveResponse: {
    "fired-up": "Fires up after a loss",
    calm: "Stays calm after a loss",
    discouraged: "Needs time after a loss",
  },
  focusStyle: {
    bursts: "Focuses in short bursts",
    sustained: "Sustained focus",
  },
  decisionStyle: {
    react: "Reactive decision-maker",
    strategic: "Strategic decision-maker",
  },
  pressureResponse: {
    thrives: "Thrives under pressure",
    manages: "Manages pressure well",
    avoids: "Avoids the spotlight",
  },
  repetitionTolerance: {
    high: "High tolerance for repetition/drills",
    low: "Low tolerance for repetition/drills",
  },
  contactComfort: {
    loves: "Loves physical contact",
    neutral: "Neutral on physical contact",
    avoids: "Avoids physical contact",
  },
  environment: {
    outdoor: "Prefers outdoor",
    indoor: "Prefers indoor",
    "no-preference": "No environment preference",
  },
  waterComfort: {
    comfortable: "Comfortable in water",
    neutral: "Neutral on water",
    uncomfortable: "Uncomfortable in water",
  },
  ambition: {
    fun: "Health & fun",
    competitive: "Competitive",
    national: "National-level ambition",
    professional: "Professional/pro career ambition",
  },
  eyesight: {
    sharp: "Sharp eyesight",
    corrected: "Corrected vision (glasses/lenses)",
    limited: "Limited eyesight",
  },
  agility: { high: "High agility", moderate: "Moderate agility", low: "Low agility" },
  weeklyHoursCategory: {
    "1-3": "1–3 hrs/week",
    "4-7": "4–7 hrs/week",
    "8-12": "8–12 hrs/week",
    "13-plus": "13+ hrs/week",
  },
  experienceLevel: {
    beginner: "Beginner",
    intermediate: "Intermediate",
    competitive: "Competitive level",
  },
  trainingType: {
    self: "Self-trained",
    club: "Club training",
    academy: "Academy training",
    private: "Private coaching",
  },
};

const labelFor = (field: string, value?: string | null) =>
  (value && LABELS[field]?.[value]) || value || undefined;

const tierLabel = (n?: number) => (n ? `${n} / 5` : undefined);

const formatDob = (iso?: string | null) => {
  if (!iso) return undefined;
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return undefined;
  }
};

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="-mx-2.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-slate-50">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium leading-snug text-slate-800">
        {value}
      </p>
    </div>
  );
}

function TagList({ label, values }: { label: string; values?: string[] }) {
  if (!values || values.length === 0) return null;
  return (
    <div className="-mx-2.5 rounded-lg px-2.5 py-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200"
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function Section({
  icon,
  tint,
  title,
  children,
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_2px_16px_rgb(0,0,0,0.06)] transition-shadow hover:shadow-[0_8px_24px_rgb(0,0,0,0.1)]">
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ${tint}`}
        >
          {icon}
        </span>
        <h2 className="text-base font-bold tracking-tight text-slate-900">
          {title}
        </h2>
      </div>
      <div className="grid gap-1 p-6 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function StatTile({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Skeleton className="mb-6 h-5 w-32" />
      <div className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_2px_16px_rgb(0,0,0,0.06)]">
        <Skeleton className="h-36 w-full rounded-none" />
        <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
      <div className="mt-5 space-y-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border-0 bg-white p-6 shadow-[0_2px_16px_rgb(0,0,0,0.06)]"
          >
            <Skeleton className="mb-5 h-9 w-44 rounded-xl" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-10 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExpertSessionPlayerDetailPage() {
  const params = useParams();
  const sessionId = String(params.sessionId || "");

  const [session, setSession] = useState<ExpertSession | null>(null);
  const [player, setPlayer] = useState<ExpertSessionPlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [sessionRes, detailRes] = await Promise.all([
          expertApi.getSession(sessionId),
          expertApi.getSessionPlayerDetail(sessionId),
        ]);
        if (sessionRes.success && sessionRes.data) setSession(sessionRes.data);
        if (detailRes.success && detailRes.data) {
          setPlayer(detailRes.data.player);
        } else {
          setError(detailRes.message || "Failed to load child profile.");
        }
      } catch (err: unknown) {
        setError(
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "Failed to load child profile.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  if (loading) return <ProfileSkeleton />;

  if (error || !player) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="font-semibold text-red-600">
          {error || "Child profile not available."}
        </p>
        <Link
          href="/expert/dashboard"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-power-orange px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </div>
    );
  }

  const initial = (player.name || "?").charAt(0).toUpperCase();
  const metaLine = [
    player.age ? `${player.age} yrs` : null,
    player.gender ? GENDER_LABEL[player.gender] || player.gender : null,
    player.relation,
    formatDob(player.dob) ? `born ${formatDob(player.dob)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const hasPhysical = Boolean(
    player.heightCm ||
      player.weightKg ||
      player.build ||
      player.heightCategory ||
      player.energyType ||
      player.motorType ||
      player.visualTracking ||
      player.agility ||
      player.eyesight,
  );
  const hasPersonality = Boolean(
    player.teamIndividual ||
      player.competitiveResponse ||
      player.focusStyle ||
      player.decisionStyle ||
      player.pressureResponse ||
      player.repetitionTolerance ||
      player.contactComfort ||
      player.environment ||
      player.waterComfort ||
      player.personalityTags?.length,
  );
  return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/expert/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-power-orange"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        {/* Hero — identity + quick facts */}
        <FadeIn>
          <div className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_2px_16px_rgb(0,0,0,0.06)]">
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-8 text-white sm:px-8">
              <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-power-orange/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
              <span className="relative inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70 ring-1 ring-inset ring-white/10">
                Booking briefing
              </span>
              <div className="relative mt-4 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white/10 bg-white/10 text-2xl font-bold text-white/80">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-title truncate text-2xl font-bold sm:text-3xl">
                    {player.name}
                  </h1>
                  {metaLine && (
                    <p className="mt-1 truncate text-sm text-white/60">
                      {metaLine}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick facts strip */}
            <div className="grid grid-cols-2 gap-5 border-b border-slate-100 px-6 py-5 sm:grid-cols-4 sm:px-8">
              <StatTile label="Skill level" value={player.skillLevel || "—"} />
              <StatTile
                label="Goal"
                value={
                  labelFor("ambition", player.ambition) ||
                  labelFor("primaryObjective", player.primaryObjective) ||
                  "—"
                }
              />
              <StatTile
                label="Budget"
                value={
                  labelFor("budgetRange", player.budgetRange) ||
                  labelFor("budgetTier", player.budgetTier) ||
                  "—"
                }
              />
              <StatTile
                label="Commitment"
                value={
                  labelFor("weeklyHoursCategory", player.weeklyHoursCategory) ||
                  (player.weeklyTimeCommitment
                    ? `${player.weeklyTimeCommitment} hrs/wk`
                    : "—")
                }
              />
            </div>

            {session && (
              <div className="flex flex-wrap items-center gap-2 px-6 py-4 text-sm text-slate-600 sm:px-8">
                <CalendarClock className="h-4 w-4 shrink-0 text-power-orange" />
                Session with{" "}
                <span className="font-semibold text-slate-900">
                  {session.clientName || "the client"}
                </span>
                {session.scheduledAt && (
                  <span className="text-slate-400">
                    ·{" "}
                    {formatSessionTimeWithZone(
                      session.scheduledAt,
                      session.expertTimezone,
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
        </FadeIn>

        {/* Health & safety — surfaced first, deliberately */}
        {player.medicalConditions && player.medicalConditions.length > 0 && (
          <FadeIn delay={0.05}>
            <div className="mt-5 flex items-start gap-3.5 rounded-2xl border border-amber-200/70 bg-amber-50 p-5 shadow-[0_2px_16px_rgb(0,0,0,0.04)]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-sm">
                <HeartPulse className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-amber-900">
                  Medical / health notes
                </p>
                <p className="text-xs text-amber-700/80">
                  Factor this in before recommending drills or intensity.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {player.medicalConditions.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>
        )}

        <StaggerContainer className="mt-5 space-y-5">
          {/* Sport, skill & training */}
          <StaggerItem>
            <Section
              icon={<Target className="h-4.5 w-4.5" />}
              tint="bg-power-orange/10 text-power-orange"
              title="Sport & Skill"
            >
              <TagList label="Sport(s)" values={player.sportsFocus} />
              <Field label="Skill level" value={player.skillLevel} />
              <Field label="Years playing" value={player.yearsPlaying} />
              <Field
                label="Current competitive level"
                value={labelFor("experienceLevel", player.experienceLevel)}
              />
              <Field
                label="Current standing (this sport's ladder)"
                value={tierLabel(player.currentStandingTier)}
              />
              <Field
                label="Best result achieved so far"
                value={tierLabel(player.bestResultTier)}
              />
              <Field
                label="“Anything else you'd like to share?”"
                value={player.achievementsNote}
              />
              <Field
                label="Recreational, fitness, or competitive?"
                value={labelFor("primaryObjective", player.primaryObjective)}
              />
              <Field
                label="What's the honest goal right now?"
                value={labelFor("ambition", player.ambition)}
              />
              <Field
                label="Hours per week they can commit"
                value={
                  labelFor("weeklyHoursCategory", player.weeklyHoursCategory) ||
                  (player.weeklyTimeCommitment
                    ? `${player.weeklyTimeCommitment} hrs/week`
                    : undefined)
                }
              />
              <Field
                label="Monthly training budget"
                value={
                  labelFor("budgetRange", player.budgetRange) ||
                  labelFor("budgetTier", player.budgetTier)
                }
              />
              <Field
                label="How are they currently training?"
                value={labelFor("trainingType", player.trainingType)}
              />
              <Field label="Academy / coach" value={player.academyName} />
              <Field label="Sessions per week" value={player.sessionsPerWeek} />
              <Field
                label="Time with this academy/coach"
                value={
                  player.trainingMonths
                    ? `${player.trainingMonths} months`
                    : undefined
                }
              />
              <Field label="State" value={player.location} />
              <Field label="City (from wizard)" value={player.wizardCity} />
            </Section>
          </StaggerItem>

          {/* Physical profile — only shown if at least one of these was ever answered */}
          {hasPhysical && (
            <StaggerItem>
              <Section
                icon={<Compass className="h-4.5 w-4.5" />}
                tint="bg-indigo-50 text-indigo-600"
                title="Physical Profile"
              >
                <Field
                  label="Height"
                  value={player.heightCm ? `${player.heightCm} cm` : undefined}
                />
                <Field
                  label="Weight"
                  value={player.weightKg ? `${player.weightKg} kg` : undefined}
                />
                <Field label="Build" value={labelFor("build", player.build)} />
                <Field
                  label="Height category"
                  value={labelFor("heightCategory", player.heightCategory)}
                />
                <Field
                  label="In a running/tag game, they usually…"
                  value={labelFor("energyType", player.energyType)}
                />
                <Field
                  label="Better at running/jumping/throwing, or careful/steady-handed tasks?"
                  value={labelFor("motorType", player.motorType)}
                />
                <Field
                  label="Reaction to a fast-moving ball/shuttle"
                  value={labelFor("visualTracking", player.visualTracking)}
                />
                <Field
                  label="Agility & flexibility"
                  value={labelFor("agility", player.agility)}
                />
                <Field
                  label="Eyesight"
                  value={labelFor("eyesight", player.eyesight)}
                />
              </Section>
            </StaggerItem>
          )}

          {/* Personality & play style — only shown if at least one of these was ever answered */}
          {hasPersonality && (
            <StaggerItem>
              <Section
                icon={<Users className="h-4.5 w-4.5" />}
                tint="bg-purple-50 text-purple-600"
                title="Personality & Play Style"
              >
                <Field
                  label="Wants a partner/team, or goes it alone?"
                  value={
                    player.teamIndividual
                      ? `${player.teamIndividual}/5 (1 = solo, 5 = always team)`
                      : undefined
                  }
                />
                <Field
                  label="After losing a game, they…"
                  value={labelFor(
                    "competitiveResponse",
                    player.competitiveResponse,
                  )}
                />
                <Field
                  label="Doing homework/a puzzle, they tend to…"
                  value={labelFor("focusStyle", player.focusStyle)}
                />
                <Field
                  label="Trying a new game for the first time, they…"
                  value={labelFor("decisionStyle", player.decisionStyle)}
                />
                <Field
                  label="When all attention is on them…"
                  value={labelFor("pressureResponse", player.pressureResponse)}
                />
                <Field
                  label="Willing to repeat the same drill for months?"
                  value={labelFor(
                    "repetitionTolerance",
                    player.repetitionTolerance,
                  )}
                />
                <Field
                  label="Comfort with physical contact"
                  value={labelFor("contactComfort", player.contactComfort)}
                />
                <Field
                  label="Given a free afternoon, gravitates to…"
                  value={labelFor("environment", player.environment)}
                />
                <Field
                  label="Comfort in water"
                  value={labelFor("waterComfort", player.waterComfort)}
                />
                <TagList
                  label="Personality tags"
                  values={player.personalityTags}
                />
              </Section>
            </StaggerItem>
          )}

        </StaggerContainer>
      </div>
  );
}
