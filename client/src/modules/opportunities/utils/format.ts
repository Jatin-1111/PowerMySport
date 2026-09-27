import { SPORT_LABEL } from "@/modules/pathway/config/tournamentDisplay";

import type { Opportunity } from "../services/opportunities";

/** "2026-07-30" -> "30 Jul 2026". Stored dates carry no time zone, so none is applied. */
export function formatDay(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const PERIOD: Record<string, string> = {
  "one-time": "",
  month: " a month",
  year: " a year",
  total: " in total",
};

/** "₹6,28,000 a year", in the currency's own grouping. */
export function formatAmount(amount: NonNullable<Opportunity["benefit"]>["amount"]): string | null {
  if (!amount) return null;
  const money = new Intl.NumberFormat(amount.currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency: amount.currency,
    maximumFractionDigits: 0,
  }).format(amount.value);
  return `${amount.note ? `${amount.note}: ` : ""}${money}${PERIOD[amount.period] ?? ""}`;
}

/** "All sports", or the named sports. */
export function sportsLabel(opportunity: Pick<Opportunity, "allSports" | "sports">): string {
  if (opportunity.allSports) return "All sports";
  return opportunity.sports.map((slug) => SPORT_LABEL[slug] ?? slug).join(", ");
}

export function whereLabel(geography: Opportunity["geography"]): string | null {
  if (!geography) return null;
  switch (geography.scope) {
    case "state":
      return geography.state ? `${geography.state} only` : "One state";
    case "india":
      return "Across India";
    case "international":
      return "International";
    case "abroad":
      return "Abroad";
    default:
      return null;
  }
}

/** One line on where this cycle's window stands. */
export function cycleLine(opportunity: Opportunity): string | null {
  const { cycle, cycleState } = opportunity;
  const label = cycle?.label ? `${cycle.label} ` : "";
  switch (cycleState) {
    case "open":
      return cycle?.closesOn ? `Open now, closes ${formatDay(cycle.closesOn)}` : "Open now";
    case "upcoming":
      return cycle?.opensOn ? `Opens ${formatDay(cycle.opensOn)}` : "Opening soon";
    case "closed":
      return `The ${label}window closed${cycle?.closesOn ? ` on ${formatDay(cycle.closesOn)}` : ""}. Next cycle's dates are not out yet.`;
    default:
      return null;
  }
}
