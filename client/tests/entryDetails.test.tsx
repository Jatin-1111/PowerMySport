// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TournamentEdition } from "../src/modules/pathway/services/pathway";
import { EntryDetails, hasEntryDetails } from "../src/modules/tournaments/components/EntryDetails";

const edition: TournamentEdition = {
  sportSlug: "tennis",
  name: "AITA NS (Hyderabad)",
  editionYear: 2026,
  startDate: "2026-10-24T00:00:00.000Z",
  sourceUrl: "https://example.test/calendar",
  status: "announced",
  lastCheckedAt: "2026-10-08T23:00:00.103Z",
  officialDetailsSource: "factSheet",
  feeSingles: 900,
  feeDoubles: 1100,
  dailyAllowance: 800,
  surface: "Hard",
  mainDrawCourts: 9,
  indoorOutdoor: "Outdoors",
  eventsPlayed: "Boys 18&Under, Girls 18&Under",
  entryOpensDate: "2026-08-11T00:00:00.000Z",
  registrationDeadlineDate: "2026-10-05T00:00:00.000Z",
  deadlineTimes: { entryCloses: "23:59" },
};

describe("EntryDetails", () => {
  it("shows the fees, the conditions and the dated deadlines with their IST times", () => {
    render(<EntryDetails edition={edition} finished={false} federationName="AITA" />);
    expect(screen.getByText("₹900")).toBeTruthy();
    expect(screen.getByText("₹1,100 per pair")).toBeTruthy();
    expect(screen.getByText("Hard")).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
    expect(screen.getByText("Outdoors")).toBeTruthy();
    expect(screen.getByText("Boys 18&Under, Girls 18&Under")).toBeTruthy();
    expect(screen.getByText(/5 October 2026, 11:59 pm IST/)).toBeTruthy();
  });

  it("leaves out a line the source did not print", () => {
    render(
      <EntryDetails
        edition={{ ...edition, balls: undefined, mainDrawCourts: undefined }}
        finished={false}
        federationName="AITA"
      />
    );
    expect(screen.queryByText("Balls")).toBeNull();
    expect(screen.queryByText("Main draw courts")).toBeNull();
  });

  it("says when the figures are the rules, not the event's own page", () => {
    render(
      <EntryDetails
        edition={{ ...edition, officialDetailsSource: "rules" }}
        finished={false}
        federationName="AITA"
      />
    );
    expect(screen.getByText(/published rules for this level/)).toBeTruthy();
  });

  it("only applies to a record that carries details from a source", () => {
    expect(hasEntryDetails(edition)).toBe(true);
    expect(hasEntryDetails({ ...edition, officialDetailsSource: undefined })).toBe(false);
  });
});
