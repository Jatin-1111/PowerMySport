import {
  ENTRY_BANDS,
  JUNIOR_LADDER,
  POINTS_FORMULA,
  RULES_SOURCE,
  annualEntryCap,
  isJuniorBracket,
} from "../utils/aitaRules";

/**
 * The two panels that explain the page rather than measure anything.
 *
 * Everywhere else on these pages, a number is shown and the reader is trusted to
 * know what it is. That trust is misplaced: the ranking PDFs are written by the
 * federation for the federation, and a parent arriving from a WhatsApp forward
 * has never been told what a point is, where it comes from, or what happens when
 * their child collects enough of them. Both panels below are deliberately made
 * of short sentences and no jargon — this is the part of the page most likely to
 * be read in a second language.
 */

/**
 * Three facts, above the table, in the order a newcomer needs them: what the
 * position means, what the score means, how current it is.
 *
 * Kept to three because a fourth would push the table below the fold on a phone,
 * and the table is what people came for. Everything else waits until after it.
 */
export function HowToRead({
  listLabel,
  listSize,
  asOnLabel,
  top10Rank,
  top25Rank,
}: {
  listLabel: string;
  listSize: number | null;
  asOnLabel: string;
  /** Where the top 10% and top 25% begin. Both null on lists too short to say. */
  top10Rank: number | null;
  top25Rank: number | null;
}) {
  // The scale sentence is folded into "Rank" rather than standing on its own.
  // "Rank 160 is the top 10%" is not a separate idea from "what a rank is" — it
  // is the only thing that makes a rank mean anything, and a reader who has just
  // been told what rank measures is exactly the reader ready to hear it.
  const scale =
    top10Rank && top25Rank
      ? ` Rank ${top10Rank.toLocaleString("en-IN")} or better is the top 10% of India; rank ${top25Rank.toLocaleString("en-IN")} or better is the top 25%.`
      : "";

  const items = [
    {
      term: "Rank",
      detail:
        (listSize
          ? `Position among the ${listSize.toLocaleString("en-IN")} ${listLabel} players ranked in India. Rank 1 is the best.`
          : `Position among every ${listLabel} player ranked in India. Rank 1 is the best.`) +
        scale,
    },
    { term: "Points", detail: POINTS_FORMULA },
    {
      term: "Updated",
      detail: `AITA publishes a new list most weeks. This one is dated ${asOnLabel}.`,
    },
  ];

  return (
    <dl className="bg-muted/30 mt-6 grid gap-x-6 gap-y-3 rounded-xl border border-dashed px-5 py-4 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.term}>
          <dt className="text-sm font-semibold">{item.term}</dt>
          <dd className="text-muted-foreground mt-0.5 text-sm leading-relaxed">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * What a rank actually does — the reverse gates and the annual entry cap.
 *
 * This is the only panel on either page whose facts are not computed from the
 * lists we mirror, so it carries a visible source line. That is not decoration:
 * a parent may plan a season around it, and they are entitled to know which
 * claims we derived and which we read in someone else's rulebook.
 *
 * Renders nothing on the open-age lists, where none of these rules apply.
 */
export function EntryRules({ subcategory, listLabel }: { subcategory: string; listLabel: string }) {
  if (!isJuniorBracket(subcategory)) return null;
  const cap = annualEntryCap(subcategory);
  const isUnder18 = subcategory.trim().toUpperCase() === "U-18";

  return (
    <section className="bg-card rounded-xl border p-5 sm:p-6">
      <h3 className="text-base font-semibold tracking-tight">What a rank opens and closes</h3>

      {/* The ladder first. The gates below are stated in these names, and they
          mean nothing to someone reading them for the first time. */}
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Junior tournaments in India run in levels, easiest first:
      </p>
      <ol className="mt-2.5 space-y-1 text-sm">
        {JUNIOR_LADDER.map((rung, index) => (
          <li key={rung.name} className="flex gap-2">
            <span className="text-muted-foreground w-4 shrink-0 tabular-nums">{index + 1}.</span>
            <span>
              <span className="font-medium">{rung.name}</span>{" "}
              <span className="text-muted-foreground">— {rung.plain}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* U-18 runs no Talent Series at all, so the entry level a top-75 player
          would be shut out of does not exist there. Saying otherwise would
          describe the loss of something that was never available. */}
      {isUnder18 ? (
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          Under 18 runs no Talent Series events, and Championship Series has no ranking bar — so
          every level here is open to enter at any rank.
        </p>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          Here is the part that surprises most parents: a better rank <em>closes</em> the entry
          level. Once a player is inside the top 75 of their age group, AITA no longer lets them
          enter Talent Series — those draws are kept for players still working their way up. Every
          other level stays open.
        </p>
      )}

      {/* The bands are all about the Talent Series cut-off, so they say nothing
          true at U-18. */}
      {!isUnder18 && (
        <ul className="mt-4 space-y-2">
          {ENTRY_BANDS.map((band) => (
            <li
              key={band.range}
              className="bg-muted/50 flex flex-col gap-0.5 rounded-lg px-3.5 py-2.5 sm:flex-row sm:items-baseline sm:gap-3"
            >
              <span className="shrink-0 text-sm font-semibold tabular-nums sm:w-40">
                {band.range}
              </span>
              <span className="text-muted-foreground text-sm">{band.effect}</span>
            </li>
          ))}
        </ul>
      )}

      {cap && (
        <p className="mt-4 text-sm leading-relaxed">
          <span className="font-semibold">Tournament limit:</span>{" "}
          <span className="text-muted-foreground">
            a {listLabel} player may enter{" "}
            <span className="text-foreground font-medium tabular-nums">{cap}</span> tournaments in a
            year. Entering an older age group uses up the same allowance — it is one budget for the
            year, not one per list.
          </span>
        </p>
      )}

      <p className="text-muted-foreground mt-4 border-t pt-3 text-xs">
        Rules from the{" "}
        <a
          href={RULES_SOURCE.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="hover:text-foreground underline"
        >
          {RULES_SOURCE.label}
        </a>
        . Check the current regulations with AITA or your state association before planning entries.
      </p>
    </section>
  );
}
