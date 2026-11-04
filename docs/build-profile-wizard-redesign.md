# "Build the Profile" Wizard Redesign

Design doc from a discussion on 2026-07-19. Scope: the "Already know it? → Build the profile" path on `/find-sport` (currently `SportKnownFlow.tsx`). No implementation yet — this is the finalized shape to build against.

## Problem statement

`SportKnownFlow` currently reuses the discovery wizard's (`WizardShell`) components and, for two fields, its literal identical question wording. A parent who already knows their child's sport gets asked the same sport-agnostic personality/physical proxy questions a parent with no idea what sport to pick would get asked. That reads as a trimmed-down quiz, not an expert intake, and undermines trust with parents who already have domain knowledge about their kid.

Separately (structural, not a wizard problem, but relevant to whether this redesign matters): `PathwayService` (roadmap generation) only takes `sport + state` — it ignores all wizard input entirely, cached generically per sport+state. Only the `/guidance` AI flow consumes granular wizard fields. Any redesign needs its data to actually reach `guidance` (and ideally `roadmap`) or the extra questions are wasted effort. Also note: `useGuidanceForm.ts`'s `applyPlayerToForm()` currently never maps `player.eyesight`/`player.agility` even though the schema defines them — an existing bug, separate from this redesign.

## Design principle

Discovery wizard = sport-agnostic proxy questions, since there's no sport yet to anchor to. Fine as-is.

Build-the-profile = the parent already has domain knowledge. Questions should read like a coach doing an intake, not a psychologist doing a discovery quiz — sport-specific, achievement-oriented, phrased around real competitive milestones instead of abstract trait proxies.

## Shared skeleton (applies to every sport)

1. **Identity** — name, age/DOB, gender, state/city. Unchanged from today.
2. **Current standing** — one question, using the sport's archetype ladder (see below). Replaces the old 3-tier `experienceLevel` (Beginner/Intermediate/Competitive). Paired with **years playing this specific sport** (a number, not a bucket).
3. **Training setup** — replaces the old single `trainingType` dropdown:
   - Currently trains under a coach? (Y/N)
   - Academy/coach name (free text, optional)
   - Sessions per week + typical session length
   - How long at current academy/coach
4. **Best result / track record** (new section, structured-lite):
   - **Best result so far** (dropdown) — same option-set as the sport's current-standing archetype ladder, but framed as best-ever rather than current level (e.g. for Federation sports: None yet / District win-or-selection / State win-or-selection / National selection-or-medal / International selection-or-medal)
   - **Anything else you'd like to share?** (optional free text) — tournament names, specific medals, years
5. **Physical basics** — height/weight (optional, gated by sport relevance), dominant-side field (hand/foot/eye — sport-dependent, see sport layer table), and **injury/limitation history** (new, asked nowhere today).
6. **Goals** — replaces the generic 4-tier `ambition` slider (identical wording to discovery wizard today) with sport-anchored real milestones: "trying for district/state trials this season" / "aiming for academy/national camp selection" / "improving for school team" / "fitness/enjoyment only."
7. **Logistics** — weekly hours + budget, roughly unchanged from today.

**Time estimate:** ~18-19 fields total (up from today's 12-13) → update the card copy from "~3 minutes" to **"~5 minutes"**, and reframe the copy itself to sell the extra length as depth rather than friction — e.g. *"~5 minutes · we ask more because we already know your sport."*

## Archetype system (current-standing + best-result ladders)

Competitive structure isn't universal across sports, so instead of one ladder or fully-bespoke-per-sport, there's one question *slot* with four possible option-sets ("archetypes"), assigned internally per sport — the parent never sees archetypes, just the ladder that matches their sport.

| Archetype | Ladder (tier 1 → tier 5) |
|---|---|
| **A — Federation/administrative** | Just starting/school-only → District level → State level → National level → International exposure |
| **B — Ranking/tournament-tier** | Just starting/academy-only → Local & state ranking tournaments → National ranking tournaments (top grades) → Nationally ranked → International junior circuit (ITF/BWF etc.) |
| **C — Rating-based** | Unrated/just starting → State-rated → Nationally rated (FIDE) → FIDE-rated internationally → Titled/international age-group ranking |
| **D — Qualifying-standard** (time or score — swap unit label per sport, same archetype) | No standard yet → Meets district/club qualifying [time/score] → Meets state qualifying standard → Meets national qualifying standard → Meets international/Olympic qualifying standard |

Ladders are altitude-matched across archetypes (tier 1 always "just starting," tier 5 always "international") so they can normalize into one internal scale later if needed.

**Golf is punted for now** — it's handicap-based (a single declining number), doesn't fit any of the four archetypes, needs its own shape if/when golf is prioritized.

## Sport → archetype mapping (current 14 supported sports)

| Sport | Archetype | Why |
|---|---|---|
| Cricket | A — Federation | School → district → state → zonal → national trials |
| Football | A — Federation | District/state/national via AIFF-state associations, trials-based |
| Basketball | A — Federation | School/district/state/national, team-trial based |
| Kabaddi | A — Federation | Purely district/state/national, no individual ranking system |
| Wrestling | A — Federation | Weight-category trials, selection-based |
| Volleyball | A — Federation | Team sport, district/state/national selection |
| Gymnastics | A — Federation | Judged scores exist, but the level a parent tracks is competition tier, not a portable number |
| Tennis | B — Ranking-tier | AITA/ITF ranking tournaments, no district structure |
| Badminton | B — Ranking-tier | Individually ranking-tiered by points even though tournaments are federation-tiered by prize/prestige — parent tracks rank, not tournament grade |
| Table Tennis | B — Ranking-tier | Same shape as badminton — TTFI ranking tournaments |
| Chess | C — Rating-based | FIDE/AICF rating, no tiers, just a number |
| Athletics | D — Qualifying-standard (time) | Personal-best times against state/national qualifying standards |
| Swimming | D — Qualifying-standard (time) | Personal-best times, SGFI/state/national qualifying standards |
| Shooting | D — Qualifying-standard (score) | NRAI Minimum Qualification Score system — same shape as time-based, different unit |

## Sport-specific layer

On top of the shared skeleton, each sport gets: (1) gating/adaptation of shared fields (which dominant-side field, which archetype unit), and (2) a "role/discipline" slot always asked, plus sometimes one specialization field where it's a genuinely distinct training path (not forced everywhere).

| Sport | Role/discipline (always) | Specialization (only where it's a real fork) | Dominant-side field |
|---|---|---|---|
| Cricket | Batter / Bowler / All-rounder / Wicketkeeper | Bowling type (Pace/Spin) — if bowler/all-rounder | Hand |
| Football | Goalkeeper / Defender / Midfielder / Forward | — | Foot |
| Basketball | Guard / Forward / Center | — | Hand |
| Volleyball | Setter / Attacker / Libero / Blocker | — | Hand (hitting arm) |
| Kabaddi | Raider / Defender / All-rounder | — | — (not meaningfully relevant) |
| Wrestling | Freestyle / Greco-Roman (boys); Freestyle (girls) | Weight category (can derive from existing height/weight field) | — |
| Gymnastics | Artistic / Rhythmic | Apparatus focus (artistic only, optional) | — |
| Tennis | — (no positions) | Singles-focus / Doubles-focus / Both | Hand |
| Badminton | — | Singles-focus / Doubles-focus / Both | Hand |
| Table Tennis | — | Grip: Shakehand / Penhold | Hand |
| Chess | — | Format focus: Classical/Rapid/Blitz (optional); **FIDE ID (optional)** — see idea below | — |
| Athletics | Sprints / Middle-distance / Long-distance / Jumps / Throws / Combined events | — | — |
| Swimming | Primary stroke: Free/Back/Breast/Fly/IM | Distance focus: Sprint/Middle/Distance (optional) | — |
| Shooting | Discipline: Rifle / Pistol / Shotgun | — | **Dominant eye**, not hand |

This adds roughly 1-2 fields per sport on top of the shared skeleton, mostly optional/gated, so it shouldn't meaningfully change the ~5 minute estimate.

## Parked ideas (not decided, not in scope yet)

- **FIDE ID auto-pull for chess** — if the parent provides a FIDE ID, auto-pull the real rating instead of asking manually. Chess is the one sport where this is viable: FIDE ratings are a single canonical number in one long-running public database covering the full pyramid, not just elite players. Needs a technical feasibility spike later (FIDE has no official API — would mean scraping their public ratings page, a technical/legal question, not a design one).
- **Why this doesn't extend to tennis/badminton/table tennis:** their public rankings (BWF/ITF junior, AITA/BAI/TTFI domestic lists) either aren't structured/queryable (PDF-based) or only cover international-circuit players — a tiny sliver of actual users. Auto-pull would return "not found" for most parents, which reads worse than just asking. Athletics/swimming don't need it either — personal-best times are precisely self-known and self-reported, no ambiguous "rating" to look up.
- **Golf archetype** — punted, needs its own handicap-based shape if prioritized.

## Not yet addressed by this doc

- Exact wording/copy for each question (drafted at a conceptual level above, not final UX copy)
- Whether `PathwayService` gets updated to consume this richer profile data, or whether it stays sport+state only and only `/guidance` benefits
- The `useGuidanceForm.ts` eyesight/agility mapping bug (separate fix, unrelated to this redesign)
- Component architecture / whether `SportKnownFlow` continues to share input components with `WizardShell`, or gets its own component set
