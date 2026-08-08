You are writing the **tennis pathway guide for PowerMySport**, for Indian parents.

Return **one JSON object** matching the JSON Schema at the end of this message.
No markdown, no code fences, no commentary — just the JSON.

---

## Who is reading this

A parent in India whose child plays tennis. They have never dealt with a sports
federation. They want to know, at each step: what happens here, what it costs,
what the rules require, what their child actually has to be able to do, what
money exists, and what it leads to. Write short, plain sentences. Explain any
term the first time you use it.

## Produce these nine stages, in this order

Use these exact `key` values and `number`s. Titles may be adjusted if the
handbook wording differs, but keep them short.

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

## It must describe INDIAN tennis, not tennis in general

This is the whole point of the file. Anchor every stage in how the sport is
actually organised here:

- **AITA** — the All India Tennis Association — is the national body. Registration
  needs AITA membership and verified age proof, and normally goes **through your
  state tennis association**, which also hosts most early events. Say so in
  `india.registration` and `india.stateAssociationRole`.
- **AITA age categories** (U-10, U-12, U-14, U-16, U-18) are how Indian junior
  selection is organised — not by school year. Put them in `india.ageCategories`.
- **The tournament ladder**: AITA Talent Series → Championship Series → Super
  Series → Nationals, then ITF Juniors (J30–J500), then the professional tiers
  (ITF World Tour M15/W15 → ATP Challenger / WTA 125 → ATP/WTA Tour). Each goes in
  `india.competitionTiers` with the right `level`.
- **UTR** (Universal Tennis Rating) is the yardstick that lets a parent compare
  their child with the draw they are considering. Use it for `standard` and set
  it as the top-level `progressMetric`.
- **The school route** — SGFI and school/inter-school tennis — is the cheapest
  match practice in India and the route most parents never hear about. Put it in
  `india.schoolRoute` wherever it applies.
- **Government money**: the Khelo India Athlete Scheme (SAI / Ministry of Youth
  Affairs & Sports), TOPS for elite seniors, and state government schemes. Also
  academy scholarships and corporate/CSR sponsorship. Each goes in `funding[]`
  with the correct `kind`, and with `approxAnnualValueInr` **only if you can
  source the figure**.
- **Academics**: Class 10 and 12 board years collide with peak competition years,
  and an AITA ranking earns a **university sports-quota seat** in India. Use
  `academics.boardExamNote` and `academics.quotaRoutes`. For the college route
  also cover NCAA D1/D2 in the United States.

## Keep the two gates apart — this matters most

Every stage has `gates.administrative` (the paperwork: membership, age proof,
nomination, a minimum ranking) and `gates.competitive` (the standard a child
actually needs to belong there). Never merge them.

The reason this file exists is that in tennis they come apart badly: entry to the
bottom rung of professional tennis needs only an IPIN and an entry fee, while the
AITA junior circuit looks like bureaucracy — so families conclude the pro route is
the open one. Where a stage is commonly attempted far too early, put the honest
arithmetic in `movingUp.warning`: who is actually in that draw, what the realistic
result is, and what a year of trying costs.

## Hard rules

1. **Never invent a number.** Every fee, age, ranking threshold, scheme value and
   eligibility rule must trace to something in `sources`. If you cannot source it,
   **omit the field** — almost everything is optional, and an omitted field renders
   as nothing, whereas a wrong one misleads a family spending real money.
2. **Money in rupees**, with both the number and a label:
   `{ "minInr": 150000, "maxInr": 300000, "label": "₹1.5L – ₹3L a year" }`.
   Add a `note` saying costs are indicative and vary by city and academy.
3. **`sources` is required** — at least one, with a URL where one exists. Prefer
   AITA, SAI/Khelo India, ITF and university sources over blogs.
4. **`summary` must not repeat `shortDescription`.** `shortDescription` is the
   two-line note in the stage list; `summary` is the line under the stage heading
   and must add something. The validator rejects the file if they match.
5. **Stage numbers run 1..9 with no gaps**, keys are kebab-case and unique, and any
   `movingUp.toStageKey` must be the key of a stage that exists.
6. `formatVersion` is `1`. `sport` is `{ "slug": "tennis", "name": "Tennis" }`.
7. Set `verifiedOn` to the date you checked the facts, as `YYYY-MM-DD`.

## Don't

- Don't write a general "how to get good at tennis" guide — this is about the
  Indian system and the decisions it forces.
- Don't pad. A short stage with five sourced facts beats a long one with twenty
  guessed ones.
- Don't imply professional tennis is the only successful outcome. College, a
  quota seat, coaching and officiating are real destinations — say what each stage
  is worth even if the child stops there, in `outcomes`.

---

## JSON Schema

Your output must validate against this exactly. Fields not listed are not
allowed to carry meaning — put anything else in a stage's `notes` array.

```json
{{SCHEMA}}
```
