/**
 * HTML fixtures shaped like the pages the hitcourt platform emits.
 *
 * Extracted from `aitaRanking.test.ts` so the ingest tests can build the same
 * pages the parser tests do. A second, drifting copy of this markup would be
 * worse than useless: the whole point of the ingest tests is that two renders
 * of the SAME list are recognised as one list, which cannot be demonstrated
 * with a fixture that disagrees with the parser's.
 */
/**
 * Builds one `div.rankingCard` in the shape the hitcourt platform emits.
 *
 * Names here are invented. The real lists are lists of children, and the repo
 * should not carry their names and birth years just to have something to parse —
 * the same reason the old suite refused to carry a PDF fixture full of dates of
 * birth.
 */
export function card(options: {
  rank: number;
  playerKey: string;
  name: string;
  yob?: string;
  stateCode?: string;
  stateName?: string;
  points?: string;
  total?: string;
  tourn?: string;
  wtnSingles?: string;
  wtnDoubles?: string;
  /** "up" | "down" | "none" — rendered exactly as the source renders it. */
  move?: "up" | "down" | "none";
  movePlaces?: string;
  medal?: string;
}): string {
  const {
    rank,
    playerKey,
    name,
    yob = "2014",
    stateCode = "MH",
    stateName = "Maharashtra",
    points = "500.00",
    total = points,
    tourn = "0",
    wtnSingles = "-",
    wtnDoubles = "-",
    move = "none",
    movePlaces = "",
    medal = "",
  } = options;

  // Down-movers print an already-signed number, up-movers do not. That
  // asymmetry is real and is what `readMovement` has to absorb.
  const moveInner =
    move === "none"
      ? '<i class="fa fa-minus" aria-hidden="true"></i>'
      : `<i class="fas fa-long-arrow-alt-${move}" aria-hidden="true"></i>${movePlaces}`;

  return `<div class="rankingCard rank-row">
  <span class="rr-rank${medal ? ` ${medal}` : ""}"><span>${rank}</span></span>
  <span class="rank rr-move mx-2">${moveInner}</span>
  <span class="rr-avatar"><img src="https://bucket.example/photo/${rank}.png" alt="" loading="lazy" /></span>
  <div class="rr-who">
    <a href="javascript:void(0);" class="rr-name load-ranking-inline" data-rank="${rank}"
       data-weekof="1786300200" data-player="${playerKey}" data-category="16"
       data-short-code="BS12" title="${name}">${name}</a>
    <small class="rr-sub">
      <span class="yob-inline"><span class="yob">${yob}</span><span class="dotsep">&middot;</span></span>
      <a href="https://www.aita.hitcourt.com/ranking-view?wid=1786300200&category=BS12&page=1&record=25&state=${stateCode}" target="_self"><img src="/vendors/flags/in.png" alt="flags" title="India" />&nbsp;${stateName}</a>
    </small>
  </div>
  <div class="rr-stat"><small class="l">Born</small><span class="v">${yob}</span></div>
  <div class="rr-stat"><small class="l">Tourn.</small><span class="v tour-played">${tourn}</span></div>
  <div class="rr-wtn">
    <span class="wtn-brand"><img class="wtn-mark" src="/wtn.svg" alt="WTN" /></span>
    <span class="wtn-val"><small class="l">Single</small><b>${wtnSingles}</b></span>
    <span class="wtn-sep"></span>
    <span class="wtn-val"><small class="l">Doubles</small><b>${wtnDoubles}</b></span>
  </div>
  <div class="rr-points">
    <span class="pts"><span class="points">${points}</span> <small>pts</small></span>
    <small class="rr-meta">Total Pts. <span class="total-pts">${total}</span><span class="meta-tourn"> &middot; <span class="tour-played">${tourn}</span> Tourn.</span></small>
  </div>
  <div class="rr-detail"></div>
</div>`;
}

/** Wraps cards in the page shell, including the inline vars the page echoes. */
export function page(cards: string[], vars: { weekof?: string; category?: string } = {}): string {
  const { weekof = "1786300200", category = "BS12" } = vars;
  return `<html><head><title>AITA Rankings</title></head><body>
<script>
  var LIST_BASE = 'ranking';
  var weekof_int = ${weekof};
  var category="${category}";
  var category_id = 16;
  var record = 25;
</script>
<div class="rank-list">${cards.join("\n")}</div>
</body></html>`;
}
