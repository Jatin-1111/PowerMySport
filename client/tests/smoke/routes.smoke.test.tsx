// @vitest-environment jsdom
/**
 * Route smoke tests — the safety net for the features/ refactor.
 *
 * These are deliberately shallow: each route must mount, reach a real rendered
 * state, log no meaningful console errors, and still contain its landmark copy.
 * They exist to catch what a large structural refactor actually breaks — moved
 * imports, dropped props, crashed renders — not to assert business logic.
 *
 * All HTTP is mocked to empty in tests/setup/smokeSetup.tsx, so routes settle in
 * their empty/unstarted state. Landmark strings are chosen to be stable in that
 * state. If a landmark changes for a genuine copy edit, update it here.
 */
import { describe, expect, it } from "vitest";

import { renderRoute } from "./renderRoute";

import CheckoutPage from "@/app/(booking)/checkout/page";
import CoachProfilePage from "@/app/(booking)/coach/profile/page";
import CoachVerificationPage from "@/app/(booking)/coach/verification/page";
import GuidancePage from "@/app/(marketing)/guidance/page";
import InventoryPage from "@/app/(booking)/(venue-lister)/venue-lister/inventory/page";
import MyBookingsPage from "@/app/(booking)/(player)/dashboard/my-bookings/page";
import RoadmapPage from "@/app/(marketing)/roadmap/page";

describe("route smoke tests", () => {
  it("/coach/profile", async () => {
    const { text } = await renderRoute(CoachProfilePage, { role: "coach" });
    expect(text).toContain("Coach Dashboard");
    expect(text).toContain("Service Mode");
  });

  it("/coach/verification", async () => {
    const { text } = await renderRoute(CoachVerificationPage, {
      role: "coach",
    });
    expect(text).toContain("Coach Verification");
    expect(text).toContain("Step 1");
    expect(text).toContain("Step 3");
  });

  it("/venue-lister/inventory", async () => {
    const { text } = await renderRoute(InventoryPage, {
      role: "venue-lister",
    });
    expect(text).toContain("My Venues");
    expect(text).toContain("View Bookings");
  });

  it("/dashboard/my-bookings", async () => {
    const { text } = await renderRoute(MyBookingsPage, { role: "player" });
    expect(text).toContain("My Bookings");
    expect(text).toContain("Upcoming");
  });

  it("/checkout reaches its not-found state without a valid venue", async () => {
    // Guards against the checkout page throwing instead of degrading when the
    // venue lookup comes back empty.
    const { text } = await renderRoute(CheckoutPage, {
      role: "player",
      query: "type=venue&venueId=missing&sport=Cricket&date=2026-09-01",
      // The not-found screen is intentionally terse.
      minTextLength: 20,
    });
    expect(text.toLowerCase()).toContain("not found");
  });

  it("/guidance", async () => {
    const { text } = await renderRoute(GuidancePage, { role: "player" });
    expect(text).toContain("What do you need help with?");
    expect(text).toContain("Tournament prep");
  });

  it("/roadmap renders for an anonymous visitor", async () => {
    const { text } = await renderRoute(RoadmapPage, { role: null });
    expect(text).toContain("Know the Journey");
    expect(text).toContain("Select your state");
    expect(text).toContain("Cricket");
  });
});
