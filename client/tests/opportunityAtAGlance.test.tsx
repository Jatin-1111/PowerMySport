// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AtAGlance } from "@/modules/opportunities/components/AtAGlance";
import type { Opportunity } from "@/modules/opportunities/services/opportunities";

const entry = (over: Partial<Opportunity> = {}): Opportunity =>
  ({
    slug: "india-khelo-football-ikf",
    track: "admission",
    category: "academy",
    title: "India Khelo Football",
    sports: ["football"],
    allSports: false,
    selection: "trials",
    benefit: { summary: "A route to clubs and scouts." },
    eligibility: { gender: "any" },
    cycleState: "rolling",
    stale: false,
    sources: [{ label: "Trials", url: "https://example.org/trials" }],
    lastVerifiedOn: "2026-10-03",
    ...over,
  }) as Opportunity;

const rowOf = (label: string) => {
  const term = screen.getByText(label);
  return term.parentElement as HTMLElement;
};

afterEach(cleanup);

describe("AtAGlance", () => {
  it("shows the cost and the one-line who when the entry states them", () => {
    render(
      <AtAGlance
        opportunity={entry({
          cost: { kind: "fee", amount: 125, currency: "INR", note: "City round. Free for girls" },
          eligibility: { gender: "any", summary: "Aspiring footballers of any age" },
        })}
      />
    );
    expect(within(rowOf("Cost")).getByText("₹125. City round. Free for girls")).toBeTruthy();
    expect(
      within(rowOf("Who can apply")).getByText("Aspiring footballers of any age")
    ).toBeTruthy();
  });

  it("leaves the cost row out when the entry does not say, rather than showing free", () => {
    render(<AtAGlance opportunity={entry()} />);
    expect(screen.queryByText("Cost")).toBeNull();
    expect(screen.queryByText(/^Free/)).toBeNull();
    expect(within(rowOf("Who can apply")).getByText("See the rules below")).toBeTruthy();
  });

  it("does not offer the follow button on an entry with no dates", () => {
    render(<AtAGlance opportunity={entry()} />);
    expect(screen.queryByText(/Tell me when the dates move|Sign in/)).toBeNull();
  });

  it("points at the official page when there is no application link", () => {
    render(<AtAGlance opportunity={entry()} />);
    const link = screen.getByRole("link", { name: /Open the official page/ });
    expect(link.getAttribute("href")).toBe("https://example.org/trials");
  });
});
