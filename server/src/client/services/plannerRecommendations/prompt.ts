import { JUNIOR_LADDER } from "@powermysport/shared-types";
import type { SeasonGoal } from "../../models/SeasonPlan";
import { buildSeason, realismOf } from "./builder";
import type { RecommendationContext } from "./types";

/**
 * What the model is told. It is NOT asked to choose a season: code has already built
 * one (`builder.ts`), fitting the plan, the rest days, the allowance and the budget. It is
 * asked to put each pick into a plain sentence and to describe the shape of the season.
 * The prompt asks for good wording; `validate.ts` enforces it, so nothing here is relied
 * on for safety.
 */

const GOAL_BRIEF: Record<SeasonGoal, string> = {
  points:
    "Climb the ranking: the season favours the higher rungs of the circuit. Do not claim how many points an event is worth: that is not in the data.",
  experience:
    "Play often and build match experience: the season favours entry-level rungs, where AITA does not cut the draw by ranking.",
  home: "Stay close to home: the season favours events whose inHomeState is true. Do not guess distances: only the state is in the data.",
};

export const SYSTEM_PROMPT = `You help a parent plan their child's junior tennis season in India. A season has already been chosen for ONE child. You do not choose events. For each event in "picks" you write one short sentence saying why it suits the child, and you describe the season in a line or two.

You are a writer, not a source. Everything you say must come from the data you are given.

Rules you must follow:
- Write a sentence for every pick whose "wording" is "yours". Use each event's "slug" exactly as given. Never add an event, a date, a venue or an entry rule that is not in the data. Do not write for picks whose "wording" is "fixed".
- Every pick is already confirmed open to enter and fits around "alreadyPlanned" and the rest days. Do not question that, and do not mention events that are not listed.
- Each sentence is ONE sentence of at most 25 words. It must state a concrete fact from the data about that event: its rung, its state, its dates, its surface, its entry deadline, or how it sits against another event. No filler such as "a good fit" or "a great opportunity". Do not repeat the same sentence shape for every event.
- A pick with "tier": "consider" is an alternative, not part of the main plan. Say what makes it a reasonable option.
- Write dates the way a parent would say them, like "11 Oct", never as 2026-10-11.
- Refer to the child only as "they". You are given no name, and the child's gender is not in the data, so never use he, she, his, her or him.
- Do not state any number that is not a date or a rank in the data.
- Do not mention prices, costs or budgets. Do not promise entry or results: say "open to enter", never "will get in". Do not say one event has a stronger or easier field than another.
- If an entry deadline is null, it has not been published. Do not guess one.
- No em dashes or en dashes.

Reply with JSON only, in this shape:
{"summary": "one or two sentences on the shape of the season", "picks": [{"slug": "...", "reason": "..."}]}`;

const ladderMeaning = new Map<string, string>(JUNIOR_LADDER.map((rung) => [rung.name, rung.plain]));

export function buildUserPrompt(context: RecommendationContext, now = new Date()): string {
  const season = buildSeason(context, now);
  const all = new Map(
    [...context.candidates, ...context.olderCandidates].map((candidate) => [
      candidate.slug,
      candidate,
    ])
  );

  const picks = season.items.flatMap((item) => {
    const candidate = all.get(item.slug);
    if (!candidate) return [];
    // Stretch events, qualifying-only options and older groups carry what past draws
    // showed. That is reported in the code's own words, so the model is not asked to write it.
    const fixed =
      item.tier === "reach" ||
      candidate.older === true ||
      candidate.reach === "qualifying" ||
      realismOf(candidate) === "uncertain";
    return [
      {
        slug: candidate.slug,
        tier: item.tier,
        wording: fixed ? "fixed" : "yours",
        name: candidate.name,
        startDate: candidate.startDate.slice(0, 10),
        ...(candidate.endDate ? { endDate: candidate.endDate.slice(0, 10) } : {}),
        ...(candidate.city ? { city: candidate.city } : {}),
        ...(candidate.state ? { state: candidate.state } : {}),
        ...(candidate.ladder
          ? { rung: candidate.ladder, rungMeaning: ladderMeaning.get(candidate.ladder) ?? null }
          : {}),
        ...(candidate.surface ? { surface: candidate.surface } : {}),
        entryDeadline: candidate.deadline ? candidate.deadline.slice(0, 10) : null,
        inHomeState: candidate.inHomeState,
      },
    ];
  });

  const data = {
    today: context.today,
    child: {
      // No name: it adds nothing to the wording, and a child's name is not ours to send
      // to a model provider. Reasons say "they".
      list: context.child.list,
      rank: context.child.rank,
      registeredState: context.child.state,
    },
    goal: { name: context.effectiveGoal, brief: GOAL_BRIEF[context.effectiveGoal] },
    alreadyPlanned: context.committed.map(({ slug, name, startDate, endDate }) => ({
      slug,
      name,
      startDate: startDate.slice(0, 10),
      ...(endDate ? { endDate: endDate.slice(0, 10) } : {}),
    })),
    picks,
  };
  return `Word this child's season.\n\n${JSON.stringify(data, null, 2)}`;
}
