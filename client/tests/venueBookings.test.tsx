// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMyBookings = vi.fn();
const getMyVenues = vi.fn();
const confirmBookingByProvider = vi.fn();
const rejectBookingByProvider = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../src/modules/booking/services/booking", () => ({
  bookingApi: {
    getMyBookings: (...a: unknown[]) => getMyBookings(...a),
    confirmBookingByProvider: (...a: unknown[]) => confirmBookingByProvider(...a),
    rejectBookingByProvider: (...a: unknown[]) => rejectBookingByProvider(...a),
  },
}));
vi.mock("../src/modules/venue/services/venue", () => ({
  venueApi: { getMyVenues: (...a: unknown[]) => getMyVenues(...a) },
}));
vi.mock("../src/modules/auth/store/authStore", () => ({
  useAuthStore: (select: (s: { hydrated: boolean; token: string }) => unknown) =>
    select({ hydrated: true, token: "t" }),
}));
vi.mock("../src/lib/toast", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import { VenueBookings } from "../src/modules/venue/components/bookings/VenueBookings";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00.000Z`;
};

let counter = 0;
const booking = (over: Record<string, unknown> = {}) => ({
  id: `b${++counter}`,
  venueId: "v1",
  userId: "u1",
  sport: "tennis",
  date: day(2),
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
      <VenueBookings />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  counter = 0;
  for (const fn of [
    getMyBookings,
    getMyVenues,
    confirmBookingByProvider,
    rejectBookingByProvider,
    toastSuccess,
    toastError,
  ])
    fn.mockReset();
  getMyVenues.mockReturnValue(ok([{ id: "v1", name: "Court One", sports: ["tennis"] }]));
  getMyBookings.mockReturnValue(ok([]));
});

afterEach(cleanup);

describe("VenueBookings", () => {
  it("explains an empty list and points at the venues", async () => {
    renderPage();
    expect(await screen.findByText(/no bookings yet/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /check your venues/i }).getAttribute("href")).toBe(
      "/venue-lister/inventory"
    );
  });

  it("leads each booking with the venue, since the player is private", async () => {
    getMyBookings.mockReturnValue(ok([booking()]));
    renderPage();
    const list = await screen.findByRole("list");
    expect(within(list).getByText("Court One")).toBeTruthy();
    expect(screen.queryByText(/privacy protected/i)).toBeNull();
  });

  it("confirms a request in place and moves it out of the requests section", async () => {
    getMyBookings.mockReturnValue(ok([booking({ status: "AWAITING_PROVIDER" })]));
    confirmBookingByProvider.mockReturnValue(ok({ status: "CONFIRMED" }));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /confirm booking for court one/i }));

    await waitFor(() => expect(confirmBookingByProvider).toHaveBeenCalledWith("b1"));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Booking confirmed."));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /confirm booking for/i })).toBeNull()
    );
    expect(screen.getByText("Confirmed")).toBeTruthy();
  });

  it("declines a request and tells the owner when that fails", async () => {
    getMyBookings.mockReturnValue(ok([booking({ status: "AWAITING_PROVIDER" })]));
    rejectBookingByProvider.mockImplementation(() =>
      Promise.reject({ response: { data: { message: "Already cancelled." } } })
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /decline booking for court one/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Already cancelled."));
    expect(screen.getByRole("button", { name: /decline booking for court one/i })).toBeTruthy();
  });

  it("offers a retry when bookings cannot be loaded", async () => {
    getMyBookings.mockImplementation(() => Promise.reject(new Error("boom")));
    renderPage();
    expect(await screen.findByText("We could not load your bookings")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
