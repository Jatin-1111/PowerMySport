import { ArrowUp, Award, Target, TrendingUp } from "lucide-react";
import { formatAsOn } from "../services/api";
import { formatPoints, nationalStandingPhrase, tierPhrase } from "../utils/insights";

/**
 * The top of a player's page.
 *
 * ── What this is for ─────────────────────────────────────────────────────────
 * A parent opening this page is asking one question — *is my child doing well?*
 * — and the honest answer is a sentence, not a number. So the page opens with
 * the sentence: ranked 312th of 1,602 in Boys Under-16, which is the top 20% in
 * India. Everything after it is supporting detail.
 *
 * ── What was removed, and why ────────────────────────────────────────────────
 * The three headline figures used to be "best rank held", "weeks tracked" and
 * "age groups". Two of those were facts about our archive rather than about the
 * child: "43 published lists" measures how far back we have mirrored AITA, and
 * "2 age groups" is a count of rows in a database. Neither tells a parent
 * anything they can use, and both occupied the most valuable space on the page.
 *
 * They are replaced by the three numbers a parent actually reaches for: where the
 * child stands now, the best they have stood, and how far the next level is.
 *
 * Everything here is derived from data the page already fetched. No new requests.
 *
 * No pronouns anywhere. These are real children whose pronouns we have never been
 * told — the list category is the name of a tournament bracket, not a statement
 * about the person on the row.
 */

export interface HistoryPoint {
  asOnDate: string;
  rank: number;
  category: string;
  subcategory: string;
}

/**
 * AITA publishes names in block capitals. Rendering that verbatim makes every
 * player's page read as though it is shouting, so an all-caps name is cased for
 * display. A name that already has mixed case is left exactly as supplied —
 * people capitalise their own names in ways a rule will get wrong.
 */
export function displayName(raw: string): string {
  if (raw !== raw.toUpperCase()) return raw;
  return raw
    .toLowerCase()
    .replace(/(^|[\s'\-.])([a-z])/g, (_, boundary: string, char: string) =>
      `${boundary}${char.toUpperCase()}`,
    );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]![0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase();
}

export interface SeasonSummary {
  /** Largest improvement between a player's first and latest rank on one list. */
  bestClimb: { places: number; label: string; from: number; to: number } | null;
  /** Best rank ever held, across every list we hold. */
  careerBest: { rank: number; asOnDate: string } | null;
  /** Distinct published weeks this player appears in. */
  weeksTracked: number;
  /** How many separate lists they appear on. */
  listCount: number;
}

/**
 * Reduce the raw history into the few facts worth leading with.
 *
 * "Best climb" is measured per list rather than across the whole history,
 * because a player ages up between lists and comparing a U-14 rank against a
 * U-18 one would manufacture a climb that never happened.
 */
export function summariseSeason(
  history: HistoryPoint[],
  comboLabel: (c: { category: string; subcategory: string }) => string,
): SeasonSummary {
  const byCombo = new Map<string, HistoryPoint[]>();
  for (const point of history) {
    const key = `${point.category}|${point.subcategory}`;
    const bucket = byCombo.get(key);
    if (bucket) bucket.push(point);
    else byCombo.set(key, [point]);
  }

  let bestClimb: SeasonSummary["bestClimb"] = null;
  let careerBest: SeasonSummary["careerBest"] = null;

  for (const [key, points] of byCombo) {
    const ordered = [...points].sort(
      (a, b) => new Date(a.asOnDate).getTime() - new Date(b.asOnDate).getTime(),
    );
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    const places = first.rank - last.rank;

    if (places > 0 && (!bestClimb || places > bestClimb.places)) {
      const [category, subcategory] = key.split("|");
      bestClimb = {
        places,
        label: comboLabel({
          category: category ?? "",
          subcategory: subcategory ?? "",
        }),
        from: first.rank,
        to: last.rank,
      };
    }

    for (const point of ordered) {
      if (!careerBest || point.rank < careerBest.rank) {
        careerBest = { rank: point.rank, asOnDate: point.asOnDate };
      }
    }
  }

  return {
    bestClimb,
    careerBest,
    weeksTracked: new Set(history.map((p) => p.asOnDate)).size,
    listCount: byCombo.size,
  };
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

/** The one standing the headline sentence and the stat row are built from. */
export interface PrimaryStanding {
  listLabel: string;
  rank: number;
  listSize: number | null;
  totalPoints: number;
  nextTier: { rank: number; gap: number } | null;
}

export function PlayerHero({
  name,
  federationAcronym,
  regNo,
  state,
  birthYear,
  summary,
  primary,
}: {
  name: string;
  federationAcronym: string;
  regNo: string;
  // Nullable, not just optional: the API returns null for a player whose
  // registration row carries no state or birth year.
  state?: string | null | undefined;
  birthYear?: number | null | undefined;
  summary: SeasonSummary;
  /** Null for a player we hold no current standing for — history only. */
  primary: PrimaryStanding | null;
}) {
  const standing = primary
    ? nationalStandingPhrase(primary.rank, primary.listSize)
    : null;

  return (
    <header className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative isolate px-5 py-6 sm:px-8 sm:py-8">
        {/* A soft wash rather than a photo — we hold no player imagery, and a
            stock face on a minor's page would be worse than none. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-power-orange/10 via-transparent to-turf-green/10"
        />

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-power-orange to-power-orange/70 text-xl font-bold text-white shadow-sm sm:h-20 sm:w-20 sm:text-2xl"
          >
            {initials(name)}
          </div>

          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {state && <Chip>{state}</Chip>}
              {birthYear && <Chip>Born {birthYear}</Chip>}
              <Chip>
                {federationAcronym} #{regNo}
              </Chip>
            </div>
          </div>
        </div>

        {/* The answer, in a sentence, before any table. A parent who reads only
            this line and closes the tab has still been told the thing they came
            for. */}
        {primary && (
          <p className="mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
            Ranked{" "}
            <span className="font-bold tabular-nums">
              #{primary.rank.toLocaleString("en-IN")}
            </span>
            {primary.listSize && (
              <>
                {" "}
                of {primary.listSize.toLocaleString("en-IN")}
              </>
            )}{" "}
            in {federationAcronym} {primary.listLabel}
            {standing && (
              <>
                {" — "}
                <span className="font-semibold text-foreground">{standing}</span>
              </>
            )}
            .
          </p>
        )}

        {summary.bestClimb && summary.bestClimb.places > 0 && (
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm sm:text-base">
            <ArrowUp
              className="h-4 w-4 shrink-0 self-center text-rank-delta-up"
              aria-hidden
            />
            <span className="font-bold tabular-nums text-rank-delta-up">
              Up {summary.bestClimb.places.toLocaleString("en-IN")} places
            </span>
            <span className="text-muted-foreground">
              in {summary.bestClimb.label} since we started tracking — from #
              {summary.bestClimb.from.toLocaleString("en-IN")} to #
              {summary.bestClimb.to.toLocaleString("en-IN")}
            </span>
          </p>
        )}
      </div>

      <dl className="grid grid-cols-1 divide-y divide-border border-t border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {primary && (
          <Stat
            icon={<TrendingUp className="h-4 w-4" aria-hidden />}
            label="Rank now"
            value={`#${primary.rank.toLocaleString("en-IN")}`}
            hint={
              primary.listSize
                ? `of ${primary.listSize.toLocaleString("en-IN")} in ${primary.listLabel}`
                : primary.listLabel
            }
          />
        )}
        {summary.careerBest && (
          <Stat
            icon={<Award className="h-4 w-4" aria-hidden />}
            label="Best rank so far"
            value={`#${summary.careerBest.rank.toLocaleString("en-IN")}`}
            hint={`reached ${formatAsOn(summary.careerBest.asOnDate)}`}
          />
        )}
        {primary && (
          <Stat
            icon={<Target className="h-4 w-4" aria-hidden />}
            label="Points"
            value={formatPoints(primary.totalPoints)}
            hint={
              primary.nextTier
                ? `${formatPoints(primary.nextTier.gap)} more for the ${tierPhrase(primary.nextTier.rank)}`
                : "in their own age group"
            }
          />
        )}
      </dl>
    </header>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </dt>
      {/* Hint on its own line: inline, "#270" and "13 Jul 2026" ran together
          and read as a single number. */}
      <dd className="mt-1">
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {value}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
      </dd>
    </div>
  );
}
