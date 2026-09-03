import type { RankingStateCount } from "../services/api";

/**
 * Where the players on this list come from.
 *
 * ── Why this is folded away ──────────────────────────────────────────────────
 * It is the least actionable panel on the page. A parent cannot move state, and
 * knowing that Haryana ranks more players than Kerala changes nothing they will
 * do on Monday. It stays because it is real context for anyone who wants it —
 * how competitive the child's own state is, whether the entries near them are
 * thin or crowded — but it opens closed so that the panels a parent can act on
 * are the ones they meet first.
 *
 * Two charts rather than one, deliberately. "How many are ranked" and "how many
 * reach the top 100" are measures of wildly different scale — a state with 214
 * ranked players and three in the top hundred would render as a bar and an
 * invisible stub, and putting them on two scales in one plot would be the
 * dual-axis mistake. Side by side, each on its own axis, the interesting fact
 * shows up by itself: the states that rank the most players are not always the
 * states that produce the best ones.
 *
 * Aggregate counts only. Nothing here identifies a child, which is why this is
 * the part of the mirror that is safe to have indexed.
 */
export function StateDistribution({
  stateCounts,
  listLabel,
  limit = 8,
}: {
  stateCounts: RankingStateCount[];
  listLabel: string;
  limit?: number;
}) {
  if (stateCounts.length < 3) return null;

  const byCount = [...stateCounts].sort((a, b) => b.count - a.count).slice(0, limit);
  const byElite = [...stateCounts]
    .filter((s) => s.inTop100 > 0)
    .sort((a, b) => b.inTop100 - a.inTop100 || b.count - a.count)
    .slice(0, limit);

  const totalRanked = stateCounts.reduce((sum, s) => sum + s.count, 0);

  return (
    <details className="group bg-card rounded-xl border">
      <summary className="cursor-pointer list-none px-5 py-4 sm:px-6">
        <span className="flex items-center justify-between gap-3">
          <span className="text-base font-semibold tracking-tight">
            Which states these players come from
          </span>
          <span
            className="text-muted-foreground shrink-0 text-sm font-medium transition-transform group-open:rotate-180"
            aria-hidden
          >
            ▾
          </span>
        </span>
        <span className="text-muted-foreground mt-1 block text-sm">
          {stateCounts.length} states and union territories, {totalRanked.toLocaleString("en-IN")}{" "}
          ranked players in all.
        </span>
      </summary>

      <div className="border-t px-5 py-5 sm:px-6">
        <p className="text-muted-foreground text-sm leading-relaxed">
          The state that ranks the most players is not always the state that produces the best ones.
          Compare the two lists below.
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <BarList
            heading={`Most ${listLabel} players ranked`}
            rows={byCount.map((s) => ({ label: s.state, value: s.count }))}
            unit="ranked players"
          />
          {byElite.length >= 3 && (
            <BarList
              heading="Most players inside the top 100"
              rows={byElite.map((s) => ({ label: s.state, value: s.inTop100 }))}
              unit="players in the top 100"
            />
          )}
        </div>
      </div>
    </details>
  );
}

/**
 * One single-series bar list. Each row states its own value, so the bar is
 * reinforcement rather than the only way to read the chart, and no legend is
 * needed — the heading names the one series.
 */
function BarList({
  heading,
  rows,
  unit,
}: {
  heading: string;
  rows: Array<{ label: string; value: number }>;
  unit: string;
}) {
  const peak = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div>
      <h4 className="text-sm font-medium">{heading}</h4>
      <ol className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.label} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2">
            <span className="text-muted-foreground truncate text-xs" title={row.label}>
              {row.label}
            </span>
            <span className="bg-rank-track h-2 overflow-hidden rounded-full" aria-hidden>
              <span
                className="bg-rank-accent block h-full rounded-full"
                style={{ width: `${Math.max((row.value / peak) * 100, 2)}%` }}
              />
            </span>
            <span className="text-right text-xs font-semibold tabular-nums">
              {row.value.toLocaleString("en-IN")}
              <span className="sr-only"> {unit}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
