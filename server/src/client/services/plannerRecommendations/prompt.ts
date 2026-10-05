import { JUNIOR_LADDER } from "@powermysport/shared-types";
import type { SeasonGoal } from "../../models/SeasonPlan";
import type { RecommendationContext } from "./types";
import { MAX_CONSIDER, MAX_RECOMMENDED } from "./types";

/**
 * What the model is told. The prompt asks for good behaviour; `validate.ts`
 * enforces it, so nothing here is relied on for safety. Its job is to make the
 * model's choices good and its reasons short and plain.
 */

const GOAL_BRIEF: Record<SeasonGoal, string> = {
  points:
    "Climb the ranking. Prefer the higher rungs of the circuit (Super Series above Championship Series above Talent Series), because they are the harder events to get into. Do not claim how many points an event is worth: that is not in the data.",
  experience:
    "Play often and build match experience. Prefer entry-level rungs (Talent Series and Championship Series), where AITA does not cut the draw by ranking, and spread events across the weeks so there is regular play with rest between.",
  home: "Stay close to home. Prefer events whose inHomeState is true, then the rest by date. Do not guess distances: only the state is in the data.",
};

export const SYSTEM_PROMPT = `You help a parent plan their child's junior tennis season in India. You choose tournaments for ONE child from a fixed list, and explain each choice in one short sentence.

You are a chooser, not a source. Everything you say must come from the data you are given.

Rules you must follow:
- Choose only from "candidates". Use each event's "slug" exactly as given. Never add an event, a date, a venue or an entry rule that is not in the data.
- Every candidate is already confirmed open to enter at this child's rank. Do not question that, and do not mention events that are not listed.
- Recommend at most ${MAX_RECOMMENDED} events as "recommended". They must fit together and around "alreadyPlanned": no two may overlap, and leave at least 2 clear days between one event ending and the next starting. Put up to ${MAX_CONSIDER} other good options as "consider".
- Respect "yearlyEntriesLeft": never recommend more events than that.
- Each reason is ONE sentence of at most 25 words. It must state a concrete fact from the data about that event: its rung, its state, its dates, its entry deadline, or how it sits against another event or the blocked dates. No filler such as "a good fit" or "a great opportunity". Do not repeat the same sentence shape for every event.
- If the goal is match experience and an event is above Championship Series, say plainly that its draw is cut by ranking, so a place is earned.
- Write dates the way a parent would say them, like "11 Oct", never as 2026-10-11.
- Refer to the child by first name or as "they". Never use he, she, his, her or him: the child's gender is not in the data.
- Do not state any number that is not a date, a rank or an age list in the data.
- Do not mention prices, costs or budgets. Do not promise entry or results: say "open to enter", never "will get in". Do not say one event has a stronger or easier field than another.
- If an entry deadline is null, it has not been published. Do not guess one.
- No em dashes or en dashes.

Reply with JSON only, in this shape:
{"summary": "one or two sentences on the shape of the season", "picks": [{"slug": "...", "tier": "recommended" | "consider", "reason": "..."}]}`;

const ladderMeaning = new Map<string, string>(JUNIOR_LADDER.map((rung) => [rung.name, rung.plain]));

export function buildUserPrompt(context: RecommendationContext): string {
  const data = {
    today: context.today,
    child: {
      firstName: context.child.firstName,
      list: context.child.list,
      rank: context.child.rank,
      registeredState: context.child.state,
    },
    goal: { name: context.effectiveGoal, brief: GOAL_BRIEF[context.effectiveGoal] },
    yearlyEntriesLeft: context.allowanceLeft,
    blockedDates: context.blockedRanges,
    alreadyPlanned: context.committed.map(({ slug, name, startDate, endDate }) => ({
      slug,
      name,
      startDate: startDate.slice(0, 10),
      ...(endDate ? { endDate: endDate.slice(0, 10) } : {}),
    })),
    candidates: context.candidates.map((candidate) => ({
      slug: candidate.slug,
      name: candidate.name,
      startDate: candidate.startDate.slice(0, 10),
      ...(candidate.endDate ? { endDate: candidate.endDate.slice(0, 10) } : {}),
      ...(candidate.city ? { city: candidate.city } : {}),
      ...(candidate.state ? { state: candidate.state } : {}),
      ...(candidate.ladder
        ? { rung: candidate.ladder, rungMeaning: ladderMeaning.get(candidate.ladder) ?? null }
        : {}),
      entryDeadline: candidate.deadline ? candidate.deadline.slice(0, 10) : null,
      inHomeState: candidate.inHomeState,
    })),
  };
  return `Plan this child's season.\n\n${JSON.stringify(data, null, 2)}`;
}
