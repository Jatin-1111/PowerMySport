// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMyProfile = vi.fn();
const expertSessions = vi.fn();
const respondSession = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../src/modules/expert/services/expert", () => ({
  expertApi: {
    getMyProfile: (...a: unknown[]) => getMyProfile(...a),
    expertSessions: (...a: unknown[]) => expertSessions(...a),
    respondSession: (...a: unknown[]) => respondSession(...a),
    setMeetingLink: vi.fn(),
    completeSession: vi.fn(),
    updateSessionMom: vi.fn(),
    cancelSession: vi.fn(),
  },
}));
vi.mock("../src/modules/auth/store/authStore", () => ({
  useAuthStore: (
    select: (s: { hydrated: boolean; token: string; user: { name: string } }) => unknown
  ) => select({ hydrated: true, token: "t", user: { name: "Arjun Rao" } }),
}));
vi.mock("../src/lib/toast", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));
vi.mock("../src/modules/expert/components/SlotPicker", () => ({
  SlotPicker: () => <div data-testid="slot-picker" />,
}));

import { ExpertOverview } from "../src/modules/expert/components/overview/ExpertOverview";
import { ExpertSessions } from "../src/modules/expert/components/sessions/ExpertSessions";
import type { Expert, ExpertSession } from "../src/modules/expert/services/expert";
import {
  countByFilter,
  describeExpertStatus,
  filterSessions,
  needsResponse,
  selectRequests,
  selectUpcoming,
  sessionFigures,
  sessionStatusView,
  sessionTitle,
} from "../src/modules/expert/utils/sessions";

const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

let counter = 0;
const session = (over: Record<string, unknown> = {}): ExpertSession =>
  ({
    id: `s${++counter}`,
    expertId: "e1",
    userId: "u1",
    amount: 1500,
    status: "SCHEDULED",
    paymentStatus: "COMPLETED",
    scheduledAt: inHours(24),
    durationMinutes: 60,
    mode: "ONLINE",
    expertAcceptance: "ACCEPTED",
    expertTimezone: "Asia/Kolkata",
    reviewed: false,
    clientName: "Kavya Menon",
    createdAt: new Date().toISOString(),
    ...over,
  }) as unknown as ExpertSession;

const expert = (over: Record<string, unknown> = {}): Expert =>
  ({
    id: "e1",
    name: "Arjun Rao",
    bio: "Former national player.",
    sports: ["Tennis"],
    expertise: [],
    sessionFee: 1500,
    sessionMode: "ONLINE",
    sessionDurationMinutes: 60,
    isActive: true,
    verificationStatus: "APPROVED",
    rating: 4.6,
    reviewCount: 9,
    weeklyAvailability: [
      { dayOfWeek: 1, start: "17:00", end: "21:00" },
      { dayOfWeek: 3, start: "17:00", end: "21:00" },
    ],
    ...over,
  }) as unknown as Expert;

describe("expert session helpers", () => {
  it("treats a paid session the expert has not accepted as a request", () => {
    expect(needsResponse(session({ expertAcceptance: "PENDING" }))).toBe(true);
    expect(needsResponse(session())).toBe(false);
    expect(needsResponse(session({ status: "COMPLETED", expertAcceptance: "PENDING" }))).toBe(
      false
    );
  });

  it("lists requests soonest first and keeps them out of the filtered list", () => {
    const later = session({ expertAcceptance: "PENDING", scheduledAt: inHours(48) });
    const sooner = session({ expertAcceptance: "PENDING", scheduledAt: inHours(5) });
    const confirmed = session();
    const all = [later, confirmed, sooner];
    expect(selectRequests(all).map((s) => s.id)).toEqual([sooner.id, later.id]);
    expect(filterSessions(all, "all").map((s) => s.id)).toEqual([confirmed.id]);
  });

  it("shows only confirmed sessions that have not ended as upcoming", () => {
    const next = session({ scheduledAt: inHours(3) });
    const ended = session({ scheduledAt: inHours(-5) });
    const unconfirmed = session({ expertAcceptance: "PENDING" });
    expect(selectUpcoming([ended, unconfirmed, next], new Date()).map((s) => s.id)).toEqual([
      next.id,
    ]);
  });

  it("counts each filter without double counting requests", () => {
    const counts = countByFilter([
      session(),
      session({ status: "COMPLETED" }),
      session({ status: "CANCELLED" }),
      session({ expertAcceptance: "PENDING" }),
    ]);
    expect(counts).toEqual({ upcoming: 1, completed: 1, cancelled: 1, all: 3 });
  });

  it("totals fees from completed sessions apart from confirmed ones", () => {
    const figures = sessionFigures([
      session({ status: "COMPLETED", amount: 1000 }),
      session({ status: "COMPLETED", amount: 500 }),
      session({ status: "CANCELLED", amount: 9999 }),
      session({ amount: 700 }),
    ]);
    expect(figures).toEqual({
      collected: 1500,
      completedCount: 2,
      stillToCome: 700,
      comingCount: 1,
    });
  });

  it("names the session after the child when there is one", () => {
    expect(sessionTitle(session({ player: { name: "Riya" } }))).toBe("Riya");
    expect(sessionTitle(session())).toBe("Kavya Menon");
  });

  it("words the status of a session in the expert's terms", () => {
    expect(sessionStatusView(session({ expertAcceptance: "PENDING" })).tag).toBe(
      "Needs your reply"
    );
    expect(sessionStatusView(session()).tag).toBe("Confirmed");
    expect(sessionStatusView(session({ status: "CANCELLED" })).tone).toBe("alert");
  });

  it("explains a profile that is not live", () => {
    expect(describeExpertStatus(expert()).headline).toBeNull();
    expect(describeExpertStatus(expert({ verificationStatus: "PENDING" })).tag).toBe("In review");
    expect(
      describeExpertStatus(
        expert({ verificationStatus: "REJECTED", rejectionReason: "Add proof." })
      ).body
    ).toBe("Add proof.");
  });
});

const ok = (data: unknown) => Promise.resolve({ success: true, data });

const renderWith = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  counter = 0;
  for (const fn of [getMyProfile, expertSessions, respondSession, toastSuccess, toastError]) {
    fn.mockReset();
  }
  getMyProfile.mockReturnValue(ok(expert()));
  expertSessions.mockReturnValue(ok([]));
});
afterEach(cleanup);

describe("ExpertOverview", () => {
  it("shows the name, the listing and real figures", async () => {
    expertSessions.mockReturnValue(
      ok([session({ status: "COMPLETED", amount: 2000 }), session({ amount: 1500 })])
    );
    renderWith(<ExpertOverview />);
    expect(await screen.findByRole("heading", { level: 1, name: "Arjun Rao" })).toBeTruthy();
    expect(await screen.findByText("₹2,000")).toBeTruthy();
    expect(screen.getByText("4.6")).toBeTruthy();
    expect(screen.getByText("2 a week")).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
  });

  it("leads with sessions waiting for a reply and links to answer them", async () => {
    expertSessions.mockReturnValue(ok([session({ expertAcceptance: "PENDING" })]));
    renderWith(<ExpertOverview />);
    const band = await screen.findByRole("region", { name: /1 session needs your reply/i });
    expect(
      within(band)
        .getByRole("link", { name: /review request/i })
        .getAttribute("href")
    ).toBe("/expert/sessions");
  });

  it("tells a rejected expert why and how to fix it", async () => {
    getMyProfile.mockReturnValue(
      ok(expert({ verificationStatus: "REJECTED", rejectionReason: "Add proof of achievements." }))
    );
    renderWith(<ExpertOverview />);
    expect(await screen.findByText("Your profile needs changes")).toBeTruthy();
    expect(screen.getByText("Add proof of achievements.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /update and resubmit/i }).getAttribute("href")).toBe(
      "/expert/onboarding"
    );
  });

  it("keeps the page up when only the sessions fail", async () => {
    expertSessions.mockImplementation(() => Promise.reject(new Error("boom")));
    renderWith(<ExpertOverview />);
    expect(await screen.findByRole("heading", { level: 1, name: "Arjun Rao" })).toBeTruthy();
    expect(await screen.findByText("We could not load your sessions")).toBeTruthy();
  });

  it("offers a retry when the profile cannot be loaded", async () => {
    getMyProfile.mockImplementation(() => Promise.reject(new Error("boom")));
    renderWith(<ExpertOverview />);
    expect(await screen.findByText("We could not load your dashboard")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("ExpertSessions", () => {
  it("accepts a requested time in place and moves it out of the requests section", async () => {
    expertSessions.mockReturnValue(ok([session({ expertAcceptance: "PENDING" })]));
    respondSession.mockReturnValue(ok(session({ id: "s1", expertAcceptance: "ACCEPTED" })));
    renderWith(<ExpertSessions />);

    fireEvent.click(await screen.findByRole("button", { name: "Accept time" }));

    await waitFor(() => expect(respondSession).toHaveBeenCalledWith("s1", { action: "ACCEPT" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Time accepted."));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Accept time" })).toBeNull());
    expect(screen.getByText("Confirmed")).toBeTruthy();
  });

  it("tells the expert when an answer fails", async () => {
    expertSessions.mockReturnValue(ok([session({ expertAcceptance: "PENDING" })]));
    respondSession.mockImplementation(() =>
      Promise.reject({ response: { data: { message: "Already cancelled." } } })
    );
    renderWith(<ExpertSessions />);
    fireEvent.click(await screen.findByRole("button", { name: "Accept time" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Already cancelled."));
  });

  it("filters the rest by where they stand", async () => {
    expertSessions.mockReturnValue(
      ok([
        session({ clientName: "Upcoming Parent" }),
        session({ status: "COMPLETED", clientName: "Done Parent" }),
      ])
    );
    renderWith(<ExpertSessions />);
    expect(await screen.findByText("Upcoming Parent")).toBeTruthy();
    expect(screen.queryByText("Done Parent")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Completed/ }));
    expect(await screen.findByText("Done Parent")).toBeTruthy();
    expect(screen.queryByText("Upcoming Parent")).toBeNull();
  });

  it("explains an empty list", async () => {
    renderWith(<ExpertSessions />);
    expect(await screen.findByText(/No sessions yet/)).toBeTruthy();
  });

  it("offers a retry when sessions cannot be loaded", async () => {
    expertSessions.mockImplementation(() => Promise.reject(new Error("boom")));
    renderWith(<ExpertSessions />);
    expect(await screen.findByText("We could not load your sessions")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
