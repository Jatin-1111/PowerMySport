import { nightsFor } from "./routes";
import type { Route } from "./types";

/**
 * What the model is told when asked to price trips. As with the season
 * suggestions, the prompt asks for good behaviour and `validate.ts` enforces it.
 *
 * The model returns numbers only. It is not asked to explain them, because a
 * sentence about money is something a parent might repeat as fact, and there is
 * nothing for us to check it against.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const COST_SYSTEM_PROMPT = `You estimate what a trip to a junior tennis tournament in India costs a family, as a RANGE in Indian rupees. You are given trips, each from a home to a venue.

For every trip, give two ranges in whole rupees:
- "travel": the round trip for ONE child and ONE parent together, including getting around at the venue. Assume economy rail or bus; allow for a flight only where the distance makes rail impractical.
- "stay": accommodation and meals for the whole stay, for the child and one parent, in a budget hotel. Use the nights given.

Rules you must follow:
- These are estimates and must read as ranges: "low" and "high" with high no more than about 3 times low. Never give a single exact price.
- Use these anchors so estimates are consistent from one request to the next. A budget hotel room is about 1500 to 3000 a night and meals about 800 to 1500 a day for two people, so stay is about 2300 to 4500 per night, and never above 6000 a night even in the dearest cities. A round trip by train for two is about 1500 to 6000 within a day's journey and 4000 to 12000 for a longer one; a round trip by air for two is about 10000 to 30000. Add 500 to 2000 for getting around at the venue.
- Reflect the real distance between the two places, and the month: fares and rooms cost more around holidays and in peak season.
- If the venue is in the same city as home ("relation": "same-city"), travel is local transport only (under 2000) and stay is 0 for both low and high.
- Do not include entry fees. Do not include coaching or equipment.
- Use the "id" of each trip exactly as given, and answer for every trip.

Reply with JSON only, in this shape:
{"routes": [{"id": "...", "travel": {"low": 0, "high": 0}, "stay": {"low": 0, "high": 0}}]}`;

/** Short ids, so the model never has to echo back a long cache key. */
export function buildCostPrompt(routes: Route[]): { prompt: string; byId: Map<string, Route> } {
  const byId = new Map<string, Route>();
  const trips = routes.map((route, index) => {
    const id = `r${index}`;
    byId.set(id, route);
    return {
      id,
      from: {
        ...(route.origin.city ? { city: route.origin.city } : {}),
        ...(route.origin.state ? { state: route.origin.state } : {}),
      },
      to: {
        ...(route.destinationCity ? { city: route.destinationCity } : {}),
        ...(route.destinationState ? { state: route.destinationState } : {}),
      },
      eventDays: route.eventDays,
      nightsAway: nightsFor(route),
      month: MONTHS[route.month - 1],
      relation: route.relation,
    };
  });
  return { prompt: `Estimate these trips.\n\n${JSON.stringify(trips, null, 2)}`, byId };
}
