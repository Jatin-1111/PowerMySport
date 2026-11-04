// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMyProfile = vi.fn();
const getEarnings = vi.fn();
const getAnalytics = vi.fn();
const getMyBookings = vi.fn();

vi.mock("../src/modules/coach/services/coach", () => ({
  coachApi: {
    getMyProfile: (...a: unknown[]) => getMyProfile(...a),
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
  ) => select({ hydrated: true, token: "t", user: { name: "Rohan Deshmukh" } }),
}));

let unread = 0;
vi.mock("../src/hooks/useNotifications", () => ({
  useUnreadNotificationCount: () => unread,
}));

import { CoachOverview } from "../src/modules/coach/components/overview/CoachOverview";

const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00.000Z`;
};

const coach = (over: Record<string, unknown> = {}) => ({
  id: "coach-1",
  userId: "u1",
  bio: "Tennis coach",
  certifications: [],
  sports: ["Tennis", "Badminton"],
  hourlyRate: 1000,
  serviceMode: "FREELANCE",
  availability: [
    { dayOfWeek: 1, startTime: "06:00", endTime: "20:00" },
    { dayOfWeek: 3, startTime: "06:00", endTime: "20:00" },
  ],
  verificationStatus: "VERIFIED",
  subscriptionStatus: "NONE",
  rating: 4.6,
  reviewCount: 12,
  ...over,
});

const earnings = (over: Record<string, unknown> = {}) => ({
  allTime: { total: 64800, sessions: 51 },
  thisMonth: { total: 12400, sessions: 9 },
  lastMonth: { total: 9920, sessions: 8 },
  pending: { total: 4200, sessions: 4 },
  byMonth: [],
  bySport: [],
  recentBookings: [],
  ...over,
});

const analytics = () => ({
  overview: {
    totalSessions: 60,
    completedSessions: 51,
    completionRate: 85,
    totalClients: 17,
    returningClients: 11,
    retentionRate: 64.7,
    avgRating: 4.6,
    reviewCount: 12,
  },
  sessionsTrend: [],
  sportBreakdown: [],
  popularHours: [],
  clientRetention: { newClients: 6, returningClients: 11 },
});

const booking = (over: Record<string, unknown> = {}) => ({
  _id: Math.random().toString(36).slice(2),
  coachId: "coach-1",
  userId: { name: "Kavya Menon" },
  sport: "tennis",
  date: daysFromNow(1),
  startTime: "07:00",
  endTime: "08:00",
  status: "CONFIRMED",
  totalAmount: 1000,
  ...over,
});

const ok = (data: unknown) => Promise.resolve({ success: true, data });

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CoachOverview />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  unread = 0;
  for (const fn of [getMyProfile, getEarnings, getAnalytics, getMyBookings]) fn.mockReset();
  getMyProfile.mockReturnValue(ok(coach()));
  getEarnings.mockReturnValue(ok(earnings()));
  getAnalytics.mockReturnValue(ok(analytics()));
  getMyBookings.mockReturnValue(ok([]));
});
afterEach(cleanup);

describe("CoachOverview", () => {
  it("shows a loading state first", () => {
    getMyProfile.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading your dashboard")).toBeTruthy();
  });

  it("leads with the coach, their sports and rate, and a verified tag", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Rohan Deshmukh" })).toBeTruthy();
    expect(screen.getByText("Tennis, Badminton, ₹1,000 an hour")).toBeTruthy();
    expect(screen.getByText("Verified")).toBeTruthy();
    expect(screen.getByRole("link", { name: /View public profile/ }).getAttribute("href")).toBe(
      "/coaches/coach-1"
    );
  });

  it("shows real figures with the change against last month", async () => {
    renderPage();
    expect(await screen.findByText("₹12,400")).toBeTruthy();
    expect(screen.getByText("+25.0%")).toBeTruthy();
    expect(screen.getByText("₹4,200")).toBeTruthy();
    expect(screen.getByText("17")).toBeTruthy();
    expect(screen.getByText("11 returning")).toBeTruthy();
    expect(screen.getByText("4.6")).toBeTruthy();
    expect(screen.getByText("12 reviews")).toBeTruthy();
  });

  it("puts requests that need a reply first, with the one primary action", async () => {
    getMyBookings.mockReturnValue(
      ok([
        booking({ status: "AWAITING_PROVIDER", userId: { name: "Arjun Rao" }, totalAmount: 1200 }),
        booking({ status: "AWAITING_PROVIDER", userId: { name: "Ishaan Verma" } }),
        booking({ status: "CONFIRMED" }),
      ])
    );
    renderPage();

    const heading = await screen.findByRole("heading", {
      name: /2 booking requests need your reply/,
    });
    expect(heading).toBeTruthy();
    const list = screen.getByRole("list", { name: "Pending requests" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("Arjun Rao")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Review requests/ }).getAttribute("href")).toBe(
      "/coach/my-bookings"
    );
  });

  it("uses the singular for one request and says how many are not shown", async () => {
    getMyBookings.mockReturnValue(ok([booking({ status: "AWAITING_PROVIDER" })]));
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /1 booking request needs your reply/ })
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /Review request$/ })).toBeTruthy();

    cleanup();
    getMyBookings.mockReturnValue(
      ok(Array.from({ length: 5 }, () => booking({ status: "AWAITING_PROVIDER" })))
    );
    renderPage();
    expect(await screen.findByText("and 2 more requests")).toBeTruthy();
  });

  it("shows no requests band when nothing is waiting", async () => {
    getMyBookings.mockReturnValue(ok([booking({ status: "CONFIRMED" })]));
    renderPage();
    await screen.findByRole("heading", { name: "Next sessions" });
    expect(screen.queryByRole("heading", { name: /need your reply|needs your reply/ })).toBeNull();
  });

  it("lists the next confirmed sessions with the day in words", async () => {
    getMyBookings.mockReturnValue(
      ok([
        booking({
          userId: { name: "Kavya Menon" },
          date: daysFromNow(1),
          startTime: "07:00",
          endTime: "08:00",
        }),
        booking({ status: "COMPLETED", userId: { name: "Someone Past" } }),
      ])
    );
    renderPage();
    expect(await screen.findByText("Tomorrow, 7:00 am to 8:00 am")).toBeTruthy();
    expect(screen.getByText(/Kavya Menon,/)).toBeTruthy();
    expect(screen.queryByText(/Someone Past/)).toBeNull();
  });

  it("explains an empty week instead of leaving a blank panel", async () => {
    renderPage();
    expect(await screen.findByText(/Nothing is booked yet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open schedule/ }).getAttribute("href")).toBe(
      "/coach/schedule"
    );
  });

  it("says so when a coach has no reviews yet", async () => {
    getMyProfile.mockReturnValue(ok(coach({ reviewCount: 0, rating: 0 })));
    renderPage();
    expect(await screen.findByText("No reviews yet")).toBeTruthy();
  });

  it("tells a coach in review, and does not offer a public profile yet", async () => {
    getMyProfile.mockReturnValue(ok(coach({ verificationStatus: "PENDING" })));
    renderPage();
    expect(await screen.findByRole("heading", { name: "Your profile is in review" })).toBeTruthy();
    expect(screen.getByText("In review")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /View public profile/ })).toBeNull();
  });

  it("lists the facts and surfaces unread notifications", async () => {
    unread = 4;
    renderPage();
    expect(await screen.findByText("Travelling to clients")).toBeTruthy();
    expect(screen.getByText("2 a week")).toBeTruthy();
    // `subscriptionStatus` tracks a client's subscription to the coach, so it is not shown.
    expect(screen.queryByText("Plan")).toBeNull();
    expect(screen.getByRole("link", { name: /4 unread notifications/ })).toBeTruthy();
  });

  it("keeps requests and status on screen when earnings fail", async () => {
    getEarnings.mockRejectedValue(new Error("boom"));
    getMyBookings.mockReturnValue(ok([booking({ status: "AWAITING_PROVIDER" })]));
    renderPage();

    expect(await screen.findByRole("heading", { name: /1 booking request needs/ })).toBeTruthy();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("We could not load your earnings");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("says when only the client figure is missing", async () => {
    getAnalytics.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByText("₹12,400")).toBeTruthy();
    expect(await screen.findByText("Unavailable")).toBeTruthy();
    // The rating does not depend on analytics, so it is still there.
    expect(screen.getByText("4.6")).toBeTruthy();
  });

  it("says when the sessions list could not load", async () => {
    getMyBookings.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByText(/We could not load your sessions/)).toBeTruthy();
  });

  it("offers a retry when the profile cannot be loaded", async () => {
    getMyProfile.mockRejectedValue(new Error("offline"));
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("We could not load your dashboard");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
