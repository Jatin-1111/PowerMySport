import { Breadcrumbs } from "@/modules/shared/ui/Breadcrumbs";
import { NOINDEX_METADATA } from "@/lib/seo";
import {
  fetchPlayer,
  formatAsOn,
  type PlayerCurrentEntry,
  type RankingBandProfile,
} from "@/modules/rankings/services/api";
import { entryStatus, isJuniorBracket } from "@/modules/rankings/utils/aitaRules";
import { EntryRules } from "@/modules/rankings/components/HowToRead";
import { RankTrajectory } from "@/modules/rankings/components/RankTrajectory";
import {
  comboHref,
  comboLabel,
  getRankingSport,
} from "@/modules/rankings/config/rankings";
import {
  formatPoints,
  nationalStandingPhrase,
  ownBracket,
  tierPhrase,
} from "@/modules/rankings/utils/insights";
import {
  PlayerHero,
  displayName,
  summariseSeason,
} from "@/modules/rankings/components/PlayerHero";
import { PointsComposition } from "@/modules/rankings/components/PointsComposition";
import { RankDelta } from "@/modules/rankings/components/RankDelta";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * One player's standing and history.
 *
 * ── Why this page is noindex ─────────────────────────────────────────────────
 * Most people on these lists are children — the youngest are twelve — and the
 * page is keyed on a name plus a registration number. A searchable, crawlable
 * profile for a named minor is a materially different product from a ranking
 * table, and under the DPDP Act 2023 children's data carries obligations that
 * "AITA already published a PDF" does not discharge.
 *
 * So the page exists and is linked from the tables (a parent following their
 * own child's progress is the whole point), but it is kept out of search and
 * out of the sitemap until someone decides otherwise on purpose. Flipping it
 * on is one export away; flipping it back after Google has indexed a few
 * thousand children is not.
 *
 * No date of birth is shown anywhere — `birthYear` only, which the age
 * category already implies.
 *
 * ── How the page is ordered ──────────────────────────────────────────────────
 * By what a parent can do with it. The sentence that answers "is this good", then
 * the standing in their own age group, then the trend, then what the next level
 * costs and what this rank opens or closes, and only then the breakdown of where
 * the points came from. The old order led with a chart and buried the target.
 */
export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: "Player ranking history",
};

export default async function PlayerRankingPage({
  params,
}: {
  params: Promise<{ sport: string; regNo: string }>;
}) {
  const { sport: sportSlug, regNo } = await params;
  const sport = getRankingSport(sportSlug);
  if (!sport) notFound();
  if (!/^\d{4,8}$/.test(regNo)) notFound();

  const data = await fetchPlayer(regNo, sport.slug);
  if (!data) notFound();

  const { player, current, history } = data;
  // AITA ships names in block capitals; displayName cases them for reading.
  const name = displayName(player.fullName ?? `Player ${player.regNo}`);

  const season = summariseSeason(history, comboLabel);

  // ── Which list is theirs ───────────────────────────────────────────────────
  // A child can enter an older bracket but never a younger one, so the youngest
  // bracket they appear on is their own age group and anything above it is
  // playing up. That ordering is what the whole page hangs on: the headline, the
  // chart and the entry rules all describe the home bracket, and a page that led
  // with the Under-18 row for an Under-16 player would be quietly wrong about
  // everything.
  const home = ownBracket(current.map((entry) => entry.subcategory));
  const standings = [...current].sort((a, b) => {
    if (a.subcategory === home) return -1;
    if (b.subcategory === home) return 1;
    return a.rank - b.rank;
  });
  const primaryEntry = standings[0];

  // Chart the list the player has the most history in — usually their main age
  // group, and the one where a trend is actually readable.
  const byCombo = new Map<string, typeof history>();
  for (const point of history) {
    const key = `${point.category}|${point.subcategory}`;
    const bucket = byCombo.get(key);
    if (bucket) bucket.push(point);
    else byCombo.set(key, [point]);
  }
  // The home bracket first, then whatever has the most weeks behind it.
  const charted = [...byCombo.entries()].sort((a, b) => {
    const aHome = a[0].endsWith(`|${home}`);
    const bHome = b[0].endsWith(`|${home}`);
    if (aHome !== bHome) return aHome ? -1 : 1;
    return b[1].length - a[1].length;
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[{ label: "Rankings", href: "/rankings" }, { label: name }]}
        className="mb-6"
      />

      <PlayerHero
        name={name}
        federationAcronym={sport.federation.acronym}
        regNo={player.regNo}
        state={player.state}
        birthYear={player.birthYear}
        summary={season}
        primary={
          primaryEntry
            ? {
                listLabel: comboLabel({
                  category: primaryEntry.category,
                  subcategory: primaryEntry.subcategory,
                }),
                rank: primaryEntry.rank,
                listSize: primaryEntry.insight.listSize,
                totalPoints: primaryEntry.totalPoints,
                nextTier: primaryEntry.insight.nextTier,
              }
            : null
        }
      />

      {standings.length > 0 && (
        <section className="mt-10">
          <SectionHeading
            title={standings.length > 1 ? "Both lists" : "Current standing"}
            subtitle={
              standings.length > 1 && home
                ? `${comboLabel({ category: standings[0]!.category, subcategory: home })} is the main list — the age group this player belongs to. Entering an older group as well is normal, and results there earn points on both lists.`
                : undefined
            }
          />
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {standings.map((entry) => (
              <li key={entry._id}>
                <StandingCard
                  entry={entry}
                  sportSlug={sport.slug}
                  isHome={entry.subcategory === home}
                  showRole={standings.length > 1 && home !== null}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {charted.length > 0 && (
        <section className="mt-10">
          <SectionHeading
            title="Progress week by week"
            subtitle="Every list AITA has published since we started mirroring them."
          />

          {charted.slice(0, 2).map(([key, points]) => {
            const [category, subcategory] = key.split("|");
            const label = comboLabel({
              category: category ?? "",
              subcategory: subcategory ?? "",
            });
            if (points.length < 2) return null;
            return (
              <div
                key={key}
                className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
              >
                <h3 className="text-sm font-semibold">{label}</h3>
                <RankTrajectory
                  points={points.map((p) => ({
                    asOnDate: p.asOnDate,
                    rank: p.rank,
                    // Lets the hover readout answer the follow-up question —
                    // a jump of 80 places is a different story depending on
                    // whether the points moved with it.
                    totalPoints: p.totalPoints,
                  }))}
                  label={label}
                />
              </div>
            );
          })}
        </section>
      )}

      {/* What the rank does, under AITA's rules. Only for the home bracket — the
          gates are per age group, and repeating the panel for a bracket the child
          is only visiting would read as two conflicting sets of rules. */}
      {primaryEntry && isJuniorBracket(primaryEntry.subcategory) && (
        <section className="mt-10">
          <EntryRules
            subcategory={primaryEntry.subcategory}
            listLabel={comboLabel({
              category: primaryEntry.category,
              subcategory: primaryEntry.subcategory,
            })}
          />
        </section>
      )}

      {/* Their own point mix against the mix of the players above them. Reading
          the two together is the actionable part: a player whose total is all
          singles, beside a top ten that draws a quarter of its points from
          doubles and international events, has been shown where the gap is.

          Home bracket only. Two of these panels, one per list, was four charts of
          near-identical shape and no reader got to the end of them. */}
      {primaryEntry &&
        (() => {
          const band = playerBand(primaryEntry, name);
          if (!band) return null;
          const combo = {
            category: primaryEntry.category,
            subcategory: primaryEntry.subcategory,
          };
          return (
            <section className="mt-10">
              <PointsComposition
                bands={[band, ...(primaryEntry.insight.bands ?? [])]}
                subcategory={primaryEntry.subcategory}
                title={`What makes up these points — ${comboLabel(combo)}`}
                caption={
                  `The top bar is ${name}, broken into where each point came from. ` +
                  "The bars under it are the averages for each part of the list. " +
                  "Where a colour is wide at the top of the list but thin or missing " +
                  "on the top bar, that is what the leading players are doing differently."
                }
              />
            </section>
          );
        })()}

      {history.length === 0 && current.length === 0 && (
        <p className="mt-10 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No ranking history held for this player.
        </p>
      )}

      <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
        Rankings are published by the All India Tennis Association and mirrored here.
        PowerMySport is not affiliated with AITA.
      </p>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string | undefined;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {subtitle && (
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/**
 * Where the player sits in the field, drawn rather than only stated.
 *
 * ── Why this replaced a percentile bar ───────────────────────────────────────
 * The previous version filled a bar to the percentile — top 20% drew a bar 20%
 * full. That is backwards to look at: a fuller bar reads as more, better, further
 * along, so the best players in the country got the emptiest bars and a player
 * near the bottom got a bar brimming with colour. Nothing on screen said which
 * way to read it.
 *
 * This draws the field instead, labelled at both ends, with a marker where the
 * player stands. There is no direction to infer — the ends say what they are.
 */
function FieldPosition({ rank, listSize }: { rank: number; listSize: number }) {
  const position = Math.min(100, Math.max(0, (rank / listSize) * 100));
  return (
    <div className="mt-2.5">
      <div aria-hidden className="relative h-1.5 w-full rounded-full bg-muted">
        <span
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-power-orange shadow-sm"
          style={{ left: `${position}%` }}
        />
      </div>
      <div
        aria-hidden
        className="mt-1 flex justify-between text-[11px] text-muted-foreground"
      >
        <span>best</span>
        <span>{listSize.toLocaleString("en-IN")}th</span>
      </div>
    </div>
  );
}

/**
 * One standing, with the context that makes it mean something.
 *
 * The rank is the biggest thing on the card, but on its own it is the least
 * informative — so it is immediately followed by the plain-language version of
 * itself ("in the top 20% in India"), the standing inside their own state, and
 * the points still needed for the next rung. "Weeks in the top 100: 0 of 43"
 * used to sit here too; it told a parent nothing except that their child had
 * never been near the top hundred, which is true of roughly every player on the
 * list and is not information anyone came for.
 */
function StandingCard({
  entry,
  sportSlug,
  isHome,
  showRole,
}: {
  entry: PlayerCurrentEntry;
  sportSlug: string;
  isHome: boolean;
  showRole: boolean;
}) {
  const combo = { category: entry.category, subcategory: entry.subcategory };
  const { insight } = entry;
  const standing = nationalStandingPhrase(entry.rank, insight.listSize);
  const gates = entryStatus(entry.rank, entry.subcategory);

  return (
    <div
      className={`flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md ${
        isHome ? "border-power-orange/40 ring-1 ring-power-orange/20" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={comboHref(sportSlug, combo)}
            className="text-sm font-semibold text-foreground hover:text-power-orange hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2"
          >
            {comboLabel(combo)}
          </Link>
          {showRole && (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {isHome ? "Own age group" : "Playing up"}
            </span>
          )}
        </div>
        {/* Movement is only meaningful when we hold the previous week; the chip
            renders nothing rather than guessing. */}
        <RankDelta delta={entry.rankDelta} hasBaseline={entry.prevRank !== undefined} />
      </div>

      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-bold tabular-nums tracking-tight">
          #{entry.rank.toLocaleString("en-IN")}
        </span>
        {insight.listSize && (
          <span className="text-sm text-muted-foreground">
            of {insight.listSize.toLocaleString("en-IN")}
          </span>
        )}
      </p>
      {/* `capitalize` would title-case every word — "In The Top 20% In India".
          Only the first letter should move, and the phrase is authored lower-case
          so it can also sit mid-sentence in the hero. */}
      {standing && (
        <p className="mt-1 text-sm font-medium first-letter:uppercase">{standing}</p>
      )}
      {insight.listSize && (
        <FieldPosition rank={entry.rank} listSize={insight.listSize} />
      )}

      <dl className="mt-4 mb-4 space-y-1.5 text-sm">
        <Row label="Points" value={formatPoints(entry.totalPoints)} />
        {entry.stateRank && entry.state && (
          <Row
            label={`Within ${entry.state}`}
            value={`#${entry.stateRank}${
              insight.stateSize ? ` of ${insight.stateSize.toLocaleString("en-IN")}` : ""
            }`}
          />
        )}
        {insight.careerHigh && insight.careerHigh.rank < entry.rank && (
          <Row
            label="Best on this list"
            value={`#${insight.careerHigh.rank.toLocaleString("en-IN")} · ${formatAsOn(insight.careerHigh.asOnDate)}`}
          />
        )}
      </dl>

      {insight.nextTier && (
        <p className="mt-auto border-t border-border pt-3 text-sm leading-relaxed">
          <span className="font-semibold tabular-nums">
            {formatPoints(insight.nextTier.gap)} more points
          </span>{" "}
          <span className="text-muted-foreground">
            to reach the {tierPhrase(insight.nextTier.rank)}, which takes{" "}
            {formatPoints(insight.nextTier.points)} this week
          </span>
        </p>
      )}

      {/* One line of what this rank means for entries. The full rules, with their
          source, are in the panel below — this is the pointer, not the argument. */}
      {gates && (
        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
          {gates.closed.length > 0
            ? `At this rank: ${gates.summary.toLowerCase()}.`
            : "At this rank, every tournament level is open to enter."}
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        as on {formatAsOn(entry.asOnDate)}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="shrink-0 text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * The player's own points as a band, so their bar can sit beside the list's
 * averages in the same chart.
 *
 * Which columns are deductions is read off the API's aggregate bands rather than
 * re-derived here — the pipeline already made that call from the printed header,
 * and a second rule in the browser is a second chance to disagree with it.
 */
function playerBand(entry: PlayerCurrentEntry, name: string): RankingBandProfile | null {
  const bands = entry.insight.bands ?? [];
  // No aggregates means no way to tell a deduction column from a scoring one, and
  // nothing to compare the player against. Both reasons to skip the panel.
  if (bands.length === 0) return null;
  const components = entry.points.slice(0, -1);
  if (components.length < 2) return null;

  const classified = new Map(
    bands.flatMap((band) =>
      (band.composition ?? []).map((slice) => [slice.label, slice.isDeduction] as const),
    ),
  );

  return {
    // The child's own name, not "This player". The bar sits directly above three
    // rows labelled "Top 10", "Ranked 11–100" and "Ranked 101 and below", and a
    // parent scanning that stack should find the person they came for by name
    // rather than by working out which row must be theirs.
    label: name,
    from: entry.rank,
    to: entry.rank,
    playerCount: 1,
    averageTotal: entry.totalPoints,
    composition: components.map((point) => ({
      label: point.label,
      average: point.value,
      isDeduction: classified.get(point.label) ?? false,
    })),
  };
}
