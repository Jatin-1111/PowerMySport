import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { NOINDEX_METADATA } from "@/lib/seo";
import { fetchPlayer, formatAsOn } from "@/modules/rankings/api";
import { RankTrajectory } from "@/modules/rankings/RankTrajectory";
import { comboHref, comboLabel } from "@/modules/rankings/config";
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
 */
export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: "Player ranking history — PowerMySport",
};

export default async function PlayerRankingPage({
  params,
}: {
  params: Promise<{ regNo: string }>;
}) {
  const { regNo } = await params;
  if (!/^\d{4,8}$/.test(regNo)) notFound();

  const data = await fetchPlayer(regNo);
  if (!data) notFound();

  const { player, current, history } = data;
  const name = player.fullName ?? `Player ${player.regNo}`;

  // Chart the list the player has the most history in — usually their main age
  // group, and the one where a trend is actually readable.
  const byCombo = new Map<string, typeof history>();
  for (const point of history) {
    const key = `${point.category}|${point.subcategory}`;
    const bucket = byCombo.get(key);
    if (bucket) bucket.push(point);
    else byCombo.set(key, [point]);
  }
  const charted = [...byCombo.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[{ label: "Rankings", href: "/rankings" }, { label: name }]}
        className="mb-6"
      />

      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          AITA registration {player.regNo}
          {player.state && (
            <>
              <span className="mx-1.5" aria-hidden>
                ·
              </span>
              {player.state}
            </>
          )}
          {player.birthYear && (
            <>
              <span className="mx-1.5" aria-hidden>
                ·
              </span>
              Born {player.birthYear}
            </>
          )}
        </p>
      </header>

      {current.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">Current rankings</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {current.map((entry) => {
              const combo = {
                category: entry.category,
                subcategory: entry.subcategory,
              };
              return (
                <li key={entry._id}>
                  <Link
                    href={comboHref(combo)}
                    className="block rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-power-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2"
                  >
                    <span className="text-sm text-muted-foreground">
                      {comboLabel(combo)}
                    </span>
                    <span className="mt-1 flex items-baseline gap-2">
                      <span className="text-2xl font-bold tabular-nums">
                        #{entry.rank}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {entry.totalPoints.toLocaleString("en-IN")} pts
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      as on {formatAsOn(entry.asOnDate)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {charted.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Ranking history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Week by week, from the archived AITA lists.
          </p>

          {charted.slice(0, 3).map(([key, points]) => {
            const [category, subcategory] = key.split("|");
            const label = comboLabel({
              category: category ?? "",
              subcategory: subcategory ?? "",
            });
            if (points.length < 2) return null;
            return (
              <div key={key} className="mt-6 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">{label}</h3>
                <RankTrajectory
                  points={points.map((p) => ({ asOnDate: p.asOnDate, rank: p.rank }))}
                  label={label}
                />
              </div>
            );
          })}
        </section>
      )}

      {history.length === 0 && current.length === 0 && (
        <p className="mt-10 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No ranking history held for this player.
        </p>
      )}

      <p className="mt-10 text-xs text-muted-foreground">
        Rankings are published by the All India Tennis Association and mirrored here.
        PowerMySport is not affiliated with AITA.
      </p>
    </div>
  );
}
