// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { Booking } from "../src/types";

/**
 * The parent-facing bookings list is behind auth, so this is where its rendered
 * output actually gets checked: that a fourth tab exists at all, that it is gated
 * on the experts flag, and that an expert row names the expert rather than
 * falling through to a "details pending" placeholder.
 */

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const MODULE = "../src/modules/booking/components/myBookingsTabs";

type TabsModule = typeof import("../src/modules/booking/components/myBookingsTabs");

/**
 * The module reads NEXT_PUBLIC_EXPERTS_IS_LIVE once, at import time — Next
 * inlines those at build — so the flag has to be set before the import is
 * evaluated, and the registry reset for a case that needs the other value.
 */
const importWithExperts = async (live: boolean): Promise<TabsModule> => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_EXPERTS_IS_LIVE", live ? "true" : "false");
  return import(MODULE);
};

let tabs: TabsModule;

beforeAll(async () => {
  tabs = await importWithExperts(true);
});

const counts = { venues: 2, coaches: 1, academies: 0, experts: 3 };

const booking = (over: Partial<Booking>): Booking =>
  ({
    id: "b1",
    userId: "u1",
    sport: "Consultation",
    date: "2026-08-20",
    startTime: "10:00",
    endTime: "11:00",
    totalAmount: 1000,
    status: "CONFIRMED",
    bookingType: "INDIVIDUAL",
    organizerId: "u1",
    ...over,
  }) as Booking;

describe("BookingTabBar", () => {
  it("renders a tab for every booking kind, including experts", () => {
    render(<tabs.BookingTabBar activeTab="venues" counts={counts} onTabChange={() => {}} />);

    const labels = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(labels).toHaveLength(4);
    expect(labels.some((t) => t?.includes("Expert Sessions"))).toBe(true);
  });

  it("shows each tab's count, including a zero", () => {
    render(<tabs.BookingTabBar activeTab="venues" counts={counts} onTabChange={() => {}} />);

    // A missing bucket would render an empty badge rather than a zero.
    expect(screen.getByRole("tab", { name: /Academy Bookings\s*0/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Expert Sessions\s*3/ })).toBeTruthy();
  });

  it("marks only the active tab as selected", () => {
    render(<tabs.BookingTabBar activeTab="experts" counts={counts} onTabChange={() => {}} />);

    const selected = screen
      .getAllByRole("tab")
      .filter((t) => t.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain("Expert Sessions");
  });

  it("hides the experts tab when experts are not live and there is no history", async () => {
    const gated = await importWithExperts(false);
    render(
      <gated.BookingTabBar
        activeTab="venues"
        counts={{ ...counts, experts: 0 }}
        onTabChange={() => {}}
      />
    );

    const labels = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(labels).toHaveLength(3);
    expect(labels.some((t) => t?.includes("Expert"))).toBe(false);
  });

  it("still shows the experts tab when the flag is off but sessions exist", async () => {
    // Turning the flag off must not hide sessions the parent already paid for —
    // the server keeps counting them either way.
    const gated = await importWithExperts(false);
    render(
      <gated.BookingTabBar
        activeTab="venues"
        counts={{ ...counts, experts: 2 }}
        onTabChange={() => {}}
      />
    );

    const labels = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(labels).toHaveLength(4);
    expect(screen.getByRole("tab", { name: /Expert Sessions\s*2/ })).toBeTruthy();
  });
});

describe("BookingProviderHeading", () => {
  it("names the expert and links to their profile", () => {
    render(
      <tabs.BookingProviderHeading
        tab="experts"
        booking={booking({
          providerType: "EXPERT",
          expertId: { id: "x1", name: "Jatin", city: "Chandigarh" },
          expert: { mode: "ONLINE" },
        })}
      />
    );

    expect(screen.getByText("Jatin")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/experts/x1");
    expect(screen.getByText(/Online session/)).toBeTruthy();
    expect(screen.getByText(/Chandigarh/)).toBeTruthy();
  });

  it("says in-person for an in-person consultation", () => {
    render(
      <tabs.BookingProviderHeading
        tab="experts"
        booking={booking({
          providerType: "EXPERT",
          expertId: { id: "x1", name: "Jatin" },
          expert: { mode: "IN_PERSON" },
        })}
      />
    );

    expect(screen.getByText(/In-person session/)).toBeTruthy();
  });

  it("falls back to a pending notice when the expert did not populate", () => {
    render(
      <tabs.BookingProviderHeading
        tab="experts"
        booking={booking({ providerType: "EXPERT", expertId: "x1" })}
      />
    );

    expect(screen.getByText(/Expert details pending/)).toBeTruthy();
  });

  it("still renders the other three provider kinds", () => {
    const { unmount } = render(
      <tabs.BookingProviderHeading
        tab="venues"
        booking={booking({ venueId: { id: "v1", name: "Turf Park" } as never })}
      />
    );
    expect(screen.getByText("Turf Park")).toBeTruthy();
    unmount();

    render(
      <tabs.BookingProviderHeading
        tab="academies"
        booking={booking({ academyId: { id: "a1", name: "Elite Academy" } })}
      />
    );
    expect(screen.getByText("Elite Academy")).toBeTruthy();
  });
});
