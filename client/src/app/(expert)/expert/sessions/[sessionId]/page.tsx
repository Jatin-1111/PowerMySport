"use client";

import {
  expertApi,
  type ExpertSession,
  type ExpertSessionPlayerDetail,
} from "@/modules/expert/services/expert";
import { formatSessionTimeWithZone } from "@/modules/expert/utils/time";
import { ProfileSection } from "@/modules/shared/components/settings/ProfileSection";
import { FIGURE_GRID, FigureGridSkeleton } from "@/modules/shared/ui/FigureGrid";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { StatTile } from "@/modules/shared/ui/StatTile";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";
import { deriveBodyCategories } from "@/modules/find-sport/utils/dependentMapping";
import Link from "next/link";
import { useEffect, useState } from "react";

const GENDER_LABEL: Record<string, string> = {
  MALE: "Boy",
  FEMALE: "Girl",
  OTHER: "Other",
};

const LABELS: Record<string, Record<string, string>> = {
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

/** One answer as a ruled row: the question on the left, the answer on the right. */
function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="border-hairline grid gap-x-8 gap-y-1 border-b py-3.5 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      <dt className="text-ink-body text-sm">{label}</dt>
      <dd className="text-ink min-w-0 break-words font-medium">{value}</dd>
    </div>
  );
}

function TagList({ label, values }: { label: string; values?: string[] }) {
  if (!values || values.length === 0) return null;
  return <Field label={label} value={values.join(", ")} />;
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <ProfileSection id={id} title={title}>
      <dl className="border-hairline border-t">{children}</dl>
    </ProfileSection>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-10" role="status" aria-busy="true">
      <span className="sr-only">Loading the child profile</span>
      <div aria-hidden="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-11 w-64" />
        <Skeleton className="mt-3 h-4 w-48" />
      </div>
      <div aria-hidden="true">
        <FigureGridSkeleton />
      </div>
      <Skeleton aria-hidden="true" className="h-56 w-full" />
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
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            "Failed to load child profile."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  if (loading) return <ProfileSkeleton />;

  if (error || !player) {
    return (
      <div role="alert" className="bg-paper-deep max-w-xl rounded-2xl p-6 sm:p-8">
        <h1 className="font-editorial text-ink text-3xl font-light tracking-tight">
          We could not load this child profile
        </h1>
        <p className="text-ink-body mt-3 text-pretty">{error || "Child profile not available."}</p>
        <p className="mt-6">
          <Link href="/expert/sessions" className={`${TEXT_LINK} ring-offset-paper-deep`}>
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            Back to sessions
          </Link>
        </p>
      </div>
    );
  }

  const metaLine = [
    player.age ? `${player.age} years` : null,
    player.gender ? GENDER_LABEL[player.gender] || player.gender : null,
    player.relation,
    formatDob(player.dob) ? `born ${formatDob(player.dob)}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const body = deriveBodyCategories(player.heightCm, player.weightKg, player.age ?? null);
  const hasPhysical = Boolean(
    player.heightCm ||
    player.weightKg ||
    body.build ||
    body.heightCategory ||
    player.energyType ||
    player.motorType ||
    player.visualTracking ||
    player.agility ||
    player.eyesight
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
    player.personalityTags?.length
  );

  return (
    <div className="space-y-10 sm:space-y-12">
      <header>
        <p>
          <Link href="/expert/sessions" className={`${TEXT_LINK} ring-offset-paper text-sm`}>
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            Back to sessions
          </Link>
        </p>
        <p className="text-ink-body mt-6 text-sm">Booking briefing</p>
        <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
          {player.name}
        </h1>
        {metaLine && <p className="text-ink-body mt-3">{metaLine}</p>}
        {session && (
          <p className="text-ink-body mt-1 text-pretty">
            Session with {session.clientName || "the client"}
            {session.scheduledAt &&
              `, ${formatSessionTimeWithZone(session.scheduledAt, session.expertTimezone)}`}
          </p>
        )}
      </header>

      <div className={FIGURE_GRID}>
        <StatTile
          emphasis
          label="Experience"
          value={
            <span className="text-2xl">
              {labelFor("experienceLevel", player.experienceLevel) || "Not answered"}
            </span>
          }
        />
        <StatTile
          label="Goal"
          value={
            <span className="text-2xl">
              {labelFor("ambition", player.ambition) || "Not answered"}
            </span>
          }
        />
        <StatTile
          label="Budget"
          value={
            <span className="text-2xl">
              {labelFor("budgetRange", player.budgetRange) || "Not answered"}
            </span>
          }
        />
        <StatTile
          label="Commitment"
          value={
            <span className="text-2xl">
              {labelFor("weeklyHoursCategory", player.weeklyHoursCategory) || "Not answered"}
            </span>
          }
        />
      </div>

      <div>
        <Section id="sport" title="Sport and skill">
          <TagList label="Sports" values={player.sportsFocus} />
          <Field label="Years playing" value={player.yearsPlaying} />
          <Field
            label="Current competitive level"
            value={labelFor("experienceLevel", player.experienceLevel)}
          />
          <Field
            label="Current standing (this sport's ladder)"
            value={tierLabel(player.currentStandingTier)}
          />
          <Field label="The honest goal right now" value={labelFor("ambition", player.ambition)} />
          <Field
            label="Hours per week they can commit"
            value={labelFor("weeklyHoursCategory", player.weeklyHoursCategory)}
          />
          <Field
            label="Monthly training budget"
            value={labelFor("budgetRange", player.budgetRange)}
          />
          <Field
            label="How they are training now"
            value={labelFor("trainingType", player.trainingType)}
          />
          <Field label="State" value={player.location} />
        </Section>

        {/* Only shown if at least one of these was ever answered */}
        {hasPhysical && (
          <Section id="physical" title="Physical profile">
            <Field label="Height" value={player.heightCm ? `${player.heightCm} cm` : undefined} />
            <Field label="Weight" value={player.weightKg ? `${player.weightKg} kg` : undefined} />
            <Field label="Build" value={labelFor("build", body.build)} />
            <Field
              label="Height category"
              value={labelFor("heightCategory", body.heightCategory)}
            />
            <Field
              label="In a running or tag game, they usually"
              value={labelFor("energyType", player.energyType)}
            />
            <Field
              label="Better at running, jumping and throwing, or careful, steady-handed tasks"
              value={labelFor("motorType", player.motorType)}
            />
            <Field
              label="Reaction to a fast-moving ball or shuttle"
              value={labelFor("visualTracking", player.visualTracking)}
            />
            <Field label="Agility and flexibility" value={labelFor("agility", player.agility)} />
            <Field label="Eyesight" value={labelFor("eyesight", player.eyesight)} />
          </Section>
        )}

        {/* Only shown if at least one of these was ever answered */}
        {hasPersonality && (
          <Section id="personality" title="Personality and play style">
            <Field
              label="Wants a partner or team, or goes it alone"
              value={
                player.teamIndividual
                  ? `${player.teamIndividual} out of 5 (1 is solo, 5 is always team)`
                  : undefined
              }
            />
            <Field
              label="After losing a game, they"
              value={labelFor("competitiveResponse", player.competitiveResponse)}
            />
            <Field
              label="Doing homework or a puzzle, they tend to"
              value={labelFor("focusStyle", player.focusStyle)}
            />
            <Field
              label="Trying a new game for the first time, they"
              value={labelFor("decisionStyle", player.decisionStyle)}
            />
            <Field
              label="When all attention is on them"
              value={labelFor("pressureResponse", player.pressureResponse)}
            />
            <Field
              label="Willing to repeat the same drill for months"
              value={labelFor("repetitionTolerance", player.repetitionTolerance)}
            />
            <Field
              label="Comfort with physical contact"
              value={labelFor("contactComfort", player.contactComfort)}
            />
            <Field
              label="Given a free afternoon, gravitates to"
              value={labelFor("environment", player.environment)}
            />
            <Field label="Comfort in water" value={labelFor("waterComfort", player.waterComfort)} />
            <TagList label="Personality tags" values={player.personalityTags} />
          </Section>
        )}
      </div>
    </div>
  );
}
