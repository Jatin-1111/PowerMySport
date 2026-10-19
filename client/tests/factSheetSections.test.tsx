// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TournamentEdition } from "../src/modules/pathway/services/pathway";
import {
  FactSheetSections,
  hasFactSheetSections,
} from "../src/modules/tournaments/components/FactSheetSections";
import type { FactSheetDetails } from "../src/modules/tournaments/types/factSheet";
import {
  describeDrawCode,
  telHref,
  websiteHref,
} from "../src/modules/tournaments/utils/entryFormat";

const details: FactSheetDetails = {
  draws: [
    {
      code: "BS18",
      stage: "main",
      size: 64,
      startDate: "2026-10-26",
      endDate: "2026-10-26",
      signIn: null,
    },
    {
      code: "BS18",
      stage: "qualifying",
      size: 48,
      startDate: "2026-10-24",
      endDate: "2026-10-25",
      signIn: { date: "2026-10-23", time: "18:00" },
    },
  ],
  organisation: {
    name: "Example State Tennis Association",
    contact: "A. Contact",
    address: "Room 12, Example Stadium",
    postalCode: "500001",
    phone: "0400000000",
    email: "association@example.test",
  },
  director: { name: "Director Example", phone: "9000000001", email: "director@example.test" },
  referee: {
    name: "Referee Example",
    phone: "9000000002",
    email: "referee@example.test",
    certification: "ITF White Badge Referee",
  },
  academy: {
    name: "Example Tennis Academy",
    contact: null,
    address: null,
    postalCode: "501504",
    city: null,
    phone: null,
    email: null,
    website: "www.example-academy.test",
  },
  venue: {
    name: "Example Tennis Academy",
    contact: null,
    address: "2-64, Sample Gardens,, Sampleville,",
    postalCode: "501504",
    city: null,
    phone: "9000000003",
    email: null,
    website: "www.example-academy.test",
  },
  travel: { airport: "Example International Airport", trainStation: "Example Junction" },
  additional: { meeting: null, notes: ["Example Academy Room Rates", "Double: ₹3,400"] },
  hotel: {
    name: "Example Tennis Academy",
    distanceFromVenue: "Inside the venue",
    contact: null,
    phone: null,
    city: null,
    address: null,
    doublePrice: { amount: 3400, note: "Without Tax" },
    breakfastIncluded: true,
  },
};

const edition = {
  sportSlug: "tennis",
  name: "AITA NS (Hyderabad)",
  editionYear: 2026,
  startDate: "2026-10-24T00:00:00.000Z",
  sourceUrl: "https://example.test",
  status: "announced",
  lastCheckedAt: "2026-10-08T23:00:00.000Z",
  factSheetDetails: details,
} as TournamentEdition;

describe("FactSheetSections", () => {
  it("lists the draws in words, with the sign-in deadline and IST time", () => {
    render(<FactSheetSections edition={edition} />);
    const draws = screen.getByRole("region", { name: "Draws and sign-in" });
    expect(within(draws).getAllByText("Boys' singles, under 18")).toHaveLength(2);
    expect(within(draws).getByText("Qualifying")).toBeTruthy();
    expect(within(draws).getByText(/23 October 2026, 6:00 pm IST/)).toBeTruthy();
    expect(within(draws).getByText("On the day")).toBeTruthy();
  });

  it("shows the venue once when the host academy is the venue", () => {
    render(<FactSheetSections edition={edition} />);
    expect(screen.getByText("Venue")).toBeTruthy();
    expect(screen.queryByText("Host academy")).toBeNull();
    expect(screen.getByText("₹3,400 (without tax)")).toBeTruthy();
    expect(screen.getByText("Included")).toBeTruthy();
    expect(screen.getByText("Example International Airport")).toBeTruthy();
  });

  it("shows contacts as printed, as links", () => {
    render(<FactSheetSections edition={edition} />);
    const organisers = screen.getByRole("region", { name: "Organisers and contacts" });
    expect(within(organisers).getByText("ITF White Badge Referee")).toBeTruthy();
    const email = within(organisers).getByText("director@example.test");
    expect(email.getAttribute("href")).toBe("mailto:director@example.test");
    expect(within(organisers).getByText("9000000002").getAttribute("href")).toBe("tel:9000000002");
  });

  it("shows the organiser's notes as written, under their own heading", () => {
    render(<FactSheetSections edition={edition} />);
    const notes = screen.getByRole("region", { name: "Notes from the organiser" });
    expect(within(notes).getByText("Example Academy Room Rates")).toBeTruthy();
    expect(within(notes).getByText("Double: ₹3,400")).toBeTruthy();
  });

  it("renders nothing for a record without the blocks", () => {
    const { container } = render(
      <FactSheetSections edition={{ ...edition, factSheetDetails: undefined }} />
    );
    expect(container.innerHTML).toBe("");
    expect(hasFactSheetSections({ ...edition, factSheetDetails: undefined })).toBe(false);
    expect(hasFactSheetSections(edition)).toBe(true);
  });
});

describe("entry formatting helpers", () => {
  it("reads draw codes in words and leaves unknown ones as printed", () => {
    expect(describeDrawCode("BS18")).toBe("Boys' singles, under 18");
    expect(describeDrawCode("GD14")).toBe("Girls' doubles, under 14");
    expect(describeDrawCode("MS")).toBe("Men's singles");
    expect(describeDrawCode("XYZ")).toBe("XYZ");
  });

  it("makes links only from values that look like phones and websites", () => {
    expect(telHref("+91 99669 64371; 90142 15357")).toBe("tel:+919966964371");
    expect(telHref("n/a")).toBeNull();
    expect(websiteHref("www.example.com")).toBe("https://www.example.com");
    expect(websiteHref("not a site")).toBeNull();
  });
});
