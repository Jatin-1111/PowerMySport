import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BackToRoadmapLink } from "@/components/BackToRoadmapLink";
import { TournamentConciergeButton } from "./TournamentConciergeButton";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  IndianRupee,
  MapPin,
  Network,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FederationInfo {
  name: string;
  acronym: string;
  website?: string;
  type: "govt" | "private" | "hybrid";
  about?: string;
}

interface TournamentDetail {
  _id: string;
  name: string;
  sportSlug: string;
  slug: string;
  level: string;
  description: string;
  ageGroup?: string;
  typicalDates?: string;
  registrationDeadline?: string;
  isCurated: boolean;
  isVerified?: boolean;
  federation?: FederationInfo | string;
  participationGuide?: string[];
  qualificationPath?: string;
  format?: string;
  prestige?: "flagship" | "developmental" | "ranking";
  prizePool?: string;
  registrationUrl?: string;
  sourceUrls?: string[];
  city?: string;
  entryFee?: string;
  selectionCriteria?: string;
  prizes?: string;
  keyFacts?: string[];
  importantNotes?: string[];
  circuitContext?: string;
}

// ─── Server fetch ─────────────────────────────────────────────────────────────

async function fetchTournament(slug: string): Promise<TournamentDetail | null> {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    const res = await fetch(
      `${apiBase}/pathways/tournaments/${encodeURIComponent(slug)}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const body = await res.json();
    return body.success ? (body.data as TournamentDetail) : null;
  } catch {
    return null;
  }
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await fetchTournament(slug);
  if (!t) return { title: "Tournament — PowerMySport" };
  return {
    title: `${t.name} — PowerMySport`,
    description: t.description.slice(0, 155),
    alternates: { canonical: `/tournaments/${t.slug}` },
    openGraph: {
      title: t.name,
      description: t.description.slice(0, 200),
      url: `https://powermysport.com/tournaments/${t.slug}`,
      type: "website",
      siteName: "PowerMySport",
    },
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPORT_LABEL: Record<string, string> = {
  cricket: "Cricket",
  tennis: "Tennis",
  chess: "Chess",
  football: "Football",
  basketball: "Basketball",
  hockey: "Hockey",
  "table-tennis": "Table Tennis",
  swimming: "Swimming",
  badminton: "Badminton",
  volleyball: "Volleyball",
};

const LEVEL_META: Record<string, { pill: string; dot: string }> = {
  international: {
    pill: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
  national: {
    pill: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  state: {
    pill: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
  },
};

function levelMeta(level: string) {
  return (
    LEVEL_META[level.toLowerCase()] ?? {
      pill: "bg-slate-50 text-slate-600 border-slate-200",
      dot: "bg-slate-400",
    }
  );
}

const PRESTIGE_META: Record<
  string,
  { label: string; tagline: string; badge: string }
> = {
  flagship: {
    label: "Flagship Tournament",
    tagline:
      "The top-tier event in this sport — results here directly influence national team selection and international qualification.",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  developmental: {
    label: "Development Tournament",
    tagline:
      "Designed to build competitive experience and feed players into the national ranking pipeline.",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  ranking: {
    label: "Ranking Tournament",
    tagline:
      "Official ranking points are awarded — results directly improve your child's national or international standing.",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAgeCategories(raw: string): string[] {
  const match = raw.match(/[:(]\s*([^)]+)\s*\)?$/);
  if (match) {
    const inner = match[1];
    if (inner.includes(",")) {
      return inner.split(",").map((s) => s.trim());
    }
  }
  return [raw];
}

function parseQualificationSteps(path: string): string[] {
  return path.split(/\s*→\s*/).filter(Boolean);
}

function getDocumentsForLevel(level: string, sportSlug: string): string[] {
  const s = sportSlug.toLowerCase();

  // Sport-specific federation registration document (the primary prerequisite)
  const federationDoc: Record<string, string> = {
    cricket: "BCCI age-group registration proof (from your State Cricket Association)",
    tennis: "AITA rating card or AITA player registration certificate",
    badminton: "BAI (Badminton Association of India) membership card",
    chess: "AICF (All India Chess Federation) player ID card",
    football: "AIFF (All India Football Federation) player registration certificate",
    basketball: "BFI (Basketball Federation of India) registration card",
    hockey: "Hockey India player registration card",
    "table-tennis": "TTFI (Table Tennis Federation of India) membership card",
    swimming: "SFI (Swimming Federation of India) registration card",
    volleyball: "VFI (Volleyball Federation of India) membership card",
  };
  const primaryDoc = federationDoc[s] ?? "National / State federation registration card";

  const base = [
    "Birth certificate or Aadhaar card (proof of age)",
    "4 recent passport-size photographs",
    "Medical fitness certificate from a registered doctor",
  ];
  const stateAndAbove = [
    "School or college No-Objection Certificate (NOC)",
    "State association membership proof",
    "Parent / guardian consent form (for players under 18)",
  ];
  const nationalAndAbove = [
    "State sports authority letter of recommendation",
  ];
  const international = [
    "Valid Indian passport",
    "National federation endorsement letter",
  ];

  const l = level.toLowerCase();
  if (l.includes("international"))
    return [primaryDoc, ...base, ...stateAndAbove, ...nationalAndAbove, ...international];
  if (l.includes("national"))
    return [primaryDoc, ...base, ...stateAndAbove, ...nationalAndAbove];
  if (l.includes("state")) return [primaryDoc, ...base, ...stateAndAbove];
  return [primaryDoc, ...base];
}

function getCareerImpact(
  prestige: string | undefined,
  level: string,
  sportSlug: string,
): Array<{ heading: string; detail: string }> {
  const sport = SPORT_LABEL[sportSlug] ?? sportSlug;
  const l = level.toLowerCase();

  const base: Array<{ heading: string; detail: string }> = [
    {
      heading: "Official competition record",
      detail: `Every result in this tournament goes on your child's official ${sport} record, which selectors and federation coaches reference during team announcements.`,
    },
    {
      heading: "Exposure to higher-level competition",
      detail:
        "Competing against athletes from across the country — or state — builds both technical skill and mental resilience faster than any training camp.",
    },
  ];

  if (prestige === "flagship") {
    base.unshift({
      heading: "National team selection pool",
      detail: `Performance at ${l.includes("national") ? "national" : "this"} level places your child under direct observation by the ${sport} national selectors. Top finishers are invited to national training camps and considered for international duty.`,
    });
    base.push({
      heading: "International qualification gateway",
      detail:
        "Winning or reaching the final in flagship tournaments often satisfies the minimum performance standard required to represent India in Asian or World Championships.",
    });
  }

  if (prestige === "developmental") {
    base.unshift({
      heading: "National ranking points",
      detail: `Results here feed directly into the national ${sport} ranking system. A strong performance moves your child significantly up the rankings, making them eligible for higher-level invitation events.`,
    });
    base.push({
      heading: "Scholarship eligibility",
      detail:
        "Players who medal at national development tournaments automatically qualify for government sports scholarships (SAI, Khelo India, and state schemes), which can be worth ₹5 lakh per year.",
    });
  }

  if (prestige === "ranking") {
    base.unshift({
      heading: "Official ranking improvement",
      detail: `Points from this tournament are credited to your child's official ranking within 7–14 days of the event. A significant jump in ranking unlocks access to higher-tier invitation events.`,
    });
  }

  return base;
}

function getFAQs(
  t: TournamentDetail,
  fed: FederationInfo | null,
): Array<{ q: string; a: string }> {
  const sport = SPORT_LABEL[t.sportSlug] ?? t.sportSlug;
  const categories = t.ageGroup ? parseAgeCategories(t.ageGroup) : [];
  const multipleCategories = categories.length > 1;

  return [
    {
      q: "Does my child need prior federation registration to participate?",
      a: fed
        ? `Yes. Your child must hold a valid ${fed.acronym} (${fed.name}) membership, obtained through your State ${sport} Association. Without this, your child cannot be listed in the official draw. PowerMySport can handle this registration for you as part of our concierge service.`
        : `Participants must hold a valid state association membership for ${sport}. Contact your state federation to register before the entry deadline.`,
    },
    {
      q: multipleCategories
        ? `My child is ${categories[0]} — which category should they enter?`
        : "What age group does my child qualify for?",
      a: multipleCategories
        ? `This tournament has ${categories.length} separate age-group draws: ${categories.join(", ")}. Each category runs independently with its own draw, schedule, and award ceremony. Your child enters only the category that matches their age as of the cutoff date set by ${fed?.acronym ?? "the federation"}.`
        : `This is an ${t.ageGroup ?? "open"} event. Confirm your child's exact eligibility against the official age-cutoff date published in the tournament circular, available on the ${fed?.acronym ?? "federation"} website.`,
    },
    {
      q: "What is the typical duration of this tournament?",
      a: t.format
        ? `The format is: ${t.format}. Depending on your child's progression and the number of entries in their category, plan for 3–7 days of competition. Families should book accommodation and travel with flexibility for knockout advancement.`
        : `Tournament duration varies by the number of entries. Plan for at least 3–5 days. The full schedule is released approximately 2 weeks before the event by the organising federation.`,
    },
    {
      q: "What if my child doesn't qualify through the standard route?",
      a: `State associations are allocated a fixed number of spots. If your child narrowly misses selection, two options remain: (1) apply directly to ${fed?.acronym ?? "the federation"} for a wildcard spot, which some editions offer to high-ranked players, or (2) focus on the next qualifying tournament in the cycle to build a stronger record. Our team at PowerMySport can advise on the specific appeals process.`,
    },
    {
      q: "Are there any costs beyond the entry fee?",
      a: t.entryFee
        ? `${t.entryFee} Additionally, families are responsible for travel, accommodation, and meals unless otherwise stated in the official tournament circular.`
        : "Entry fees vary by federation and edition — typically ₹500–₹5,000 per player per event. Families are responsible for travel, accommodation, and meals unless otherwise stated in the tournament circular. Some state associations cover partial costs for selected state team players. Check the official tournament notice for the current edition's fee structure.",
    },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await fetchTournament(slug);
  if (!t) notFound();

  const fed =
    t.federation && typeof t.federation === "object"
      ? (t.federation as FederationInfo)
      : null;

  const sportLabel = SPORT_LABEL[t.sportSlug] ?? t.sportSlug;
  const lm = levelMeta(t.level);
  const prestigeMeta = t.prestige ? PRESTIGE_META[t.prestige] : null;
  const ageCategories = t.ageGroup ? parseAgeCategories(t.ageGroup) : [];
  const qualSteps = t.qualificationPath
    ? parseQualificationSteps(t.qualificationPath)
    : [];
  const documents = getDocumentsForLevel(t.level, t.sportSlug);
  const careerImpact = getCareerImpact(t.prestige, t.level, t.sportSlug);
  const faqs = getFAQs(t, fed);
  const officialUrl =
    t.registrationUrl ?? fed?.website ?? t.sourceUrls?.[0] ?? null;

  const conciergeItem = {
    _id: t._id,
    name: t.name,
    level: t.level,
    ageGroup: t.ageGroup,
    sportName: sportLabel,
    sportSlug: t.sportSlug,
    prerequisiteId: fed ? `${fed.acronym.toLowerCase()}_registration` : "state_registration",
    prerequisiteName: fed
      ? `${fed.acronym} Registration`
      : "State Association Registration",
    documentChecklist: documents,
    prerequisiteGuide: t.participationGuide,
  };

  const statItems = [
    t.ageGroup ? { label: "Age Group", value: t.ageGroup } : null,
    t.typicalDates ? { label: "Typical Dates", value: t.typicalDates } : null,
    t.format ? { label: "Format", value: t.format } : null,
    t.prizePool ? { label: "Prize Pool", value: t.prizePool } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <main className="min-h-screen">

      {/* ── Hero — full-width dark header ── */}
      <div className="bg-deep-slate">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* Breadcrumb */}
          <div className="pt-5 pb-4 border-b border-white/[0.07]">
            <BackToRoadmapLink />
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-6 mb-5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${lm.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${lm.dot}`} />
              {t.level}
            </span>
            {prestigeMeta && (
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${prestigeMeta.badge}`}
              >
                {prestigeMeta.label}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.07] px-3 py-1 text-[11px] font-semibold text-white/50">
              <Globe className="h-3 w-3" />
              {sportLabel}
            </span>
            {t.isVerified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/[0.1] px-3 py-1 text-[11px] font-bold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Verified
              </span>
            )}
          </div>

          {/* Tournament name */}
          <h1
            className="font-title text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-white leading-[1.05] tracking-tight"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            {t.name}
          </h1>

          {fed && (
            <p className="mt-3 text-sm text-white/40">
              Organised by{" "}
              <span className="text-white/70 font-medium">
                {fed.name} · {fed.acronym}
              </span>
            </p>
          )}

          {/* Stats strip */}
          {statItems.length > 0 && (
            <div className="mt-8 flex flex-wrap border border-white/[0.1] rounded-2xl overflow-hidden divide-x divide-white/[0.1]">
              {statItems.map((stat, i) => (
                <div key={i} className="flex-1 min-w-[130px] px-5 py-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-white/30 mb-1.5">
                    {stat.label}
                  </p>
                  <p className="text-sm font-bold text-white leading-snug">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3 pb-10">
            {officialUrl && (
              <a
                href={officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-900 px-5 py-2.5 text-sm font-bold shadow hover:bg-slate-50 transition"
              >
                <ExternalLink className="h-4 w-4" />
                Official Portal
              </a>
            )}
            <Link
              href={`/roadmap?sport=${encodeURIComponent(sportLabel)}`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.15] bg-white/[0.07] text-white/75 px-5 py-2.5 text-sm font-bold hover:bg-white/[0.14] hover:text-white transition"
            >
              <MapPin className="h-4 w-4" />
              View {sportLabel} Pathway
            </Link>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid lg:grid-cols-[1fr_292px] gap-8 items-start">

          {/* ── Main column ── */}
          <div className="space-y-6">

            {/* About */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
              <SectionHeading>About This Tournament</SectionHeading>
              <p className="text-[15px] text-slate-600 leading-[1.8]">
                {t.description}
              </p>
              {prestigeMeta && (
                <div className="mt-6 pl-4 border-l-2 border-power-orange">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    <span className="font-semibold text-slate-800">
                      {prestigeMeta.label}:{" "}
                    </span>
                    {prestigeMeta.tagline}
                  </p>
                </div>
              )}
            </section>

            {/* Circuit & Ranking Ladder */}
            {t.circuitContext && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="shrink-0 h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Network className="h-4.5 w-4.5 text-indigo-600" style={{ width: "1.125rem", height: "1.125rem" }} />
                  </div>
                  <div>
                    <h2 className="font-title text-xl font-bold text-slate-900 tracking-tight leading-tight">
                      The Ranking Circuit
                    </h2>
                    <div className="mt-1.5 h-[3px] w-7 bg-power-orange rounded-full" />
                  </div>
                </div>
                <p className="text-[15px] text-slate-600 leading-[1.8]">
                  {t.circuitContext}
                </p>
              </section>
            )}

            {/* Key Facts */}
            {t.keyFacts && t.keyFacts.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                <SectionHeading>At a Glance</SectionHeading>
                <div className="grid sm:grid-cols-2 gap-3">
                  {t.keyFacts.map((fact, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                      <Zap className="h-4 w-4 text-power-orange shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-700 leading-snug">{fact}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Important Notes */}
            {t.importantNotes && t.importantNotes.length > 0 && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 sm:p-8">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="font-title text-lg font-bold text-amber-900 leading-tight">
                      Important — Read Before Registering
                    </h2>
                    <div className="mt-1 h-[3px] w-7 bg-amber-400 rounded-full" />
                  </div>
                </div>
                <ul className="space-y-3">
                  {t.importantNotes.map((note, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 mt-0.5">
                        <span className="text-[10px] font-black text-amber-700">{i + 1}</span>
                      </div>
                      <p className="text-sm text-amber-800 leading-relaxed">{note}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Age Categories */}
            {ageCategories.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                <SectionHeading>Age Categories & Eligibility</SectionHeading>
                {ageCategories.length === 1 ? (
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-base">
                        {ageCategories[0]}
                      </p>
                      <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                        Age eligibility is determined by the player&apos;s age as
                        of the cutoff date in the official tournament circular.
                        {fed && (
                          <>
                            {" "}
                            Confirm exact dates on the{" "}
                            <span className="font-semibold text-slate-700">
                              {fed.acronym} website
                            </span>{" "}
                            before registering.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-[15px] text-slate-600 mb-5">
                      This tournament runs{" "}
                      <span className="font-semibold text-slate-800">
                        {ageCategories.length} separate age-group draws
                      </span>
                      , each with its own schedule, draw, and awards.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {ageCategories.map((cat, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3.5"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600">
                            {i + 1}
                          </span>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">
                              {cat}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Independent draw & ceremony
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Selection Criteria */}
            {t.selectionCriteria && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                <SectionHeading>How Players Are Selected</SectionHeading>
                <p className="text-[15px] text-slate-600 leading-[1.8]">
                  {t.selectionCriteria}
                </p>
              </section>
            )}

            {/* Competition Format */}
            {t.format && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                <SectionHeading>Competition Format</SectionHeading>
                <p className="text-[15px] text-slate-700 leading-[1.8] mb-5">
                  {t.format}
                </p>
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-5 py-4">
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    What this means for your child
                  </p>
                  <p className="text-sm text-blue-700 leading-relaxed">
                    {t.format.toLowerCase().includes("group") &&
                    t.format.toLowerCase().includes("knockout")
                      ? "Your child is guaranteed at least the group-stage matches regardless of results, giving them consistent competitive experience before the pressure of knockout rounds begins."
                      : t.format.toLowerCase().includes("swiss")
                      ? "A Swiss system pairs your child against opponents of similar performance after each round — so they always compete against appropriately matched athletes, making every game meaningful and developmental."
                      : t.format.toLowerCase().includes("round-robin")
                      ? "Every team/player faces every other participant at least once, ensuring maximum competitive exposure and a fair overall ranking."
                      : "Matches are scheduled across multiple days. Families should plan travel and accommodation to cover the full potential duration of your child's run in the event."}
                  </p>
                </div>
              </section>
            )}

            {/* Entry Fee & Prizes */}
            {(t.entryFee || t.prizes || t.prizePool) && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                <SectionHeading>Cost & Awards</SectionHeading>
                <div className="grid sm:grid-cols-2 gap-4">
                  {t.entryFee && (
                    <div className="rounded-2xl bg-slate-50 p-5">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="h-8 w-8 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
                          <IndianRupee className="h-4 w-4 text-slate-600" />
                        </div>
                        <p className="font-bold text-slate-800 text-sm">Entry Fee</p>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{t.entryFee}</p>
                    </div>
                  )}
                  {(t.prizes || t.prizePool) && (
                    <div className="rounded-2xl bg-slate-50 p-5">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                          <Award className="h-4 w-4 text-amber-600" />
                        </div>
                        <p className="font-bold text-slate-800 text-sm">Prizes & Awards</p>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {t.prizes ?? t.prizePool}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Qualification Journey */}
            {qualSteps.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                <SectionHeading>Qualification Journey</SectionHeading>
                <p className="text-sm text-slate-400 mb-8">
                  The typical path a player follows to reach this tournament:
                </p>
                <div className="relative">
                  <div className="absolute left-5 top-4 bottom-8 w-px bg-gradient-to-b from-slate-200 to-transparent" />
                  <ol className="space-y-6">
                    {qualSteps.map((step, i) => {
                      const isFinal = i === qualSteps.length - 1;
                      return (
                        <li key={i} className="relative flex items-start gap-5">
                          <div
                            className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                              isFinal
                                ? "bg-power-orange text-white shadow-md shadow-orange-200"
                                : i === 0
                                ? "bg-white border-2 border-slate-300 text-slate-400"
                                : "bg-white border-2 border-slate-200 text-slate-500"
                            }`}
                          >
                            {i + 1}
                          </div>
                          <div className="flex-1 pt-1.5">
                            <p
                              className={`text-[15px] font-semibold leading-snug ${
                                isFinal ? "text-power-orange" : "text-slate-800"
                              }`}
                            >
                              {step}
                            </p>
                            {isFinal && (
                              <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-power-orange/70">
                                <Trophy className="h-3 w-3" />
                                This tournament
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </section>
            )}

            {/* How to Enter */}
            {t.participationGuide && t.participationGuide.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                <SectionHeading>How to Enter — Step by Step</SectionHeading>
                <p className="text-sm text-slate-400 mb-8">
                  Follow these steps in order. Starting early gives your child a
                  significant advantage — many entry slots fill quickly.
                </p>
                <ol className="space-y-6">
                  {t.participationGuide.map((step, i) => (
                    <li key={i} className="flex items-start gap-5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 text-sm font-bold text-slate-500">
                        {i + 1}
                      </span>
                      <p className="flex-1 pt-0.5 text-[15px] text-slate-700 leading-relaxed">
                        {step}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* What Your Child Gains */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
              <SectionHeading>What Your Child Stands to Gain</SectionHeading>
              <p className="text-sm text-slate-400 mb-7">
                Competing in{" "}
                <span className="font-semibold text-slate-600">{t.name}</span>{" "}
                creates measurable, lasting value — beyond the result on the
                day.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {careerImpact.map((item, i) => (
                  <div key={i} className="rounded-2xl bg-slate-50 p-5">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <p className="font-semibold text-slate-800 text-sm leading-tight">
                        {item.heading}
                      </p>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed pl-[30px]">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Federation */}
            {fed && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                <SectionHeading>Organising Federation</SectionHeading>
                <div className="flex items-start gap-5 mb-5">
                  <div className="shrink-0 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white select-none tracking-tight">
                    {fed.acronym.slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg leading-tight">
                      {fed.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-sm font-semibold text-slate-400">
                        {fed.acronym}
                      </span>
                      <span
                        className={`text-[11px] font-bold rounded-full px-2.5 py-0.5 ${
                          fed.type === "govt"
                            ? "bg-blue-100 text-blue-700"
                            : fed.type === "hybrid"
                            ? "bg-violet-100 text-violet-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {fed.type === "govt"
                          ? "Government Body"
                          : fed.type === "hybrid"
                          ? "Public-Private Organisation"
                          : "National Federation"}
                      </span>
                    </div>
                  </div>
                </div>
                {fed.about && (
                  <p className="text-[15px] text-slate-600 leading-[1.8] mb-4">
                    {fed.about}
                  </p>
                )}
                {fed.website && (
                  <a
                    href={fed.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-power-orange hover:text-orange-600 transition"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Visit {fed.acronym} Official Website
                  </a>
                )}
              </section>
            )}

            {/* FAQ */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
              <SectionHeading>Common Questions from Parents</SectionHeading>
              <div className="divide-y divide-slate-100">
                {faqs.map((item, i) => (
                  <details
                    key={i}
                    className="group py-4 first:pt-0 last:pb-0"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-4 select-none list-none [&::-webkit-details-marker]:hidden">
                      <span className="font-semibold text-slate-800 text-sm leading-snug">
                        {item.q}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <p className="mt-3 text-sm text-slate-500 leading-relaxed pr-8">
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </section>

          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-4 lg:sticky lg:top-6">

            {/* Entry Fee quick fact */}
            {t.entryFee && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex items-start gap-3">
                <div className="shrink-0 h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <IndianRupee className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Entry Fee</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5 leading-snug">{t.entryFee}</p>
                </div>
              </div>
            )}

            {/* Key Dates */}
            {(t.typicalDates || t.registrationDeadline || t.city) && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-4">
                  Key Dates
                </p>
                <div className="space-y-4">
                  {t.typicalDates && (
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center">
                        <CalendarDays className="h-4 w-4 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Tournament
                        </p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5 leading-snug">
                          {t.typicalDates}
                        </p>
                      </div>
                    </div>
                  )}
                  {t.registrationDeadline && (
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-red-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Registration Closes
                        </p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5 leading-snug">
                          {t.registrationDeadline}
                        </p>
                      </div>
                    </div>
                  )}
                  {t.city && (
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Venue
                        </p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">
                          {t.city}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Documents */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-0.5">
                Documents to Prepare
              </p>
              <p className="text-[11px] text-slate-400 mb-4">
                Standard for a {t.level} event — verify in the official
                circular.
              </p>
              <ul className="space-y-2.5">
                {documents.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <div className="shrink-0 h-4 w-4 mt-0.5 rounded border border-slate-300 flex items-center justify-center">
                      <FileText className="h-2.5 w-2.5 text-slate-400" />
                    </div>
                    <span className="text-[13px] text-slate-600 leading-snug">
                      {doc}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Concierge CTA — premium dark card */}
            <div className="rounded-2xl bg-deep-slate p-6 relative overflow-hidden">
              <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-power-orange/[0.12] blur-2xl" />
              <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-power-orange/[0.07] blur-2xl" />

              <div className="relative z-10">
                <div className="flex items-center gap-1.5 mb-3">
                  <Sparkles className="h-3.5 w-3.5 text-power-orange" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-power-orange">
                    PowerMySport Concierge
                  </p>
                </div>
                <h3 className="font-title text-[17px] font-bold text-white mb-2 leading-snug">
                  We handle the registration for you
                </h3>
                <p className="text-[13px] text-white/50 leading-relaxed mb-5">
                  Federation IDs, documents, form submissions — our team takes
                  care of all of it. At no cost to you.
                </p>
                <ul className="space-y-2 mb-5">
                  {[
                    "Obtain federation membership for your child",
                    "Prepare and submit all required documents",
                    "Confirm your entry and keep you updated",
                  ].map((line, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-[12px] text-white/60">{line}</span>
                    </li>
                  ))}
                </ul>

                <TournamentConciergeButton
                  item={conciergeItem}
                  buttonClassName="flex items-center justify-center gap-2 w-full rounded-xl bg-power-orange py-3 text-sm font-bold text-white hover:bg-orange-500 transition shadow-lg shadow-orange-900/30"
                />

                {officialUrl && (
                  <a
                    href={officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full mt-2 py-2.5 text-xs font-semibold text-white/35 hover:text-white/65 transition"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Official Registration
                  </a>
                )}
                <Link
                  href={`/roadmap?sport=${encodeURIComponent(sportLabel)}`}
                  className="flex items-center justify-center gap-1 w-full mt-0.5 py-1.5 text-[11px] font-medium text-white/25 hover:text-white/50 transition"
                >
                  Explore {sportLabel} Pathway
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

          </aside>
        </div>
      </div>
    </main>
  );
}

// ─── Section heading component ────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="font-title text-xl font-bold text-slate-900 tracking-tight leading-tight">
        {children}
      </h2>
      <div className="mt-1.5 h-[3px] w-7 bg-power-orange rounded-full" />
    </div>
  );
}
