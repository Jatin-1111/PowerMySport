import type { RankingBandProfile } from "../services/api";
import {
  ROLLED_DOWN_PREFIX,
  explainTotal,
  formatPoints,
  plainPointLabel,
  seriesClass,
} from "../utils/insights";

/**
 * Where the points actually come from.
 *
 * ── What this panel is for ───────────────────────────────────────────────────
 * It is the one thing on the page a ranking table cannot tell a parent: that the
 * players above their child are frequently not winning more of the same events,
 * they are drawing points from somewhere the child has not been. In Boys
 * Under-16 that "somewhere" turns out to be Under-18 — the leader carries 1,041
 * of his 1,291 points down from playing up an age group.
 *
 * ── Why every bar is reconciled before it is drawn ───────────────────────────
 * The printed columns do not add up to the printed total; see `explainTotal`,
 * which is where that arithmetic and its two causes are documented. This
 * component draws nothing it cannot account for. If a band's parts refuse to
 * reconcile, the whole panel is withheld rather than shown with a caveat — a
 * stacked bar makes an implicit promise that its segments are the total, and a
 * chart that quietly breaks that promise is worse than no chart, because the
 * reader has no way to know.
 *
 * Deduction columns (the no-show cut) are kept out of the stack and noted
 * underneath. Stacking a deduction on top of the things it deducts from would
 * make every bar taller than the total it is meant to explain.
 */
export function PointsComposition({
  bands,
  subcategory,
  title = "Where these points come from",
  caption,
}: {
  bands: RankingBandProfile[];
  /** Needed to name the bracket whose points roll down into this list. */
  subcategory: string;
  title?: string;
  caption?: string;
}) {
  // ── Which total the bars are accountable to ───────────────────────────────
  // `averageTotal` is exact over the whole band, because every row carries a
  // total. From August 2026 the *composition* is measured from a sample of the
  // band — the source stopped printing components per row — so the slices sum to
  // `compositionTotal` instead, and reconciling them against the whole-band
  // average would invent a residual out of the difference between two populations.
  //
  // Everything on this chart is therefore stated against the players it was
  // measured from: the bar, the number beside it, and the table total all use the
  // same figure, and the sample size is shown next to it. Older snapshots have no
  // `compositionTotal` and fall back to `averageTotal`, which for them is the
  // same population.
  const explained = bands.map((band) => {
    const total = band.compositionTotal ?? band.averageTotal;
    return {
      band,
      total,
      // A band that carries a sample size came from the new source, whose
      // breakdown names the roll-down and nets the penalty already — there is no
      // residual left to recover, and deriving one would duplicate a real slice.
      parts: explainTotal(band.composition ?? [], total, subcategory, {
        deriveRollDown: band.sampleSize === undefined,
      }),
      /** Set only when fewer players were measured than the band holds. */
      sampled:
        typeof band.sampleSize === "number" && band.sampleSize < band.playerCount
          ? band.sampleSize
          : null,
    };
  });

  // All or nothing. A panel where two bars reconcile and one silently does not
  // invites exactly the comparison it cannot support.
  if (explained.length === 0 || explained.some((entry) => entry.parts === null)) {
    return null;
  }

  // One ordered legend across every band, so a source keeps its colour even in a
  // band where it happens to be zero.
  const legend: string[] = [];
  for (const entry of explained) {
    for (const slice of entry.parts!.slices) {
      if (!legend.includes(slice.label)) legend.push(slice.label);
    }
  }
  if (legend.length < 2) return null;

  const colorOf = (label: string) => seriesClass(legend.indexOf(label));
  const showsRollDown = legend.some((label) => label.startsWith(ROLLED_DOWN_PREFIX));
  const showsDoublesQuarter = bands.some((band) =>
    (band.composition ?? []).some(
      (slice) => /\b25\s*%/.test(slice.label) && /DBLS|DOUBLES/i.test(slice.label),
    ),
  );

  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {caption ??
          "Each bar is one part of the list, and the colours show what that group's points were made of on average. The full bar is their total, so the widths can be compared directly."}
      </p>

      {/* A legend is present because there is more than one series, so identity
          never rests on colour alone. */}
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {legend.map((label) => (
          <li key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-sm ${colorOf(label)}`}
              aria-hidden
            />
            <span title={label}>{plainPointLabel(label)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-4">
        {explained.map(({ band, parts, total, sampled }) => {
          const slices = parts!.slices;
          const stacked = slices.reduce((sum, slice) => sum + slice.value, 0);

          return (
            <div key={band.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">
                  {bandLabel(band.label)}
                  {/* Suppressed at one, where the count is both wrong-sounding
                      and already implied by the label. */}
                  {band.playerCount > 1 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {band.playerCount.toLocaleString("en-IN")} players
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {band.playerCount > 1 ? "avg " : ""}
                  {formatPoints(total)} pts
                  {/* The bar can only speak for the players behind it. Saying so
                      here, next to the number, rather than in a footnote nobody
                      reaches. */}
                  {sampled !== null && (
                    <span className="ml-1.5 text-xs">
                      (from {sampled} of {band.playerCount.toLocaleString("en-IN")})
                    </span>
                  )}
                </span>
              </div>

              {/* 2px gaps rather than borders separate the segments — a stroke
                  around a fill reads as a fifth colour. Segments flex-grow by
                  value, so the gaps come out of the row's width and never
                  distort the proportions between them. */}
              {stacked > 0 && (
                <div className="mt-1.5 flex h-3 gap-[2px]" aria-hidden>
                  {slices.map((slice) => (
                    <span
                      key={slice.label}
                      title={`${plainPointLabel(slice.label)}: ${formatPoints(slice.value)} points`}
                      className={`h-full first:rounded-l-sm last:rounded-r-sm ${colorOf(slice.label)}`}
                      style={{ flex: `${slice.value} 0 0` }}
                    />
                  ))}
                </div>
              )}

              {parts!.deductions.length > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {parts!.deductions
                    .map(
                      (slice) =>
                        `${plainPointLabel(slice.label)}: −${formatPoints(slice.value)}`,
                    )
                    .join(" · ")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* The two rules that make the bars add up. Without them a parent reading
          carefully would find the arithmetic short and have no way to explain it. */}
      <div className="mt-5 space-y-1.5 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
        {showsDoublesQuarter && (
          <p>
            <span className="font-medium text-foreground">Doubles:</span> only a
            quarter of doubles points count towards the ranking. The figures here
            are the quarter that counts.
          </p>
        )}
        {showsRollDown && (
          <p>
            <span className="font-medium text-foreground">Playing up:</span> when a
            player also enters the next age group, that whole score is added to
            this one. It is why the leading players can be so far ahead.
          </p>
        )}
      </div>

      {/* The chart's twin. Every value in the bars is here as text, which is what
          makes the panel usable without colour vision, without CSS, and to
          anyone who wants the actual numbers. */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
          Show the numbers
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Comes from
                </th>
                {explained.map(({ band }) => (
                  <th key={band.label} scope="col" className="py-2 pl-3 text-right font-semibold">
                    {bandLabel(band.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {legend.map((label) => (
                <tr key={label} className="border-b last:border-0">
                  <th scope="row" className="py-2 pr-3 font-normal">
                    {plainPointLabel(label)}
                  </th>
                  {explained.map(({ band, parts }) => (
                    <td
                      key={band.label}
                      className="py-2 pl-3 text-right tabular-nums text-muted-foreground"
                    >
                      {formatPoints(
                        parts!.slices.find((slice) => slice.label === label)?.value ?? 0,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-2 pr-3 font-semibold">
                  Total
                </th>
                {explained.map(({ band, total }) => (
                  <td key={band.label} className="py-2 pl-3 text-right font-semibold tabular-nums">
                    {formatPoints(total)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

/**
 * The server labels the bands "Top 10", "11–100", "101 and below". The bare
 * ranges read as quantities rather than positions — "11–100" beside a points
 * figure looks like it might be points. Naming the axis fixes that.
 */
function bandLabel(raw: string): string {
  return /^\d/.test(raw) ? `Ranked ${raw}` : raw;
}
