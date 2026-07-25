"use client";

import {
    expertApi,
    type ExpertSession,
    type ExpertSessionGuidance,
    type ExpertSessionPlayerDetail,
} from "@/modules/expert/services/expert";
import { formatSessionTimeWithZone } from "@/modules/expert/utils/time";
import {
    AlertTriangle,
    ArrowLeft,
    Brain,
    Compass,
    HeartPulse,
    Home,
    Sparkles,
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
  informalReaction: {
    "kept-asking": "Kept asking to play more",
    "lost-interest": "Lost interest quickly",
  },
  futureFlexibility: {
    "all-in": "All-in on this sport",
    maybe: "Open, undecided",
    "stay-local": "Prefers to stay local",
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
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-slate-800">{value}</p>
    </div>
  );
}

function TagList({ label, values }: { label: string; values?: string[] }) {
  if (!values || values.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
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
    <div className="rounded-2xl border-0 bg-white p-6 shadow-[0_2px_16px_rgb(0,0,0,0.06)] transition-shadow hover:shadow-[0_8px_24px_rgb(0,0,0,0.1)]">
      <h2 className="mb-5 flex items-center gap-3 text-base font-bold text-slate-900">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tint}`}>
          {icon}
        </span>
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export default function ExpertSessionPlayerDetailPage() {
  const params = useParams();
  const sessionId = String(params.sessionId || "");

  const [session, setSession] = useState<ExpertSession | null>(null);
  const [player, setPlayer] = useState<ExpertSessionPlayerDetail | null>(null);
  const [guidance, setGuidance] = useState<ExpertSessionGuidance | null>(null);
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
          setGuidance(detailRes.data.guidance || null);
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

  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-3 px-6 py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-100 border-t-power-orange" />
        <p className="text-sm text-slate-500">Loading child profile...</p>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="font-semibold text-red-600">
          {error || "Child profile not available."}
        </p>
        <Link
          href="/expert/dashboard"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-power-orange hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-6 py-8">
      <Link
        href="/expert/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
        <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
          Booking briefing
        </span>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{player.name}</h1>
        <p className="mt-1 text-sm text-slate-200">
          {[
            player.age ? `${player.age} yrs` : null,
            player.gender ? GENDER_LABEL[player.gender] || player.gender : null,
            player.relation,
            formatDob(player.dob) ? `born ${formatDob(player.dob)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {session && (
          <p className="mt-3 text-sm text-slate-300">
            Session with {session.clientName || "the client"}
            {session.scheduledAt
              ? ` — ${formatSessionTimeWithZone(session.scheduledAt, session.expertTimezone)}`
              : ""}
          </p>
        )}
      </div>

      {/* Health & safety — surfaced first, deliberately */}
      {player.medicalConditions && player.medicalConditions.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <HeartPulse className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-900">
              Medical / health notes
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
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
      )}

      {/* Sport, skill & training */}
      <Section icon={<Target className="h-4.5 w-4.5" />} tint="bg-power-orange/10 text-power-orange" title="Sport & Skill">
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
            player.trainingMonths ? `${player.trainingMonths} months` : undefined
          }
        />
        <Field label="State" value={player.location} />
        <Field label="City (from wizard)" value={player.wizardCity} />
      </Section>

      {/* Physical profile — only shown if at least one of these was ever answered */}
      {(player.heightCm ||
        player.weightKg ||
        player.build ||
        player.heightCategory ||
        player.energyType ||
        player.motorType ||
        player.visualTracking ||
        player.agility ||
        player.eyesight) && (
        <Section icon={<Compass className="h-4.5 w-4.5" />} tint="bg-indigo-50 text-indigo-600" title="Physical Profile">
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
          <Field label="Eyesight" value={labelFor("eyesight", player.eyesight)} />
        </Section>
      )}

      {/* Personality & play style — only shown if at least one of these was ever answered */}
      {(player.teamIndividual ||
        player.competitiveResponse ||
        player.focusStyle ||
        player.decisionStyle ||
        player.pressureResponse ||
        player.repetitionTolerance ||
        player.contactComfort ||
        player.environment ||
        player.waterComfort ||
        player.personalityTags?.length) && (
        <Section icon={<Users className="h-4.5 w-4.5" />} tint="bg-purple-50 text-purple-600" title="Personality & Play Style">
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
            value={labelFor("competitiveResponse", player.competitiveResponse)}
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
            value={labelFor("repetitionTolerance", player.repetitionTolerance)}
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
          <TagList label="Personality tags" values={player.personalityTags} />
        </Section>
      )}

      {/* Background & exposure */}
      {(player.sportsInFamily?.length ||
        player.peerSports?.length ||
        player.informalSports?.length ||
        player.informalReaction ||
        player.futureFlexibility) && (
        <Section icon={<Home className="h-4.5 w-4.5" />} tint="bg-teal-50 text-teal-600" title="Background & Exposure">
          <TagList
            label="Played seriously by immediate family"
            values={player.sportsInFamily}
          />
          <TagList
            label="Played seriously by close friends"
            values={player.peerSports}
          />
          <TagList
            label="Tried casually, just for fun"
            values={player.informalSports}
          />
          <Field
            label="Kept asking to play again, or lost interest?"
            value={labelFor("informalReaction", player.informalReaction)}
          />
          <Field
            label="Open to relocating / investing more if talent shows?"
            value={labelFor("futureFlexibility", player.futureFlexibility)}
          />
        </Section>
      )}

      {/* Sport fit matches */}
      {player.sportMatches && player.sportMatches.length > 0 && (
        <Section icon={<Sparkles className="h-4.5 w-4.5" />} tint="bg-amber-50 text-amber-600" title="Sport Fit Matches">
          {player.sportMatches.map((m) => (
            <Field
              key={m.sport}
              label={m.sport}
              value={`${m.fitLabel} (score ${m.score})`}
            />
          ))}
        </Section>
      )}

      {/* AI guidance roadmap */}
      {guidance && (
        <div className="rounded-2xl border border-power-orange/30 bg-power-orange/5 p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
            <Brain className="h-5 w-5 text-power-orange" /> AI Guidance Roadmap
          </h2>
          <div className="space-y-4">
            {guidance.profileAnalysis && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Profile analysis
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-800">
                  {guidance.profileAnalysis}
                </p>
              </div>
            )}
            {guidance.idealCoachingStyle && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Ideal coaching style
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-800">
                  {guidance.idealCoachingStyle}
                </p>
              </div>
            )}
            {guidance.weeklyBlueprint && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  label="Training hours"
                  value={guidance.weeklyBlueprint.trainingHours}
                />
                <Field
                  label="Free play hours"
                  value={guidance.weeklyBlueprint.freePlayHours}
                />
                <Field label="Rest days" value={guidance.weeklyBlueprint.restDays} />
              </div>
            )}
            <TagList label="Recommended sports" values={guidance.recommendedSports} />
            <TagList label="Talent identifiers" values={guidance.talentIdentifiers} />
            {guidance.mentalSkillsRoadmap?.currentFocus && (
              <Field
                label="Current mental-skills focus"
                value={guidance.mentalSkillsRoadmap.currentFocus}
              />
            )}
            {guidance.mentalSkillsRoadmap?.skills &&
              guidance.mentalSkillsRoadmap.skills.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Mental skills to develop
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-slate-800">
                    {guidance.mentalSkillsRoadmap.skills.map((s, i) => (
                      <li key={i}>
                        <span className="font-semibold">{s.skill}</span>
                        {s.howToDevelop ? ` — ${s.howToDevelop}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            {guidance.multiSportAdvisory && (
              <Field label="Multi-sport advisory" value={guidance.multiSportAdvisory} />
            )}
            {guidance.goalAssessment?.statedGoal && (
              <div className="rounded-xl bg-white p-4 ring-1 ring-inset ring-slate-200">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Goal assessment
                </p>
                <p className="mt-1 text-sm text-slate-800">
                  <span className="font-semibold">
                    {guidance.goalAssessment.statedGoal}
                  </span>
                  {guidance.goalAssessment.verdict
                    ? ` — ${guidance.goalAssessment.verdict}`
                    : ""}
                </p>
                {guidance.goalAssessment.rationale && (
                  <p className="mt-1 text-sm text-slate-600">
                    {guidance.goalAssessment.rationale}
                  </p>
                )}
              </div>
            )}
            {guidance.burnoutRisk?.level && (
              <div
                className={`flex items-start gap-2 rounded-xl p-4 ${
                  guidance.burnoutRisk.level === "high"
                    ? "bg-red-50 ring-1 ring-inset ring-red-200"
                    : guidance.burnoutRisk.level === "medium"
                      ? "bg-amber-50 ring-1 ring-inset ring-amber-200"
                      : "bg-emerald-50 ring-1 ring-inset ring-emerald-200"
                }`}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div>
                  <p className="text-sm font-semibold capitalize text-slate-800">
                    {guidance.burnoutRisk.level} burnout risk
                  </p>
                  {guidance.burnoutRisk.message && (
                    <p className="mt-1 text-sm text-slate-600">
                      {guidance.burnoutRisk.message}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
