// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMyBookings = vi.fn();
const confirmBookingByProvider = vi.fn();
const rejectBookingByProvider = vi.fn();
const getMyProfile = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../src/modules/booking/services/booking", () => ({
  bookingApi: {
    getMyBookings: (...a: unknown[]) => getMyBookings(...a),
    confirmBookingByProvider: (...a: unknown[]) => confirmBookingByProvider(...a),
    rejectBookingByProvider: (...a: unknown[]) => rejectBookingByProvider(...a),
  },
}));
vi.mock("../src/modules/coach/services/coach", () => ({
  coachApi: { getMyProfile: (...a: unknown[]) => getMyProfile(...a) },
}));
vi.mock("../src/lib/toast", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import CoachBookingsPage from "../src/app/(booking)/coach/my-bookings/page";
import {
  bookingPlace,
  bookingStatusView,
  countByFilter,
  filterSessions,
  requestsOf,
} from "../src/modules/coach/utils/bookings";
import type { Booking } from "../src/types";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00.000Z`;
};

let counter = 0;
const booking = (over: Record<string, unknown> = {}): Booking =>
  ({
    id: `b${++counter}`,
    coachId: "coach-1",
    userId: { name: "Kavya Menon" },
    sport: "tennis",
    date: day(2),
    startTime: "07:00",
    endTime: "08:00",
    status: "CONFIRMED",
    totalAmount: 1200,
    ...over,
  }) as unknown as Booking;

const ok = (data: unknown) => Promise.resolve({ success: true, data });

beforeEach(() => {
  counter = 0;
  for (const fn of [getMyBookings, confirmBookingByProvider, rejectBookingByProvider, getMyProfile])
    fn.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  getMyProfile.mockReturnValue(ok({ id: "coach-1" }));
});
afterEach(cleanup);

describe("booking grouping", () => {
  const all = [
    booking({ id: "req", status: "AWAITING_PROVIDER" }),
    booking({ id: "soon", date: day(1) }),
    booking({ id: "later", date: day(5) }),
    booking({ id: "done", status: "COMPLETED", date: day(-3) }),
    booking({ id: "older", status: "COMPLETED", date: day(-9) }),
    booking({ id: "gone", status: "CANCELLED", date: day(-1) }),
  ];

  it("keeps requests out of the sessions list and sorts them soonest first", () => {
    expect(requestsOf(all).map((b) => b.id)).toEqual(["req"]);
    for (const filter of ["upcoming", "past", "all"] as const) {
      expect(filterSessions(all, filter).some((b) => b.id === "req")).toBe(false);
    }
  });

  it("puts upcoming soonest first and past most recent first", () => {
    expect(filterSessions(all, "upcoming").map((b) => b.id)).toEqual(["soon", "later"]);
    expect(filterSessions(all, "past").map((b) => b.id)).toEqual(["gone", "done", "older"]);
  });

  it("counts each filter", () => {
    expect(countByFilter(all)).toEqual({ upcoming: 2, past: 3, all: 5 });
  });

  it("says what each status is in words", () => {
    expect(bookingStatusView("AWAITING_PROVIDER")).toEqual({
      tone: "pending",
      tag: "Needs your reply",
    });
    expect(bookingStatusView("CONFIRMED").tag).toBe("Confirmed");
    expect(bookingStatusView("NO_SHOW").tone).toBe("alert");
    expect(bookingStatusView("CANCELLED" as Booking["status"]).tag).toBe("Cancelled");
  });

  it("names where a session is", () => {
    expect(bookingPlace(booking({ venueId: { name: "Court A" } }), null)).toBe("Court A");
    expect(bookingPlace(booking({ academyId: { name: "Baseline Academy" } }), null)).toBe(
      "Baseline Academy"
    );
    expect(bookingPlace(booking(), null)).toBe("Location on file");
  });
});

describe("CoachBookingsPage", () => {
  it("answers a request in place with the booking's own id", async () => {
    getMyBookings.mockReturnValue(
      ok([booking({ id: "req-1", status: "AWAITING_PROVIDER", userId: { name: "Arjun Rao" } })])
    );
    confirmBookingByProvider.mockReturnValue(ok({ status: "CONFIRMED" }));
    render(<CoachBookingsPage />);

    const list = await screen.findByRole("list", { name: "Pending requests" });
    expect(within(list).getByText("Arjun Rao")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirm booking for Arjun Rao" }));
    await waitFor(() => expect(confirmBookingByProvider).toHaveBeenCalledWith("req-1"));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Booking confirmed."));
    // Once confirmed it is no longer a request.
    await waitFor(() =>
      expect(screen.queryByRole("list", { name: "Pending requests" })).toBeNull()
    );
  });

  it("declines a request with the booking's own id", async () => {
    getMyBookings.mockReturnValue(
      ok([booking({ id: "req-2", status: "AWAITING_PROVIDER", userId: { name: "Ishaan Verma" } })])
    );
    rejectBookingByProvider.mockReturnValue(ok({ booking: { status: "CANCELLED" } }));
    render(<CoachBookingsPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Decline booking for Ishaan Verma" })
    );
    await waitFor(() =>
      expect(rejectBookingByProvider).toHaveBeenCalledWith("req-2", "Rejected by coach")
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Booking declined."));
  });

  it("works with raw documents that only carry _id", async () => {
    const raw = booking({ status: "AWAITING_PROVIDER", userId: { name: "Raw Doc" } });
    delete (raw as unknown as { id?: string }).id;
    (raw as unknown as { _id: string })._id = "raw-9";
    getMyBookings.mockReturnValue(ok([raw]));
    confirmBookingByProvider.mockReturnValue(ok({ status: "CONFIRMED" }));
    render(<CoachBookingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Confirm booking for Raw Doc" }));
    await waitFor(() => expect(confirmBookingByProvider).toHaveBeenCalledWith("raw-9"));
  });

  it("shows the API's message when an answer fails", async () => {
    getMyBookings.mockReturnValue(ok([booking({ status: "AWAITING_PROVIDER" })]));
    confirmBookingByProvider.mockRejectedValue({ response: { data: { message: "Slot taken." } } });
    render(<CoachBookingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Confirm booking for/ }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Slot taken."));
  });

  it("shows upcoming sessions first and switches to past", async () => {
    getMyBookings.mockReturnValue(
      ok([
        booking({ userId: { name: "Upcoming Person" }, date: day(2) }),
        booking({ userId: { name: "Past Person" }, status: "COMPLETED", date: day(-4) }),
      ])
    );
    render(<CoachBookingsPage />);

    expect(await screen.findByText("Upcoming Person")).toBeTruthy();
    expect(screen.queryByText("Past Person")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Past/ }));
    expect(await screen.findByText("Past Person")).toBeTruthy();
    expect(screen.queryByText("Upcoming Person")).toBeNull();
  });

  it("does not show a request twice", async () => {
    getMyBookings.mockReturnValue(
      ok([booking({ status: "AWAITING_PROVIDER", userId: { name: "Only Once" } })])
    );
    render(<CoachBookingsPage />);
    await screen.findByRole("list", { name: "Pending requests" });
    fireEvent.click(screen.getByRole("button", { name: /All/ }));
    expect(screen.getAllByText("Only Once")).toHaveLength(1);
  });

  it("explains an empty page and points to the schedule", async () => {
    getMyBookings.mockReturnValue(ok([]));
    render(<CoachBookingsPage />);
    expect(await screen.findByText(/No bookings yet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open your schedule/ }).getAttribute("href")).toBe(
      "/coach/schedule"
    );
  });

  it("says so when bookings cannot be loaded, and retries", async () => {
    getMyBookings.mockRejectedValueOnce(new Error("offline"));
    render(<CoachBookingsPage />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("We could not load your bookings");

    getMyBookings.mockReturnValue(ok([booking({ userId: { name: "Back Again" } })]));
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Back Again")).toBeTruthy();
  });
});
