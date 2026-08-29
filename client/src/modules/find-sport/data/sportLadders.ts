// ─── Per-sport ladder overrides ─────────────────────────────────────────────
//
// The archetype ladders in sportArchetypes.ts are a *fallback*: four generic
// shapes that are roughly true for most sports and precisely true for none.
// This file is the layer above them — a hand-authored ladder for a specific
// sport, checked against that sport's own governing-body documentation.
//
// Author an entry here when the generic archetype ladder states something the
// sport's circuit does not actually have. The tennis entry exists because the
// generic `ranking` ladder had a "State ranking" rung: AITA's junior circuit is
// individual entry by ranking with NO state selection step, so that rung was
// asking parents about a thing that doesn't exist. (The state's real role in
// tennis is zone eligibility — Talent Series is open only to players registered
// in that zone — not a rank tier.)
//
// ── Two rules for anyone adding a sport here ──
//
// 1. TIER VALUES ARE STORED. `currentStandingTier` / `bestResultTier` persist
//    on the Player document as the bare number 1–5. Changing WHICH rung a
//    number means silently re-points every existing row. So an override must
//    keep 5 rungs valued 1–5, and each rung should be the nearest true
//    equivalent of the generic rung it replaces. Tennis tier 2 was "State
//    ranking" and is now "AITA ranked — Talent / Championship Series": both
//    describe a player at the entry rung of competitive play, so stored rows
//    survive the swap without a migration.
//
// 2. NAME THE BODY. `bodyName` is surfaced in the question copy so the parent
//    is answering about AITA specifically, not about an abstract "ranking".
//
// 3. CHECK THE SPORT'S OWN BODY — never pattern-match a neighbouring sport.
//    Tennis, badminton, table tennis and squash all share the `ranking`
//    archetype and all four ladders came out different: tennis has no state
//    rung at all, badminton's state rung is where the mandatory BAI ID is
//    issued, table tennis's state ranking is a published number that directly
//    allots national entry, and squash grades its whole circuit by star rating
//    instead. "It's a racket sport" predicts nothing. Chess went further and
//    needed a rung its archetype has no concept of.

export interface LadderTier {
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
  /** Secondary line shown under the label — used to spell out nuance (e.g.
   * tier 1 is about competitive record, not raw skill or time played). */
  context?: string;
}

export interface SportLadder {
  /** Short form used inline in question copy — "AITA", "BAI". */
  bodyName: string;
  currentStanding: LadderTier[];
  bestResult: LadderTier[];
}

// ─── Tennis (AITA) ──────────────────────────────────────────────────────────
//
// Ladder taken from AITA's junior tournament structure: Talent Series (TS3/TS7)
// → Championship Series (CS3/CS7) → Super Series → National Series → Nationals
// (Hard Court + Clay) → ITF Junior Circuit. Two mechanics make it a pathway
// rather than a list, and both are why the rungs are grouped the way they are:
// entry to SS/NS is gated on ranking, and success locks you OUT of the rungs
// below (top 150 are barred from TS in their age group, top 75 from CS).

const TENNIS: SportLadder = {
  bodyName: "AITA",
  currentStanding: [
    {
      value: 1,
      label: "No AITA ranking yet",
      context:
        "Hasn't played an AITA ranking tournament yet — no matter how long or how seriously they've trained",
    },
    {
      value: 2,
      label: "Talent / Championship Series",
      context: "Playing TS or CS events — the entry rungs of the AITA junior circuit",
    },
    {
      value: 3,
      label: "Super Series / National Series",
      context: "Ranked high enough to enter AITA's Super Series and National Series events",
    },
    {
      value: 4,
      label: "Junior Nationals",
      context: "Plays the AITA junior Nationals — Hard Court and Clay",
    },
    {
      value: 5,
      label: "ITF junior circuit",
      context: "Competing on the ITF world junior circuit",
    },
  ],
  bestResult: [
    { value: 1, label: "None yet" },
    { value: 2, label: "Won or reached the final of a TS/CS event" },
    { value: 3, label: "Won or reached the final of a Super Series / National Series event" },
    { value: 4, label: "Reached the main draw at the junior Nationals" },
    { value: 5, label: "Competed on the ITF junior circuit" },
  ],
};

// ─── Badminton (BAI) ────────────────────────────────────────────────────────
//
// NOTE FOR ANYONE READING THIS AFTER THE TENNIS ENTRY: badminton keeps a state
// rung, and that is not an oversight. Tennis lost its state rung because AITA
// has no state selection step; BAI's structure is genuinely different. State
// associations run their own state ranking tournaments (Karnataka's U-11/U-13
// state ranking events, Delhi's DCBA ranking), and the BAI ID that All India
// Ranking Tournaments require is issued *through* the state association. State
// play is a real rung here, so removing it would be the same error in reverse.
//
// The rung that actually separates players at national level is qualifying vs.
// main draw: an All India Junior Ranking event runs 500+ boys through the
// qualifying draw for 32 direct main-draw entries, and the winners get direct
// entry into the Indian team for the BWF World Junior Championships.

const BADMINTON: SportLadder = {
  bodyName: "BAI",
  currentStanding: [
    {
      value: 1,
      label: "No BAI ranking yet",
      context:
        "Hasn't played an All India Ranking tournament yet — no matter how long or how seriously they've trained",
    },
    {
      value: 2,
      label: "District / state ranking",
      context: "Registered with the state association and playing district or state ranking tournaments",
    },
    {
      value: 3,
      label: "All India Ranking — qualifying",
      context: "Has a BAI ID and plays All India Sub-Junior / Junior Ranking events through the qualifying draw",
    },
    {
      value: 4,
      label: "All India main draw / Nationals",
      context: "Ranked high enough for direct main-draw entry, or plays the Zonal and National Championships",
    },
    {
      value: 5,
      label: "BWF junior circuit",
      context: "Competing internationally — Badminton Asia Junior or the BWF World Junior Championships",
    },
  ],
  bestResult: [
    { value: 1, label: "None yet" },
    { value: 2, label: "Won or reached the final of a district / state ranking tournament" },
    { value: 3, label: "Came through qualifying at an All India Ranking tournament" },
    { value: 4, label: "Reached an All India Ranking main draw, or medalled at the Nationals" },
    { value: 5, label: "Represented India at a BWF / Badminton Asia junior event" },
  ],
};

// ─── Table tennis (TTFI) ────────────────────────────────────────────────────
//
// Table tennis keeps a state rung for a stronger reason than badminton: the
// state ranking is a formal, published number that directly gates national
// entry. State associations compute it as "points of Best 4 tournaments plus
// the points of State Championships", and entry to the UTT National Ranking
// Championships is allotted off it — higher state-ranked players get
// guaranteed slots, everyone else enters as "extra entry".
//
// The national ranking events run as five zonal legs rather than one national
// event, which is why tier 3 names zones. Age groups run deeper than the other
// two sports: Hopes (U9/U11), Cadet (U13), Sub-Junior (U15), Junior, Youth.

const TABLE_TENNIS: SportLadder = {
  bodyName: "TTFI",
  currentStanding: [
    {
      value: 1,
      label: "No state ranking yet",
      context:
        "Hasn't played a state ranking tournament yet — no matter how long or how seriously they've trained",
    },
    {
      value: 2,
      label: "State ranked",
      context: "Has a state ranking — best 4 state ranking tournaments plus the State Championship",
    },
    {
      value: 3,
      label: "National Ranking Championships",
      context: "State ranking is high enough to enter the UTT National Ranking Championships in their zone",
    },
    {
      value: 4,
      label: "National Championships",
      context: "Plays the Junior / Youth National Championships or Inter-State",
    },
    {
      value: 5,
      label: "ITTF youth circuit",
      context: "Competing internationally — WTT Youth Contender or the World Junior Championships",
    },
  ],
  bestResult: [
    { value: 1, label: "None yet" },
    { value: 2, label: "Won or reached the final of a state ranking tournament" },
    { value: 3, label: "Medalled at a National Ranking Championship" },
    { value: 4, label: "Medalled at the National Championships or Inter-State" },
    { value: 5, label: "Represented India at an ITTF / WTT youth event" },
  ],
};

// ─── Chess (AICF) ───────────────────────────────────────────────────────────
//
// Chess is the one authored sport whose archetype under-describes it. The
// `rating` archetype models a single ladder of rating milestones, but an
// Indian junior is climbing TWO things at once: a rating number, and a
// championship qualification ladder (district -> State Championship -> Zonal
// -> National Youth -> Asian/World Youth). The rungs below fold the second
// into the first, because the two track each other closely in practice.
//
// What IS real, and what the generic ladder got right: AICF runs its own
// national rating list (the "Bharat Chess Rating System") alongside FIDE, so
// an Indian rating and a FIDE Elo are genuinely two different numbers and two
// different rungs. Do not collapse them.
//
// What the generic ladder got WRONG, and why tier 2 is reworded: there is no
// such thing as a "state rating". Ratings in India are national (AICF) or
// international (FIDE) — nothing in between. The real rung between unrated and
// AICF-rated is simply playing rated events, of which the state age-group
// championship is the one that matters: 15% of its participants qualify onward
// to Zonals, and the top 3 juniors qualify directly. (A FIDE rating of 2200+
// bypasses the whole ladder with direct entry to the National Championship.)

const CHESS: SportLadder = {
  bodyName: "AICF",
  currentStanding: [
    {
      value: 1,
      label: "Unrated",
      context:
        "Hasn't played a rated tournament yet — no matter how long or how seriously they've trained",
    },
    {
      value: 2,
      label: "Playing rated tournaments",
      context: "Has an AICF ID and plays rated events, including the state age-group championship",
    },
    {
      value: 3,
      label: "AICF rated",
      context: "Has an Indian national rating on the AICF list",
    },
    {
      value: 4,
      label: "FIDE rated",
      context: "Has an international FIDE rating — 2200+ means direct entry to the Nationals",
    },
    {
      value: 5,
      label: "Titled, or National Youth level",
      context: "Holds a FIDE title, or plays the National Youth and Asian/World Youth championships",
    },
  ],
  bestResult: [
    { value: 1, label: "None yet — unrated" },
    { value: 2, label: "Played the state age-group championship" },
    { value: 3, label: "Qualified onward from the state championship, or earned an AICF rating" },
    { value: 4, label: "Played the National Youth / Sub-Junior championships, or earned a FIDE rating" },
    { value: 5, label: "Earned a FIDE title (CM/FM/IM), or played an Asian / World Youth championship" },
  ],
};

// ─── Squash (SRFI) ──────────────────────────────────────────────────────────
//
// Squash grades its whole junior circuit by STAR RATING, and that — not a
// state/national split — is what a squash parent actually recognises. The
// National Junior Circuit runs from non-ranking and 1-2 star events up through
// the 4-star Khelo India Youth Games, the four 5-star SRFI Slams (Northern,
// Southern, Western, Eastern), the 6-star Indian Junior Open as the apex
// domestic event, and 7-star Asian and World Junior Individuals. Points scale
// with the stars: 135 for a 1-star win, 945 for a 6-star.
//
// On the state question: state championships do exist and are SRFI-sanctioned
// (e.g. the Gujarat State Squash Championship), but interstate and state-level
// play "does not carry significant ranking points" and there is no state
// ranking list. So state play sits inside tier 2 as entry-level competition
// rather than earning a rung of its own — a middle answer between tennis
// (no state rung at all) and table tennis (state ranking gates everything).

const SQUASH: SportLadder = {
  bodyName: "SRFI",
  currentStanding: [
    {
      value: 1,
      label: "No SRFI ranking yet",
      context:
        "Hasn't played a ranking event on the National Junior Circuit yet — no matter how long or how seriously they've trained",
    },
    {
      value: 2,
      label: "State & entry-level circuit",
      context: "Plays state championships and non-ranking, 1-star or 2-star junior events",
    },
    {
      value: 3,
      label: "SRFI ranked — Slams & Khelo India",
      context: "Ranked on the National Junior Circuit, playing the 5-star SRFI Slams or Khelo India Youth Games",
    },
    {
      value: 4,
      label: "Junior Nationals / Indian Junior Open",
      context: "Plays the Junior National Championship or the 6-star Indian Junior Open",
    },
    {
      value: 5,
      label: "Asian / World Junior",
      context: "Competing at 7-star level — Asian Junior or World Junior Individuals",
    },
  ],
  bestResult: [
    { value: 1, label: "None yet" },
    { value: 2, label: "Won or reached the final of a state or 1-2 star junior event" },
    { value: 3, label: "Medalled at an SRFI Slam or Khelo India Youth Games" },
    { value: 4, label: "Medalled at the Junior Nationals or the Indian Junior Open" },
    { value: 5, label: "Represented India at the Asian or World Junior Individuals" },
  ],
};

// Keys must be normalised sport keys — see normalizeSportKey.
const SPORT_LADDERS: Record<string, SportLadder> = {
  tennis: TENNIS,
  badminton: BADMINTON,
  "table tennis": TABLE_TENNIS,
  chess: CHESS,
  squash: SQUASH,
};

/**
 * The hand-authored ladder for a sport, or undefined when that sport hasn't
 * been authored yet and should fall back to its archetype ladder.
 *
 * Takes an already-normalised key — callers go through sportArchetypes.ts.
 */
export function getSportLadderByKey(normalizedKey: string): SportLadder | undefined {
  return SPORT_LADDERS[normalizedKey];
}
