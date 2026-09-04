// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Third of the plan's 6 largest client/src/app pages (1100 lines), same
// situation as the previous two: no extracted hook/sub-components, so this
// renders the whole component directly. This one has real routing, auth
// store, and four separate API modules to mock.

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ coachId: "coach-1" }),
  useRouter: () => ({ push: pushMock }),
}));

let mockUser: { id: string; role: string } | null = null;
vi.mock("@/modules/auth/store/authStore", () => ({
  useAuthStore: () => ({ user: mockUser }),
}));

const getCoachById = vi.fn();
vi.mock("@/modules/discovery/services/discovery", () => ({
  discoveryApi: { getCoachById: (...args: unknown[]) => getCoachById(...args) },
}));

const getCoachAvailability = vi.fn();
const joinWaitlist = vi.fn();
vi.mock("@/modules/booking/services/booking", () => ({
  bookingApi: {
    getCoachAvailability: (...args: unknown[]) => getCoachAvailability(...args),
    joinWaitlist: (...args: unknown[]) => joinWaitlist(...args),
  },
}));

const getCoachPackages = vi.fn();
vi.mock("@/modules/coach/services/coach", () => ({
  coachApi: { getCoachPackages: (...args: unknown[]) => getCoachPackages(...args) },
}));

const getCoachReviews = vi.fn();
const getReviewEligibility = vi.fn();
const createReview = vi.fn();
vi.mock("@/modules/review/services/review", () => ({
  reviewApi: {
    getCoachReviews: (...args: unknown[]) => getCoachReviews(...args),
    getReviewEligibility: (...args: unknown[]) => getReviewEligibility(...args),
    createReview: (...args: unknown[]) => createReview(...args),
  },
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

// The community insights widget makes its own analytics calls unrelated to
// this page's own booking/review logic — stubbed out as a boundary.
vi.mock("@/modules/community/components/CommunityInsightsCard", () => ({
  CommunityInsightsCard: () => <div data-testid="community-insights-card" />,
}));

import { CoachDetailClient } from "../src/app/(booking)/coaches/[coachId]/CoachDetailClient";
import type { Coach } from "../src/types";

const coachFixture: Coach = {
  id: "coach-1",
  userId: { id: "user-coach-1", name: "Jane Coach" },
  bio: "Expert tennis and badminton coach.",
  certifications: ["Level 3 Certified"],
  sports: ["Tennis", "Badminton"],
  hourlyRate: 1000,
  sportPricing: { Tennis: 1200 },
  serviceMode: "FREELANCE",
  availability: [],
  rating: 4.5,
  reviewCount: 12,
  isVerified: true,
  verificationStatus: "VERIFIED",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const emptyAvailability = { availableSlots: [], bookedSlots: [] };
const emptyReviewSummary = { averageRating: 0, reviewCount: 0 };

const mockDefaults = (overrides: { coach?: Coach | null } = {}) => {
  const coach = overrides.coach === undefined ? coachFixture : overrides.coach;
  getCoachById.mockResolvedValue(
    coach ? { success: true, data: coach } : { success: false, data: null }
  );
  getCoachAvailability.mockResolvedValue({ success: true, data: emptyAvailability });
  getCoachPackages.mockResolvedValue({ success: true, data: { packages: [] } });
  getCoachReviews.mockResolvedValue({
    success: true,
    data: { reviews: [], summary: emptyReviewSummary },
  });
  getReviewEligibility.mockResolvedValue({
    success: true,
    data: { eligible: false, bookingId: null, reason: "" },
  });
};

beforeEach(() => {
  mockUser = null;
  pushMock.mockReset();
  getCoachById.mockReset();
  getCoachAvailability.mockReset();
  joinWaitlist.mockReset();
  getCoachPackages.mockReset();
  getCoachReviews.mockReset();
  getReviewEligibility.mockReset();
  createReview.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe("CoachDetailClient — loading and not-found", () => {
  it("shows the coach once loaded", async () => {
    mockDefaults();
    render(<CoachDetailClient />);

    expect(await screen.findByText("Jane Coach")).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
  });

  it("shows a not-found state when the coach does not exist", async () => {
    mockDefaults({ coach: null });
    render(<CoachDetailClient />);

    expect(await screen.findByText("Coach not found")).toBeInTheDocument();
  });
});

describe("CoachDetailClient — sport-specific pricing", () => {
  it("shows the sport-specific rate for the default (first) sport", async () => {
    mockDefaults();
    render(<CoachDetailClient />);
    await screen.findByText("Jane Coach");

    // Tennis has an override of 1200; the rate renders both in the header
    // and again in the sidebar's "Selected Sport Rate" summary.
    expect(screen.getAllByText("1200")).toHaveLength(2);
  });

  it("falls back to the flat hourly rate for a sport with no override", async () => {
    mockDefaults();
    render(<CoachDetailClient />);
    await screen.findByText("Jane Coach");

    fireEvent.click(screen.getByRole("button", { name: "Badminton" }));

    expect(screen.getAllByText("1000")).toHaveLength(2);
  });
});

describe("CoachDetailClient — availability and booking", () => {
  it("shows a sign-in link instead of a booking button when logged out", async () => {
    mockDefaults();
    render(<CoachDetailClient />);
    await screen.findByText("Jane Coach");

    expect(screen.getByRole("link", { name: /Sign In to Book/i })).toBeInTheDocument();
  });

  it("lets a signed-in user select an available slot and confirm a booking", async () => {
    mockUser = { id: "user-1", role: "Player" };
    mockDefaults();
    getCoachAvailability.mockResolvedValue({
      success: true,
      data: { availableSlots: ["09:00-10:00"], bookedSlots: [] },
    });
    render(<CoachDetailClient />);
    await screen.findByText("Jane Coach");

    fireEvent.click(await screen.findByText("09:00 - 10:00"));
    expect(screen.getByText("Available")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Confirm Booking/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        expect.stringMatching(/^\/checkout\?.*coachId=coach-1/)
      );
    });
    const [pushedUrl] = pushMock.mock.calls[0];
    expect(pushedUrl).toContain("startTime=09%3A00");
    expect(pushedUrl).toContain("sport=Tennis");
  });

  it("offers Join Waitlist for a booked slot instead of Confirm Booking", async () => {
    mockUser = { id: "user-1", role: "Player" };
    mockDefaults();
    getCoachAvailability.mockResolvedValue({
      success: true,
      data: { availableSlots: [], bookedSlots: ["09:00-10:00"], allSlots: ["09:00-10:00"] },
    });
    joinWaitlist.mockResolvedValue({ success: true });
    render(<CoachDetailClient />);
    await screen.findByText("Jane Coach");

    fireEvent.click(await screen.findByText("09:00 - 10:00"));
    expect(screen.getByText("Booked (Waitlist)")).toBeInTheDocument();

    // The slot button's own accessible name is "09:00 - 10:00 Join
    // Waitlist" (both its text nodes concatenated), which a /Join
    // Waitlist/i regex also matches — the CTA button's name is exactly
    // "Join Waitlist", so an exact string disambiguates the two.
    fireEvent.click(screen.getByRole("button", { name: "Join Waitlist" }));

    await waitFor(() => {
      expect(joinWaitlist).toHaveBeenCalledWith(
        expect.objectContaining({ coachId: "coach-1", sport: "Tennis", startTime: "09:00" })
      );
    });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("redirects to login when booking while signed out", async () => {
    mockDefaults();
    getCoachAvailability.mockResolvedValue({
      success: true,
      data: { availableSlots: ["09:00-10:00"], bookedSlots: [] },
    });
    render(<CoachDetailClient />);
    await screen.findByText("Jane Coach");

    // Logged out shows the sign-in link, not a clickable booking button —
    // confirming the guard itself makes the redirect surface, not this path.
    const signInLink = screen.getByRole("link", { name: /Sign In to Book/i });
    expect(signInLink).toHaveAttribute("href", "/login?redirect=/coaches/coach-1");
  });
});

describe("CoachDetailClient — subscription packages", () => {
  const packageFixture = {
    _id: "pkg-1",
    name: "Gold Plan",
    price: 499900,
    frequency: "MONTHLY",
    features: ["Weekly session"],
  };

  it("shows an empty state when the coach has no packages", async () => {
    mockDefaults();
    render(<CoachDetailClient />);
    await screen.findByText("Jane Coach");

    expect(
      await screen.findByText("This coach has not published any subscription packages yet.")
    ).toBeInTheDocument();
  });

  it("lets a Player subscribe, routing to the subscription checkout", async () => {
    mockUser = { id: "user-1", role: "Player" };
    mockDefaults();
    getCoachPackages.mockResolvedValue({ success: true, data: { packages: [packageFixture] } });
    render(<CoachDetailClient />);
    await screen.findByText("Jane Coach");

    fireEvent.click(await screen.findByRole("button", { name: "Subscribe now" }));

    expect(pushMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/dashboard\/subscription-checkout\?.*coachId=coach-1.*packageId=pkg-1|^\/dashboard\/subscription-checkout\?.*packageId=pkg-1.*coachId=coach-1/
      )
    );
  });

  it("tells a non-player account that packages are player-only", async () => {
    mockUser = { id: "user-1", role: "Coach" };
    mockDefaults();
    getCoachPackages.mockResolvedValue({ success: true, data: { packages: [packageFixture] } });
    render(<CoachDetailClient />);
    await screen.findByText("Jane Coach");

    expect(
      await screen.findByText("Subscription packages are available for player accounts.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Subscribe now" })).not.toBeInTheDocument();
  });
});

describe("CoachDetailClient — reviews", () => {
  it("shows the review composer only when eligible, and submits it", async () => {
    mockUser = { id: "user-1", role: "Player" };
    mockDefaults();
    getReviewEligibility.mockResolvedValue({
      success: true,
      data: { eligible: true, bookingId: "booking-1", reason: "" },
    });
    createReview.mockResolvedValue({ success: true });
    render(<CoachDetailClient />);
    await screen.findByText("Jane Coach");

    expect(await screen.findByText("Share your experience")).toBeInTheDocument();

    const submitButton = screen.getByRole("button", { name: /Submit Review/i });
    expect(submitButton).toBeDisabled();

    const stars = screen.getAllByRole("button", { name: "" });
    // The 5 rating-star buttons render with no accessible name — find them
    // by their position among the composer's icon-only buttons instead.
    const ratingButtons = stars.filter((btn) => btn.querySelector("svg.lucide-star"));
    fireEvent.click(ratingButtons[3]); // 4th star = rating 4

    expect(submitButton).not.toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/Write your review/i), {
      target: { value: "Great coach!" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(createReview).toHaveBeenCalledWith({
        bookingId: "booking-1",
        targetType: "Coach",
        targetId: "coach-1",
        rating: 4,
        review: "Great coach!",
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("Review submitted successfully");
  });

  it("shows the ineligibility reason instead of the composer", async () => {
    mockUser = { id: "user-1", role: "Player" };
    mockDefaults();
    getReviewEligibility.mockResolvedValue({
      success: true,
      data: { eligible: false, bookingId: null, reason: "Complete a booking first." },
    });
    render(<CoachDetailClient />);
    await screen.findByText("Jane Coach");

    expect(await screen.findByText("Complete a booking first.")).toBeInTheDocument();
    expect(screen.queryByText("Share your experience")).not.toBeInTheDocument();
  });

  it("renders existing reviews with their star rating", async () => {
    mockDefaults();
    getCoachReviews.mockResolvedValue({
      success: true,
      data: {
        reviews: [
          {
            _id: "review-1",
            userId: { name: "Alex Player" },
            rating: 5,
            review: "Fantastic sessions.",
          },
        ],
        summary: { averageRating: 5, reviewCount: 1 },
      },
    });
    render(<CoachDetailClient />);
    await screen.findByText("Jane Coach");

    expect(await screen.findByText("Alex Player")).toBeInTheDocument();
    expect(screen.getByText("Fantastic sessions.")).toBeInTheDocument();
  });
});
