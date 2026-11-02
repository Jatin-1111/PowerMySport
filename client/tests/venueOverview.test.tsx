// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMyVenues = vi.fn();
const getEarnings = vi.fn();
const getAnalytics = vi.fn();
const getMyBookings = vi.fn();

vi.mock("../src/modules/venue/services/venue", () => ({
  venueApi: { getMyVenues: (...a: unknown[]) => getMyVenues(...a) },
}));
vi.mock("../src/modules/venue/services/venueConsole", () => ({
  venueConsoleApi: {
    getEarnings: (...a: unknown[]) => getEarnings(...a),
    getAnalytics: (...a: unknown[]) => getAnalytics(...a),
  },
}));
vi.mock("../src/modules/booking/services/booking", () => ({
  bookingApi: { getMyBookings: (...a: unknown[]) => getMyBookings(...a) },
}));
vi.mock("../src/modules/auth/store/authStore", () => ({
  useAuthStore: (
    select: (s: { hydrated: boolean; token: string; user: { name: string } }) => unknown
  ) => select({ hydrated: true, token: "t", user: { name: "Meera Iyer" } }),
}));

import { VenueOverview } from "../src/modules/venue/components/overview/VenueOverview";

const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00.000Z`;
};

const venue = (over: Record<string, unknown> = {}) => ({
  id: "v1",
  name: "Court One",
  sports: ["tennis"],
  pricePerHour: 800,
  amenities: [],
  lifecycle: "APPROVED",
  rating: 4.5,
  reviewCount: 8,
  ...over,
});

const earnings = () => ({
  allTime: { total: 50000, sessions: 40 },
  thisMonth: { total: 12000, sessions: 9 },
  lastMonth: { total: 9000, sessions: 7 },
  pending: { total: 3000, sessions: 3 },
  byMonth: [],
  bySport: [],
  recentBookings: [],
});

const analytics = () => ({
  overview: {
    totalSessions: 40,
    completedSessions: 36,
    completionRate: 90,
    totalCustomers: 21,
    returningCustomers: 9,
    retentionRate: 43,
    avgRating: 4.5,
    reviewCount: 8,
  },
  sessionsTrend: [],
  sportBreakdown: [],
  popularHours: [],
  customerRetention: { newCustomers: 12, returningCustomers: 9 },
});

const booking = (over: Record<string, unknown> = {}) => ({
  _id: Math.random().toString(36).slice(2),
  venueId: "v1",
  userId: "u1",
  sport: "tennis",
  date: daysFromNow(1),
  startTime: "07:00",
  endTime: "08:00",
  status: "CONFIRMED",
  totalAmount: 800,
  ...over,
});

const ok = (data: unknown) => Promise.resolve({ success: true, data });

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VenueOverview />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  for (const fn of [getMyVenues, getEarnings, getAnalytics, getMyBookings]) fn.mockReset();
  getMyVenues.mockReturnValue(ok([venue()]));
  getEarnings.mockReturnValue(ok(earnings()));
  getAnalytics.mockReturnValue(ok(analytics()));
  getMyBookings.mockReturnValue(ok([]));
});

afterEach(cleanup);

describe("VenueOverview", () => {
  it("shows the owner's name, how many venues are live, and the real figures", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Meera Iyer" })).toBeTruthy();
    expect(screen.getByText("1 venue, 1 live")).toBeTruthy();
    expect(await screen.findByText("₹12,000")).toBeTruthy();
    expect(screen.getByText("₹3,000")).toBeTruthy();
    expect(screen.getByText("21")).toBeTruthy();
    expect(screen.getByText("9 returning")).toBeTruthy();
    expect(screen.getByText("4.5")).toBeTruthy();
    expect(screen.getByText("8 reviews")).toBeTruthy();
  });

  it("shows no requests band and no status band when there is nothing to do", async () => {
    renderPage();
    await screen.findByText("₹12,000");
    expect(screen.queryByRole("region", { name: /need.* your reply/i })).toBeNull();
    expect(screen.queryByRole("link", { name: "Continue setup" })).toBeNull();
  });

  it("leads with requests, titled by venue and showing the venue's own amount", async () => {
    getMyBookings.mockReturnValue(
      ok([
        booking({
          status: "AWAITING_PROVIDER",
          totalAmount: 1000,
          payments: [{ userType: "VenueLister", amount: 900, status: "PENDING" }],
        }),
      ])
    );
    renderPage();
    const band = await screen.findByRole("region", { name: /1 booking request needs your reply/i });
    expect(within(band).getByText("Court One")).toBeTruthy();
    expect(within(band).getByText("₹900")).toBeTruthy();
    expect(
      within(band)
        .getByRole("link", { name: /review request/i })
        .getAttribute("href")
    ).toBe("/venue-lister/vendor-bookings");
  });

  it("tells a venue lister why a venue was not approved and how to fix it", async () => {
    getMyVenues.mockReturnValue(
      ok([venue({ lifecycle: "REJECTED", rejectionReason: "Photos are too dark." })])
    );
    renderPage();
    expect(await screen.findByText("Court One was not approved")).toBeTruthy();
    expect(screen.getByText("Photos are too dark.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /update your venue/i }).getAttribute("href")).toBe(
      "/venue-lister/inventory"
    );
  });

  it("says there are no reviews rather than showing a zero rating", async () => {
    getMyVenues.mockReturnValue(ok([venue({ rating: 0, reviewCount: 0 })]));
    renderPage();
    expect((await screen.findAllByText("No reviews yet")).length).toBeGreaterThan(0);
    expect(screen.queryByText("0.0")).toBeNull();
  });

  it("keeps the page up when only the customer count fails", async () => {
    getAnalytics.mockImplementation(() => Promise.reject(new Error("boom")));
    renderPage();
    expect(await screen.findByText("₹12,000")).toBeTruthy();
    expect(await screen.findByText(/we could not load this/i)).toBeTruthy();
  });

  it("offers a retry when the venues cannot be loaded", async () => {
    getMyVenues.mockImplementation(() => Promise.reject(new Error("boom")));
    renderPage();
    expect(await screen.findByText("We could not load your dashboard")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
