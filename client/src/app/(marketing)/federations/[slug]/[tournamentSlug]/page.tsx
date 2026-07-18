import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  MapPin,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface FederationMeta {
  slug: string;
  name: string;
  acronym: string;
}

// ─── Server fetches ───────────────────────────────────────────────────────────

async function fetchTournament(slug: string): Promise<TournamentDetail | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
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

async function fetchFederationMeta(slug: string): Promise<FederationMeta | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    const res = await fetch(
      `${apiBase}/federations/${encodeURIComponent(slug)}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const body = await res.json();
    if (!body.success) return null;
    const d = body.data;
    return { slug: d.slug, name: d.name, acronym: d.acronym };
  } catch {
    return null;
  }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; tournamentSlug: string }>;
}): Promise<Metadata> {
  const { slug, tournamentSlug } = await params;
  const [t, fed] = await Promise.all([
    fetchTournament(tournamentSlug),
    fetchFederationMeta(slug),
  ]);
  if (!t) return { title: "Tournament — PowerMySport" };
  return {
    title: `${t.name}${fed ? ` — ${fed.acronym}` : ""} — PowerMySport`,
    description: t.description.slice(0, 155),
    alternates: { canonical: `/federations/${slug}/${tournamentSlug}` },
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_META: Record<string, { pill: string; dot: string }> = {
  international: { pill: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  national: { pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  state: { pill: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
};

function levelMeta(level: string) {
  return LEVEL_META[level.toLowerCase()] ?? {
    pill: "bg-slate-50 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  };
}

const PRESTIGE_META = {
  flagship: { label: "Flagship Tournament", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  developmental: { label: "Development Tournament", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ranking: { label: "Ranking Tournament", badge: "bg-blue-50 text-blue-700 border-blue-200" },
} as const;

const SPORT_LABEL: Record<string, string> = {
  cricket: "Cricket", tennis: "Tennis", chess: "Chess", football: "Football",
  basketball: "Basketball", hockey: "Hockey", "table-tennis": "Table Tennis",
  swimming: "Swimming", badminton: "Badminton", volleyball: "Volleyball",
};

function getDocumentsForLevel(level: string): string[] {
  const base = [
    "Proof of age — birth certificate or Aadhaar card",
    "4 recent passport-size photographs",
    "Medical fitness certificate from a registered doctor",
    "School or college No-Objection Certificate (NOC)",
  ];
  const l = level.toLowerCase();
  if (l.includes("international")) return [...base,
    "State association membership / registration card",
    "Parent / guardian consent form (for players under 18)",
    "State sports authority letter of recommendation",
    "Valid Indian passport",
    "National federation endorsement letter",
  ];
  if (l.includes("national")) return [...base,
    "State association membership / registration card",
    "Parent / guardian consent form (for players under 18)",
    "State sports authority letter of recommendation",
  ];
  if (l.includes("state")) return [...base,
    "State association membership / registration card",
    "Parent / guardian consent form (for players under 18)",
  ];
  return base;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FederationTournamentPage({
  params,
}: {
  params: Promise<{ slug: string; tournamentSlug: string }>;
}) {
  const { slug, tournamentSlug } = await params;

  const [t, fed] = await Promise.all([
    fetchTournament(tournamentSlug),
    fetchFederationMeta(slug),
  ]);

  if (!t) notFound();

  const lm = levelMeta(t.level);
  const prestigeMeta = t.prestige ? PRESTIGE_META[t.prestige] : null;
  const sportLabel = SPORT_LABEL[t.sportSlug] ?? t.sportSlug;
  const documents = getDocumentsForLevel(t.level);
  const officialUrl = t.registrationUrl ?? (t.sourceUrls && t.sourceUrls[0]) ?? null;

  const statItems = [
    t.ageGroup ? { label: "Age Group", value: t.ageGroup } : null,
    t.typicalDates ? { label: "Typical Dates", value: t.typicalDates } : null,
    t.format ? { label: "Format", value: t.format } : null,
    t.entryFee ? { label: "Entry Fee", value: t.entryFee } : null,
    t.registrationDeadline ? { label: "Registration Deadline", value: t.registrationDeadline } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const qualSteps = t.qualificationPath
    ? t.qualificationPath.split(/\s*→\s*/).filter(Boolean)
    : [];

  return (
    <main className="min-h-screen">

      {/* ── Hero ── */}
      <div className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* Breadcrumb */}
          <div className="pt-5 pb-4 border-b border-white/[0.07]">
            <Link
              href={`/federations/${slug}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white/35 hover:text-white/65 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to {fed ? fed.acronym : "Federation"}
            </Link>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-6 mb-5">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${lm.pill}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${lm.dot}`} />
              {t.level}
            </span>
            {prestigeMeta && (
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${prestigeMeta.badge}`}>
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

          {/* Name */}
          <h1 className="font-title text-4xl sm:text-5xl font-bold text-white leading-[1.05] tracking-tight [text-wrap:balance]">
            {t.name}
          </h1>

          {fed && (
            <p className="mt-3 text-sm text-white/40">
              Organised by{" "}
              <span className="text-white/70 font-medium">{fed.name} · {fed.acronym}</span>
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
                  <p className="text-sm font-bold text-white leading-snug">{stat.value}</p>
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
              href={`/federations/${slug}`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.15] bg-white/[0.07] text-white/75 px-5 py-2.5 text-sm font-bold hover:bg-white/[0.14] hover:text-white transition"
            >
              <Trophy className="h-4 w-4" />
              {fed ? `More ${fed.acronym} Tournaments` : "All Tournaments"}
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
              <p className="text-[15px] text-slate-600 leading-[1.8]">{t.description}</p>
            </section>

            {/* Circuit context */}
            {t.circuitContext && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                <SectionHeading>The Ranking Circuit</SectionHeading>
                <p className="text-[15px] text-slate-600 leading-[1.8]">{t.circuitContext}</p>
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

            {/* Qualification Path */}
            {qualSteps.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                <SectionHeading>Qualification Path</SectionHeading>
                <div className="flex flex-col gap-2">
                  {qualSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-[11px] font-black text-power-orange">
                        {i + 1}
                      </div>
                      <p className="text-sm text-slate-700 leading-snug pt-0.5">{step}</p>
                      {i < qualSteps.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-slate-300 mt-1 ml-auto shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* How to Participate */}
            {t.participationGuide && t.participationGuide.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                <SectionHeading>How to Participate</SectionHeading>
                <ol className="space-y-4">
                  {t.participationGuide.map((step, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-[15px] text-slate-600 leading-relaxed pt-0.5">{step}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-5">

            {/* Register CTA */}
            {officialUrl && (
              <div className="rounded-2xl bg-slate-900 p-6 text-center">
                <Trophy className="h-6 w-6 text-power-orange mx-auto mb-3" />
                <p className="text-sm font-bold text-white mb-1">Ready to Register?</p>
                <p className="text-xs text-white/50 mb-4 leading-relaxed">
                  Visit the official portal to submit your entry.
                </p>
                <a
                  href={officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-xl bg-power-orange px-4 py-2.5 text-sm font-bold text-white text-center hover:bg-orange-600 transition"
                >
                  Register Now
                </a>
              </div>
            )}

            {/* Age group & eligibility */}
            {t.ageGroup && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-slate-500" />
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Age Group</p>
                </div>
                <p className="text-sm font-semibold text-slate-800">{t.ageGroup}</p>
                {t.selectionCriteria && (
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">{t.selectionCriteria}</p>
                )}
              </div>
            )}

            {/* Location */}
            {t.city && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Venue</p>
                </div>
                <p className="text-sm font-semibold text-slate-800">{t.city}</p>
              </div>
            )}

            {/* Document checklist */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-slate-500" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Documents Needed</p>
              </div>
              <ul className="space-y-2">
                {documents.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    {doc}
                  </li>
                ))}
              </ul>
            </div>

            {/* Back to federation */}
            <Link
              href={`/federations/${slug}`}
              className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 hover:border-orange-200 hover:shadow-md transition group"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Organising Body</p>
                <p className="text-sm font-bold text-slate-900">{fed ? fed.acronym : "Federation"}</p>
                {fed && <p className="text-xs text-slate-500 truncate">{fed.name}</p>}
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-power-orange group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
