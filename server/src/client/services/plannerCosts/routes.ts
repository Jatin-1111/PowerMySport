import { dayNumber } from "@powermysport/shared-types";
import type { Origin, Relation, Route } from "./types";

/**
 * Turning an event and a home into a Route.
 *
 * The key is what the cache is keyed on, so it has to be the same for the same
 * trip whoever asks and whatever the event is called: home, destination, how long
 * the event runs, and the month. Two parents in the same city going to the same
 * venue for the same dates share one estimate, which is both cheaper and the only
 * way two of them are ever told the same thing.
 */

export const norm = (value: string | null | undefined): string =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** An event longer than this is a typo in the calendar, not a trip. */
const MAX_EVENT_DAYS = 14;

export const eventDaysOf = (event: { startDate: string; endDate?: string | undefined }): number => {
  const days = dayNumber(event.endDate ?? event.startDate) - dayNumber(event.startDate) + 1;
  return Math.min(Math.max(days, 1), MAX_EVENT_DAYS);
};

const relationOf = (origin: Origin, city: string | null, state: string | null): Relation => {
  if (origin.kind === "city" && city && norm(origin.city) === norm(city)) return "same-city";
  // A state-only home can say whether the venue is in it; a city-only home cannot,
  // because we do not know which state that city is in. The model works it out.
  if (origin.kind === "state" && state) {
    return norm(origin.state) === norm(state) ? "same-state" : "other-state";
  }
  return "unknown";
};

/**
 * The route for one event, or null when there is no venue to estimate for. An
 * event with neither a city nor a state has nowhere to go to, and guessing one
 * would price a trip nobody is taking.
 */
export function routeFor(
  origin: Origin,
  event: {
    city?: string | null | undefined;
    state?: string | null | undefined;
    startDate: string;
    endDate?: string | undefined;
  }
): Route | null {
  if (origin.kind === "none") return null;
  const city = event.city?.trim() || null;
  const state = event.state?.trim() || null;
  if (!city && !state) return null;

  const eventDays = eventDaysOf(event);
  const month = new Date(event.startDate).getUTCMonth() + 1;
  const from = origin.kind === "city" ? norm(origin.city) : norm(origin.state);

  return {
    key: [origin.kind, from, norm(city), norm(state), `d${eventDays}`, `m${month}`].join("|"),
    origin,
    destinationCity: city,
    destinationState: state,
    eventDays,
    month,
    relation: relationOf(origin, city, state),
  };
}

/** Nights away: the event's days, since the child arrives the day before. Zero at home. */
export const nightsFor = (route: Route): number =>
  route.relation === "same-city" ? 0 : route.eventDays;

/** The one assumptions line, so every parent reads the same words for the same basis. */
export function assumptionsFor(route: Route): string {
  const nights = nightsFor(route);
  return route.relation === "same-city"
    ? "At home: local travel only, no stay."
    : `A child and one parent, economy rail or bus, ${nights} night${nights === 1 ? "" : "s"} in a budget hotel with meals.`;
}
