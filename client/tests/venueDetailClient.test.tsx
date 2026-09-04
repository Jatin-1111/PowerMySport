// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Fourth of the plan's 6 largest client/src/app pages (1021 lines), same
// situation as the previous three: no extracted hook/sub-components. This
// one is the first in the track that fetches its primary data via React
// Query rather than a bespoke useEffect+useState pair, so every render needs
// a QueryClientProvider.

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ venueId: "venue-1" }),
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
}));

let mockUser: { id: string; role: string } | null = null;
vi.mock("@/modules/auth/store/authStore", () => ({
  useAuthStore: () => ({ user: mockUser }),
}));

const getVenueById = vi.fn();
vi.mock("@/modules/discovery/services/discovery", () => ({
  discoveryApi: { getVenueById: (...args: unknown[]) => getVenueById(...args) },
}));

const getVenueAvailability = vi.fn();
const joinWaitlist = vi.fn();
vi.mock("@/modules/booking/services/booking", () => ({
  bookingApi: {
    getVenueAvailability: (...args: unknown[]) => getVenueAvailability(...args),
    joinWaitlist: (...args: unknown[]) => joinWaitlist(...args),
  },
}));

const getVenueReviews = vi.fn();
const getReviewEligibility = vi.fn();
const createReview = vi.fn();
vi.mock("@/modules/review/services/review", () => ({
  reviewApi: {
    getVenueReviews: (...args: unknown[]) => getVenueReviews(...args),
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

vi.mock("@/modules/community/components/CommunityInsightsCard", () => ({
  CommunityInsightsCard: () => <div data-testid="community-insights-card" />,
}));

import { VenueDetailClient } from "../src/app/(booking)/venues/[venueId]/VenueDetailClient";
import type { Venue } from "../src/types";

const venueFixture: Venue = {
  id: "venue-1",
  name: "Downtown Sports Complex",
  ownerId: "owner-1",
  location: { type: "Point", coordinates: [77.5946, 12.9716] },
  sports: ["Tennis", "Badminton"],
  pricePerHour: 800,
  sportPricing: { Tennis: 1000 },
  address: "123 Main St",
  amenities: ["Parking", "Locker rooms"],
  description: "A premium multi-sport venue.",
  images: ["https://cdn.example.com/venue1.jpg", "https://cdn.example.com/venue2.jpg"],
  allowExternalCoaches: true,
  rating: 4.7,
  reviewCount: 20,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const emptyReviewSummary = { averageRating: 0, reviewCount: 0 };

// The default selectedDate is today, and slotsToDisplay filters out any
// slot whose start time has already passed *by the real wall clock* — a
// fixed "09:00" fixture slot would be silently dropped once the suite runs
// after 9am local time. Moving the date picker to a fixed future date
// bypasses that filter (it only applies when selectedDate === today).
const selectFutureDate = () => {
  const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
  fireEvent.change(dateInput, { target: { value: "2027-06-15" } });
};

const renderVenuePage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VenueDetailClient />
    </QueryClientProvider>
  );
};

const mockDefaults = (overrides: { venue?: Venue | null } = {}) => {
  const venue = overrides.venue === undefined ? venueFixture : overrides.venue;
  getVenueById.mockResolvedValue(
    venue ? { success: true, data: venue } : { success: false, data: null }
  );
  getVenueAvailability.mockResolvedValue({
    success: true,
    data: { availableSlots: [], bookedSlots: [] },
  });
  getVenueReviews.mockResolvedValue({
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
  getVenueById.mockReset();
  getVenueAvailability.mockReset();
  joinWaitlist.mockReset();
  getVenueReviews.mockReset();
  getReviewEligibility.mockReset();
  createReview.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe("VenueDetailClient — loading and not-found", () => {
  it("shows the venue once loaded", async () => {
    mockDefaults();
    renderVenuePage();

    expect(await screen.findByText("Downtown Sports Complex")).toBeInTheDocument();
    expect(screen.getByText("123 Main St")).toBeInTheDocument();
  });

  it("shows a not-found state when the venue does not exist", async () => {
    mockDefaults({ venue: null });
    renderVenuePage();

    expect(await screen.findByText("Venue not found")).toBeInTheDocument();
  });

  it("toasts an error when the venue query fails", async () => {
    getVenueById.mockRejectedValue(new Error("network down"));
    getVenueAvailability.mockResolvedValue({
      success: true,
      data: { availableSlots: [], bookedSlots: [] },
    });
    getVenueReviews.mockResolvedValue({
      success: true,
      data: { reviews: [], summary: emptyReviewSummary },
    });
    getReviewEligibility.mockResolvedValue({
      success: true,
      data: { eligible: false, bookingId: null, reason: "" },
    });
    renderVenuePage();

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Failed to load venue details");
    });
  });
});

describe("VenueDetailClient — sport-specific pricing", () => {
  it("shows the sport-specific rate for the selected sport once a slot is chosen", async () => {
    mockUser = { id: "user-1", role: "Player" };
    mockDefaults();
    getVenueAvailability.mockResolvedValue({
      success: true,
      data: { availableSlots: ["09:00-10:00"], bookedSlots: [] },
    });
    renderVenuePage();
    await screen.findByText("Downtown Sports Complex");
    selectFutureDate();

    fireEvent.click(await screen.findByText("09:00 - 10:00"));

    // Tennis (the default sport) has an override of 1000, not the venue's
    // flat pricePerHour of 800.
    expect(screen.getByText("1000")).toBeInTheDocument();
  });

  it("falls back to the flat pricePerHour for a sport with no override", async () => {
    mockUser = { id: "user-1", role: "Player" };
    mockDefaults();
    getVenueAvailability.mockResolvedValue({
      success: true,
      data: { availableSlots: ["09:00-10:00"], bookedSlots: [] },
    });
    renderVenuePage();
    await screen.findByText("Downtown Sports Complex");
    selectFutureDate();

    // "Badminton" appears twice — once in the "Sports Available" card, once
    // in the sidebar's own sport picker — either instance sets the same
    // selectedSport state.
    fireEvent.click(screen.getAllByRole("button", { name: "Badminton" })[0]);
    fireEvent.click(await screen.findByText("09:00 - 10:00"));

    // "800" (the venue's flat pricePerHour) renders both in the header's
    // "Starting from" price and again in the sidebar's booking total.
    expect(screen.getAllByText("800").length).toBeGreaterThan(0);
  });
});

describe("VenueDetailClient — availability and booking", () => {
  it("shows a sign-in link instead of a booking button when logged out", async () => {
    mockDefaults();
    renderVenuePage();
    await screen.findByText("Downtown Sports Complex");

    expect(screen.getByRole("link", { name: /Sign In to Book/i })).toBeInTheDocument();
  });

  it("lets a signed-in player confirm a booking for an available slot", async () => {
    mockUser = { id: "user-1", role: "Player" };
    mockDefaults();
    getVenueAvailability.mockResolvedValue({
      success: true,
      data: { availableSlots: ["09:00-10:00"], bookedSlots: [] },
    });
    renderVenuePage();
    await screen.findByText("Downtown Sports Complex");
    selectFutureDate();

    fireEvent.click(await screen.findByText("09:00 - 10:00"));
    expect(screen.getByText("Available")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Confirm Booking/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        expect.stringContaining("/checkout?type=venue&venueId=venue-1")
      );
    });
    const [pushedUrl] = pushMock.mock.calls[0];
    expect(pushedUrl).toContain("startTime=09%3A00");
    expect(pushedUrl).toContain("sport=Tennis");
  });

  it("refuses booking for a non-player/parent role", async () => {
    mockUser = { id: "user-1", role: "Coach" };
    mockDefaults();
    getVenueAvailability.mockResolvedValue({
      success: true,
      data: { availableSlots: ["09:00-10:00"], bookedSlots: [] },
    });
    renderVenuePage();
    await screen.findByText("Downtown Sports Complex");
    selectFutureDate();

    fireEvent.click(await screen.findByText("09:00 - 10:00"));
    fireEvent.click(screen.getByRole("button", { name: /Confirm Booking/i }));

    expect(toastError).toHaveBeenCalledWith("Only player accounts can create bookings.");
    expect(pushMock).not.toHaveBeenCalledWith(expect.stringContaining("/checkout"));
  });

  it("offers Join Waitlist for a booked slot and calls the API on click", async () => {
    mockUser = { id: "user-1", role: "Player" };
    mockDefaults();
    getVenueAvailability.mockResolvedValue({
      success: true,
      data: { availableSlots: [], bookedSlots: ["09:00-10:00"], allSlots: ["09:00-10:00"] },
    });
    joinWaitlist.mockResolvedValue({ success: true });
    renderVenuePage();
    await screen.findByText("Downtown Sports Complex");
    selectFutureDate();

    fireEvent.click(await screen.findByText("09:00 - 10:00"));
    expect(screen.getByText("Booked (Waitlist)")).toBeInTheDocument();

    // The slot button's own accessible name concatenates both its text
    // nodes ("09:00 - 10:00 Join Waitlist"); the sidebar CTA's name is
    // exactly "Join Waitlist".
    fireEvent.click(screen.getByRole("button", { name: "Join Waitlist" }));

    await waitFor(() => {
      expect(joinWaitlist).toHaveBeenCalledWith(
        expect.objectContaining({ venueId: "venue-1", sport: "Tennis", startTime: "09:00" })
      );
    });
    expect(toastSuccess).toHaveBeenCalled();
  });
});

describe("VenueDetailClient — image gallery and lightbox", () => {
  it("opens the lightbox on image click and navigates with arrow keys", async () => {
    mockDefaults();
    renderVenuePage();
    await screen.findByText("Downtown Sports Complex");

    expect(screen.getByText("Photo 1 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Photo 1 of 2"));

    expect(screen.getByLabelText("Close gallery")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    // The main hero photo counter advances alongside the lightbox.
    expect(screen.getByText("Photo 2 of 2")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByLabelText("Close gallery")).not.toBeInTheDocument();
  });

  it("selects a thumbnail directly", async () => {
    mockDefaults();
    renderVenuePage();
    await screen.findByText("Downtown Sports Complex");

    fireEvent.click(screen.getByLabelText("Show venue image 2"));

    expect(screen.getByText("Photo 2 of 2")).toBeInTheDocument();
  });
});

describe("VenueDetailClient — reviews", () => {
  it("shows the review composer only when eligible, and submits it", async () => {
    mockUser = { id: "user-1", role: "Player" };
    mockDefaults();
    getReviewEligibility.mockResolvedValue({
      success: true,
      data: { eligible: true, bookingId: "booking-1", reason: "" },
    });
    createReview.mockResolvedValue({ success: true });
    renderVenuePage();
    await screen.findByText("Downtown Sports Complex");

    expect(await screen.findByText("Share your experience")).toBeInTheDocument();
    const submitButton = screen.getByRole("button", { name: /Submit Review/i });
    expect(submitButton).toBeDisabled();

    const ratingButtons = screen
      .getAllByRole("button", { name: "" })
      .filter((btn) => btn.querySelector("svg.lucide-star"));
    fireEvent.click(ratingButtons[4]); // 5th star = rating 5

    expect(submitButton).not.toBeDisabled();
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(createReview).toHaveBeenCalledWith({
        bookingId: "booking-1",
        targetType: "VENUE",
        targetId: "venue-1",
        rating: 5,
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
    renderVenuePage();
    await screen.findByText("Downtown Sports Complex");

    expect(await screen.findByText("Complete a booking first.")).toBeInTheDocument();
    expect(screen.queryByText("Share your experience")).not.toBeInTheDocument();
  });
});
