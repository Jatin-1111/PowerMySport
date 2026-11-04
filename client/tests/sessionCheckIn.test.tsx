// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A plain function, not vi.fn(): the runner attaches its own handler to a spy's returned
// promise, so a call that rejects is reported as unhandled even though the hook catches it.
const apiCalls: string[] = [];
let apiResult: () => Promise<unknown> = () => Promise.resolve(undefined);
vi.mock("../src/modules/booking/services/booking", () => ({
  bookingApi: {
    checkInBookingByCode: (code: string) => {
      apiCalls.push(code);
      return apiResult();
    },
  },
}));

import { SessionCheckIn } from "../src/modules/shared/components/bookings/SessionCheckIn";
import {
  normalizeCheckInCode,
  useSessionCheckIn,
} from "../src/modules/shared/hooks/useSessionCheckIn";
import type { Booking } from "../src/types";

const started = {
  id: "b1",
  userId: { name: "Kavya Menon" },
  sport: "tennis",
  date: "2026-11-05T00:00:00.000Z",
  startTime: "07:00",
  endTime: "08:00",
  status: "IN_PROGRESS",
} as unknown as Booking;

beforeEach(() => {
  apiCalls.length = 0;
  apiResult = () => Promise.resolve(undefined);
});
afterEach(cleanup);

describe("normalizeCheckInCode", () => {
  it("keeps upper-case letters and digits, at most eight", () => {
    expect(normalizeCheckInCode("ab-cd 12 34 zz")).toBe("ABCD1234");
    expect(normalizeCheckInCode("abc")).toBe("ABC");
    expect(normalizeCheckInCode("")).toBe("");
  });
});

describe("useSessionCheckIn", () => {
  it("asks for a code before calling the API", async () => {
    const { result } = renderHook(() => useSessionCheckIn());
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.message).toEqual({
      tone: "error",
      text: "Enter the client's check-in code.",
    });
    expect(apiCalls).toEqual([]);
  });

  it("says when the code is too short", async () => {
    const { result } = renderHook(() => useSessionCheckIn());
    act(() => result.current.setCode("abc123"));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.message?.text).toBe("The code has 8 characters.");
    expect(apiCalls).toEqual([]);
  });

  it("starts the session with the normalised code, clears the field and reports the booking", async () => {
    apiResult = () => Promise.resolve({ success: true, data: started });
    const onStarted = vi.fn();
    const { result } = renderHook(() => useSessionCheckIn(onStarted));

    act(() => result.current.setCode("abcd-1234"));
    expect(result.current.code).toBe("ABCD1234");
    await act(async () => {
      await result.current.submit();
    });

    expect(apiCalls).toEqual(["ABCD1234"]);
    expect(result.current.message).toEqual({ tone: "success", text: "Session started." });
    expect(result.current.code).toBe("");
    expect(result.current.startedBooking?.id).toBe("b1");
    expect(onStarted).toHaveBeenCalledWith(started);
  });

  it("shows the API's message when the code is rejected", async () => {
    // Like axios: an Error carrying the server's response, thrown when the call is made.
    apiResult = () =>
      Promise.reject(
        Object.assign(new Error("Request failed with status code 400"), {
          response: { data: { message: "Code has expired." } },
        })
      );
    const { result } = renderHook(() => useSessionCheckIn());
    act(() => result.current.setCode("ABCD1234"));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.message).toEqual({ tone: "error", text: "Code has expired." });
    expect(result.current.startedBooking).toBeNull();
  });

  it("falls back to a plain message when the API gives none", async () => {
    apiResult = () => Promise.resolve({ success: false });
    const { result } = renderHook(() => useSessionCheckIn());
    act(() => result.current.setCode("ABCD1234"));
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.message?.text).toBe("We could not verify that code.");
  });
});

describe("SessionCheckIn", () => {
  const base = {
    code: "",
    onCodeChange: vi.fn(),
    loading: false,
    message: null,
    startedBooking: null,
    onSubmit: vi.fn(),
  };

  it("has a labelled field and submits with the form", () => {
    const onSubmit = vi.fn();
    render(<SessionCheckIn {...base} onSubmit={onSubmit} />);
    expect(screen.getByLabelText("Check-in code")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("announces an error and shows who started when it works", () => {
    const { rerender } = render(
      <SessionCheckIn {...base} message={{ tone: "error", text: "Code has expired." }} />
    );
    expect(screen.getByRole("alert").textContent).toBe("Code has expired.");

    rerender(
      <SessionCheckIn
        {...base}
        message={{ tone: "success", text: "Session started." }}
        startedBooking={started}
      />
    );
    expect(screen.getByText("Session started.")).toBeTruthy();
    expect(screen.getByText(/Kavya Menon/)).toBeTruthy();
  });

  it("disables the button while checking", async () => {
    render(<SessionCheckIn {...base} loading />);
    const button = screen.getByRole("button", { name: "Checking" }) as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(true));
  });
});
