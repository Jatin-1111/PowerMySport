# Planner recommendation evaluation

Answers one question: **is the planner's "Suggest my season" any good, and did a change make
it better or worse?** It runs the real recommender against 19 synthetic children and a frozen
copy of the real calendar, and scores every answer.

Nothing here is a real child. The calendar is public tournament data.

## Run it

Build first (`npm run build` in `server/`), then:

```bash
# Rules only. No network, no database, a few seconds. Exit code 1 if any rule is broken.
node dist/evals/plannerRecommendations/run.js --label my-change

# Also run Gemini: 19 children x 2 runs = 38 calls, spaced to stay under the rate limit.
node dist/evals/plannerRecommendations/run.js --model --runs 2 --label my-change-model

# Write review-sheet.csv, for hand-labelling whether suggestions are realistic.
node dist/evals/plannerRecommendations/run.js --model --review-sheet --label my-change-model
```

Reports go to `docs/planner-eval/<label>.md` (and `.json`). Options: `--only <child-id>`,
`--runs <n>`, `--delay-ms <n>`, `--out <dir>`.

The rules-only run is also a test (`src/tests/plannerEval.test.ts`): it fails the suite if
the rules-only recommender breaks a rule for any profile.

## What the numbers mean

**Violations must be zero.** They are rule breaks counted by arithmetic in `score.ts`, not by
calling the code that built the answer: an event that was never offered, two recommended
events that overlap or leave under two clear days, a pick inside the parent's blocked dates, a
pick whose entries have closed, more recommended events than yearly entries left, options
offered when no entry is left, a reason that promises a place or names another event's city.

**Diagnostics describe, they do not judge.** Reach (events above Championship Series, whose
draws are cut by ranking), spread across states, levels and months, how many reasons state a
concrete fact, and how repetitive the reasons are. The model run adds how often it fell back
to the rules, what validation had to repair, tokens and latency, and how stable it is when
asked twice.

**Realism is the number that matters and the one that cannot be computed.** Whether a pick is
realistic for that child needs a person who knows the circuit. Until there are labels the
report says "not measured" and shows reach as a stand-in.

## Hand labels

1. Run with `--review-sheet`.
2. Open `docs/planner-eval/review-sheet.csv`, fill the `realistic` column with `Y` or `N`
   (would a coach call this a sensible suggestion for that child?).
3. Save it as `src/evals/plannerRecommendations/fixtures/labels.csv`, keeping only the first
   three columns (`child_id,event_slug,realistic`).
4. Re-run: the report now shows the share of recommended events labelled realistic.

A few hours of a tennis-knowledgeable person's judgement is worth more than any amount of
logged clicks at this stage.

## Keeping it honest

- **Do not tune the engine to these 19 children.** Add a profile when a real case surprises
  us, with the reason it exists.
- **Refreeze the calendar** when the profiles need events that have since passed:
  `node dist/evals/plannerRecommendations/exportCalendar.js --today YYYY-MM-DD`. It is a read
  of public tournament data (autoIndex off, no models written). Dates in the profiles
  (`blockedRanges`) must still fall inside the new calendar. Expect numbers to move; compare
  two runs only on the same frozen calendar.
- A model run spends Gemini calls on the production key. It sends only synthetic profiles
  and the public calendar.
