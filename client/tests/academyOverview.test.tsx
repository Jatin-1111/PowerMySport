// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMine = vi.fn();
const getEarnings = vi.fn();
const getAnalytics = vi.fn();

vi.mock("../src/modules/academy/services/academyConsole", () => ({
  academyConsoleApi: {
    getMine: (...a: unknown[]) => getMine(...a),
    getEarnings: (...a: unknown[]) => getEarnings(...a),
    getAnalytics: (...a: unknown[]) => getAnalytics(...a),
  },
}));

vi.mock("../src/modules/auth/store/authStore", () => ({
  useAuthStore: (select: (s: { hydrated: boolean; token: string }) => unknown) =>
    select({ hydrated: true, token: "t" }),
}));

let unread = 0;
vi.mock("../src/hooks/useNotifications", () => ({
  useUnreadNotificationCount: () => unread,
}));

import { AcademyOverview } from "../src/modules/academy/components/AcademyOverview";
import type { OwnAcademy } from "../src/modules/academy/types";

const academy = (over: Partial<OwnAcademy> = {}): OwnAcademy => ({
  id: "a1",
  name: "Baseline Tennis Academy",
  slug: "baseline-tennis",
  city: "Pune",
  sports: ["Tennis", "Badminton"],
  lifecycle: "DRAFT",
  onboardingStep: 0,
  onboardingCompleted: false,
  emailVerified: true,
  kycVerified: false,
  isApproved: false,
  isActive: false,
  venueCount: 2,
  coachCount: 3,
  ...over,
});

const earnings = (over: Record<string, unknown> = {}) => ({
  allTime: { total: 184250, sessions: 61 },
  thisMonth: { total: 42500, sessions: 14 },
  lastMonth: { total: 34000, sessions: 11 },
  pending: { total: 9600, sessions: 4 },
  byMonth: [],
  bySport: [],
  recentBookings: [
    {
      id: "b1",
      userId: { name: "Kavya Menon" },
      sport: "tennis",
      date: "2026-10-28T09:00:00.000Z",
      totalAmount: 1200,
    },
    {
      id: "b2",
      userId: "u2",
      participantName: "Arjun Rao",
      sport: "badminton",
      date: "2026-10-27T09:00:00.000Z",
      totalAmount: 800,
    },
  ],
  ...over,
});

const analytics = () => ({
  overview: {
    totalSessions: 70,
    completedSessions: 61,
    completionRate: 87.1,
    totalStudents: 38,
    returningStudents: 22,
    retentionRate: 57.9,
    totalVenues: 2,
    totalCoaches: 3,
  },
});

const renderPage = (ui: ReactNode = <AcademyOverview />) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  unread = 0;
  getMine.mockReset();
  getEarnings.mockReset();
  getAnalytics.mockReset();
});
afterEach(cleanup);

describe("AcademyOverview", () => {
  it("shows a loading state first", () => {
    getMine.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("status")).toHaveProperty("textContent");
    expect(screen.getByText("Loading your dashboard")).toBeTruthy();
  });

  it("invites an owner with no academy to start, and asks for no figures", async () => {
    getMine.mockResolvedValue(null);
    renderPage();

    expect(await screen.findByRole("heading", { name: "Set up your academy" })).toBeTruthy();
    const start = screen.getByRole("link", { name: /Start setup/ });
    expect(start.getAttribute("href")).toBe("/academy/onboarding");
    expect(getEarnings).not.toHaveBeenCalled();
    expect(getAnalytics).not.toHaveBeenCalled();
  });

  it("marks the saved steps done and the next one as next for a draft", async () => {
    getMine.mockResolvedValue(academy({ onboardingStep: 3 }));
    renderPage();

    expect(await screen.findByText("3 of 7 steps saved")).toBeTruthy();
    const list = screen.getByRole("list", { name: "Setup steps" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(7);
    expect(items[0]!.textContent).toContain("Done");
    expect(items[2]!.textContent).toContain("Done");
    expect(items[3]!.getAttribute("aria-current")).toBe("step");
    expect(items[3]!.textContent).toContain("Venues");
    expect(screen.getByRole("link", { name: /Continue with venues/ })).toBeTruthy();
  });

  it("shows the review stages and no action while the academy is in review", async () => {
    getMine.mockResolvedValue(
      academy({ lifecycle: "SUBMITTED", onboardingStep: 7, onboardingCompleted: true })
    );
    renderPage();

    expect(await screen.findByRole("heading", { name: "Your academy is in review" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Review stages" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Start setup|Continue with/ })).toBeNull();
    expect(getEarnings).not.toHaveBeenCalled();
  });

  it("shows the reason a rejected academy was sent back", async () => {
    getMine.mockResolvedValue(
      academy({
        lifecycle: "REJECTED",
        onboardingStep: 7,
        onboardingCompleted: true,
        rejectionReason: "The PAN document is unreadable.",
      })
    );
    renderPage();

    expect(await screen.findByText("The PAN document is unreadable.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Update your details/ })).toBeTruthy();
  });

  it("shows figures, recent sessions and facts once the academy is live", async () => {
    unread = 3;
    getMine.mockResolvedValue(academy({ lifecycle: "APPROVED", onboardingStep: 7 }));
    getEarnings.mockResolvedValue(earnings());
    getAnalytics.mockResolvedValue(analytics());
    renderPage();

    expect(await screen.findByText("₹42,500")).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("₹9,600")).toBeTruthy();
    expect(screen.getByText("₹1,84,250")).toBeTruthy();
    expect(screen.getByText("+25.0%")).toBeTruthy();
    expect(screen.getByText("38")).toBeTruthy();

    // Live academies get no status band: the page is about the figures.
    expect(screen.queryByRole("heading", { name: "Your academy is live" })).toBeNull();
    expect(screen.getByRole("link", { name: /View public profile/ }).getAttribute("href")).toBe(
      "/academies/baseline-tennis"
    );

    expect(screen.getByText("Kavya Menon")).toBeTruthy();
    expect(screen.getByText("Arjun Rao")).toBeTruthy();
    expect(screen.getByText("Tennis, Badminton")).toBeTruthy();
    expect(screen.getByRole("link", { name: /3 unread notifications/ })).toBeTruthy();
  });

  it("explains an empty session list instead of leaving a blank panel", async () => {
    getMine.mockResolvedValue(academy({ lifecycle: "APPROVED", onboardingStep: 7 }));
    getEarnings.mockResolvedValue(
      earnings({
        recentBookings: [],
        thisMonth: { total: 0, sessions: 0 },
        lastMonth: { total: 0, sessions: 0 },
      })
    );
    getAnalytics.mockResolvedValue(analytics());
    renderPage();

    expect(await screen.findByText(/No completed sessions yet/)).toBeTruthy();
    // With nothing last month there is nothing to compare, so no percentage is shown.
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it("keeps the status on screen when the earnings request fails", async () => {
    getMine.mockResolvedValue(academy({ lifecycle: "SUSPENDED", onboardingStep: 7 }));
    getEarnings.mockRejectedValue(new Error("boom"));
    getAnalytics.mockResolvedValue(analytics());
    renderPage();

    expect(await screen.findByRole("heading", { name: "Your academy is paused" })).toBeTruthy();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("We could not load your earnings");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("says when only the student figure is missing", async () => {
    getMine.mockResolvedValue(academy({ lifecycle: "APPROVED", onboardingStep: 7 }));
    getEarnings.mockResolvedValue(earnings());
    getAnalytics.mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByText("₹42,500")).toBeTruthy();
    expect(await screen.findByText("Unavailable")).toBeTruthy();
  });

  it("offers a retry when the academy itself cannot be loaded", async () => {
    getMine.mockRejectedValue(new Error("offline"));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("We could not load your dashboard");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
