You are writing the **tennis pathway guide for PowerMySport**, for Indian parents.

Return **one JSON object** matching the JSON Schema at the end of this message.
No markdown, no code fences, no commentary — just the JSON.

---

## Who is reading this

A parent in India whose child plays tennis. They have never dealt with a sports
federation. They are trying to answer one question at every step: **"where is my
child now, and what actually happens next?"**

## The rule that governs everything: describe MOVEMENT, not definitions

You are drawing a ladder, not writing an encyclopedia. For every rung the parent
must be able to see how you get on, what changes once you are on it, what locks
you out, and what carries you to the next one.

Test every sentence: *does this tell the parent something about moving forward?*
If it only says what something **is**, cut it — or fold the fact into a sentence
about movement.

| Don't write | Write |
|---|---|
| "AITA is the governing body for tennis in India." | "No entry is accepted without an AITA ITN number, so this is the first thing to get — and it must be current on the entry deadline, not the match day." |
| "The Talent Series is the entry-level series." | "Talent Series is where an unranked child starts, because unranked players cannot be placed in a main draw anywhere else — and once inside the top 150 they are barred from it and must move up." |
| "UTR is a rating from 1 to 16.5." | "Compare your child's UTR against last year's draw for the same event. If the whole draw sits two points above them, you are paying for a first-round loss." |
| "State associations organise tournaments." | "Your state sits in one of four AITA zones, and Talent Series events are open only to players registered in that zone — so where you live decides how far you drive for two years." |

Institutional facts are allowed only as **the reason a gate opens or closes**,
never as a standalone paragraph. A stage is not an age band — it is a change in
what the child is *allowed to do*. `summary` and `movingUp` must make that
transition legible.

## Produce these nine stages, in this order

Use these exact `key` values and `number`s.

| # | key | title | rough ages |
|---|-----|-------|-----------|
| 1 | `discover` | Discover Tennis | 3–8 |
| 2 | `getting-started` | Getting Started | 4–8 |
| 3 | `foundation` | Foundation | 8–10 |
| 4 | `competitive` | Competitive | 10–12 |
| 5 | `national-pathway` | National Pathway | 12–14 |
| 6 | `high-performance` | High Performance | 14–18 |
| 7 | `career-decisions` | Career Decisions | 16–18 |
| 8 | `professional` | Professional Tennis | 17+ |
| 9 | `beyond-playing` | Beyond Playing | 18+ |

---

# VERIFIED FACTS — use these, do not substitute your own

From AITA's official junior tournament structure and registration notices. Where
these contradict your prior knowledge, **these win**. Where you need a fact not
listed here, describe the *mechanism* without the number and tell the parent
where to check it.

## The ladder — this is the spine, get it exactly right

```
Talent Series (TS3 / TS7)
  → Championship Series (CS3 / CS7)
  → Super Series (SS)
  → National Series (NS)
  → Nationals — there are TWO: Hard Court and Clay
  → ITF Junior Circuit (J30 … J500) → Junior Grand Slams
```

**Do not omit National Series. Do not omit Talent Series.** Both are real and
distinct rungs. Put each in `india.competitionTiers` at the right `level`.

## The mechanics that make it a pathway

- **Reverse gates push players up.** The top **150** AITA-ranked players in an age
  group are **barred** from Talent Series in that group; the top **75** are barred
  from Championship Series. Succeeding locks you out of the rung below — the
  ladder is one-directional by design. This is the single clearest "how you move
  forward" mechanic in Indian tennis and must appear in the guide.
- **Annual tournament caps**, calendar year, main draw + qualifying combined:
  U12 = **18**, U14 = **25**, U16 = **30**, U18 = **no limit**.
- **Playing up is allowed and spends the same cap.** A U12 may enter U12, U14 and
  U16 events, but all of it comes out of the same 18.
- **Unranked players cannot be placed in a main draw** — they sit in qualifying or
  in the alternates. This is *why* the first events must be TS or CS3.
- **CS3 requires no entry submission at all** — sign in at the venue on Friday
  between 12:00–14:00, draw made that evening. The genuine zero-friction first
  ranked event, and almost no parent knows it exists.
- **Entry routing splits by rung** — a real trap: TS and CS entries go **to the
  tournament organiser**; SS, NS and Nationals go **through AITA's online entry
  system**, which returns an email confirmation and a dashboard reference number.
  Phone or fax confirmation is not accepted.
- **Deadlines:** entry closes **3 Mondays before** the tournament. Withdrawal
  deadline is the Monday before; freeze deadline Thursday 17:00. Late withdrawals
  are allowed twice a calendar year before penalties.
- **Ranking is the best 8 results over a rolling 52 weeks** — singles plus 25% of
  the best 8 doubles. Points from the age group above roll down into the lower
  group. ITF Junior points count **double** into AITA U18. Entering more events
  does not mechanically raise a ranking past those best 8.
- **Points scale steeply:** a Nationals win is worth 200 where a Talent Series win
  is worth 15. One good result high up beats a season of low-rung titles.
- **The ladder starts paying you.** Daily allowance to main-draw players:
  Nationals ₹1,000/day, National Series ₹800, Super Series ₹600, Championship
  Series ₹400, **Talent Series nothing**. Frame this as a milestone — where
  competing stops being purely an expense.
- **Nationals participation is mandatory for national Junior Team selection.**

## Registration — how it actually works

- The player ID is an **ITN number**. **No entry is accepted without it**, and the
  player must produce a valid ITN registration card before their first match.
- Fee was Rs 3,000, **raised to Rs 4,000 from 1 January 2021**. Treat as a
  historical anchor, not current truth — tell the parent to confirm on the portal.
- **Validity is roughly a two-year block, not annual.** Do **not** write "renewed
  annually" — that is wrong. It must simply be current and unexpired on the entry
  deadline.
- **Documents:** two proofs of date of birth — a municipal birth certificate
  issued within one year of birth (mandatory), plus either a school bonafide
  certificate on letterhead with photo and principal's signature, or a passport
  copy. Two passport photographs. Self-attested.
- Administered by AITA centrally, with the **state association as the verifying
  and routing layer** — you register *from* a state, and that state sets your zone.
- AITA now runs an online membership portal and player login. Point the parent at
  the portal; do not describe the old form-and-demand-draft flow as current.
- Complete registration **well before** the first entry deadline. Expiry is a
  common reason a child is refused entry.

---

# THE STATE — tennis is an INDIVIDUAL sport, model it correctly

**There is no state team on the AITA junior circuit.** Entry is individual, by
ranking, with no state selection step. Do **not** emit a competition tier like
"State team / selected or nominated by the state association" — that is a
team-sport model wrongly applied, and it was the main defect in the previous
version of this file.

The state has exactly four roles. Use these:

**1. Zone anchor — the consequential one.** India's states and UTs sit in four
AITA zones:

- **North** — J&K, Punjab, Chandigarh, Himachal Pradesh, Delhi, Haryana, UP, Uttarakhand
- **West** — Gujarat, Maharashtra, Goa, Madhya Pradesh, Chhattisgarh, Rajasthan
- **South** — Andhra Pradesh, Telangana, Karnataka, Tamil Nadu, Pondicherry, Kerala
- **East** — Bihar, West Bengal, Odisha, Jharkhand, Assam, Manipur, Meghalaya,
  Mizoram, Tripura, Arunachal Pradesh, Nagaland

**Talent Series events are open only to players registered in that zone**, and a
player may not enter a TS outside it. Changing zone needs a written application to
AITA citing change of residence, domicile or school; once granted it cannot change
again for six months, and the player carries the approval letter to every
tournament after.

For a parent this is the most practical state-level fact in the sport: **your
state decides the geography of your child's first two years** — driving distance,
how many events are reachable, how much of the early budget is travel. Give it
real weight in `india.stateAssociationRole` and in `gates.administrative`.

**2. Host and organiser.** States run TS and CS events, and must run a
Championship Series after every six Talent Series. State secretaries verify that
academies applying to host are AITA-registered. This is why your local calendar
looks the way it does.

**3. Registration routing and verification.**

**4. Certifier** — issues or endorses the participation and representation
certificates that university sports quotas and government job sports quotas are
assessed on. The reason to keep every certificate from age ten.

**Where state representation IS real in tennis** — use these instead of an
invented AITA state team:

- **Khelo India Youth Games** — contested as a state/UT team championship across
  36 states and UTs, tennis included; individual results roll into a state medal
  tally. Also a selection route into the Khelo India Athlete Scheme.
- **National Games** — entry by state.
- **SGFI school games** — school → district → state → national, so the child
  represents a state school team. Cheapest match volume in India, and it generates
  quota-eligible certificates.

**Be precise about team selection:** playing the Nationals is mandatory for
selection to **national Junior Teams** — India teams, not state teams.

**Restore ATF.** Asian Tennis Federation **Asian U14** events played in India
contribute 25% of the best three results into AITA U12 and U14 rankings. Not
optional colour — it is in the ranking formula, and it is the cheapest
international exposure before European or American ITF travel.

**Leave the top-level `state` field unset.** This is the national guide; `state`
is only for a guide whose *stages themselves* differ by state.

---

## Keep the two gates apart — this matters most

Every stage has `gates.administrative` (paperwork: registration, age proof, ITN,
zone, deadlines, a minimum ranking) and `gates.competitive` (the standard a child
actually needs to belong there). Never merge them.

The reason this file exists is that in tennis they come apart badly: the bottom
rung of professional tennis needs only an IPIN and an entry fee, while the AITA
junior circuit looks like bureaucracy — so families conclude the pro route is the
open one. It is the opposite. Where a rung is commonly attempted far too early,
put the honest arithmetic in `movingUp.warning`: who is actually in that draw,
what the realistic result is, and what a year of trying costs.

## Other Indian anchors

- **AITA age categories** (U-10, U-12, U-14, U-16, U-18) organise Indian junior
  selection — not school year. Put them in `india.ageCategories`.
- **UTR** is the yardstick that lets a parent compare their child against the draw
  they are considering. Use it for `standard` and as the top-level
  `progressMetric`.
- **The school route** — SGFI and inter-school tennis — is the cheapest match
  practice in India and the route most parents never hear about.
- **Funding**, each in `funding[]` with the right `kind`: Khelo India Athlete
  Scheme, state government schemes and cash awards, academy scholarships,
  corporate/CSR sponsorship, NCAA athletic scholarship, Indian university
  sports-quota seat, TOPS, prize money, and the **government job sports quota**
  (railways, PSUs, central and state departments) — the last is the most-used
  destination for Indian athletes and must not be dropped.
- **Academics**: Class 10 and 12 board years collide with peak competition years,
  and an AITA ranking earns a university sports-quota seat. Use
  `academics.boardExamNote` and `academics.quotaRoutes`. For the college route
  cover NCAA Divisions I and II, and note that Division III, NAIA and junior
  colleges also field tennis programmes.
- **Stage 9 must name real destinations**, including commentating and sports
  media, entrepreneurship, sports science, the officiating ladder from AITA
  accreditation up to ITF badge levels, and named coaching certifications: AITA
  Coach Education, ITF Coaching Certification, PTR, GPTCA.

## Hard rules

1. **Never invent a number.** Every fee, ranking threshold, scheme value and
   eligibility rule must trace to something in `sources`, or to the verified facts
   above. If you cannot source it, describe the mechanism and omit the figure —
   a wrong number misleads a family spending real money.
2. **Populate `cost.minInr` and `cost.maxInr`.** These are sourced from
   PowerMySport's own tennis pathway material, so rule 1 does not block them:
   recreational beginner ~₹30,000–80,000/yr; club/intermediate ~₹80,000–2,00,000;
   competitive state level ~₹2,00,000–5,00,000; national level ~₹5,00,000–12,00,000;
   international junior ~₹15,00,000–30,00,000+. Map these onto the stages, give
   both numbers and a label — `{ "minInr": 200000, "maxInr": 500000, "label":
   "₹2L – ₹5L a year" }` — and put "indicative, varies by city, academy and how
   much travel you choose" in `note`. **Do not** write a blanket refusal to give
   figures; a stated range with a caveat beats silence. For things AITA genuinely
   does not publish — coaching rates, entry fees — name what the money buys and
   tell the parent to get three written quotes.
3. **`sources` is required** — at least one, with a URL where one exists. Prefer
   AITA, SAI/Khelo India, ITF, NCAA and university sources over blogs.
4. **`summary` must not repeat `shortDescription`.** `shortDescription` is the
   two-line note in the stage list; `summary` is the line under the stage heading
   and must add something. The validator rejects the file if they match.
5. **Stage numbers run 1..9 with no gaps**, keys kebab-case and unique, and every
   `movingUp.toStageKey` must be the key of a stage that exists.
6. `formatVersion` is `1`. `sport` is `{ "slug": "tennis", "name": "Tennis" }`.
7. Set `verifiedOn` to the date you checked the facts, as `YYYY-MM-DD`. Every
   figure that can go stale carries a "confirm before relying on it" instruction.
8. **There is no `zone` value in the `level` enum.** Put zone-restricted events at
   level `state` and carry the restriction in `whoCanEnter` and
   `gates.administrative`.

## Don't

- Don't write a general "how to get good at tennis" guide — this is about the
  Indian system and the decisions it forces.
- Don't define institutions for their own sake. Every fact earns its place by
  explaining a gate.
- Don't pad. A short stage with five sourced facts beats a long one with twenty
  guessed ones.
- Don't imply professional tennis is the only successful outcome. College, a quota
  seat, coaching and officiating are real destinations — say what each stage is
  worth even if the child stops there, in `outcomes`.

## Tone

Plain British English. Short sentences. No hype, no motivational padding. Address
the parent as "you" and the child as "your child". Never sell — this document
earns trust by being the first thing that told them the truth about cost and odds.

---

## JSON Schema

Your output must validate against this exactly. Fields not listed are not
allowed to carry meaning — put anything else in a stage's `notes` array.

```json
{{SCHEMA}}
```
