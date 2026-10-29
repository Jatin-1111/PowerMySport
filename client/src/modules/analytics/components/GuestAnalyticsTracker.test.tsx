// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tracking = vi.hoisted(() => ({
  trackGuest: vi.fn(),
  flushGuestEvents: vi.fn(),
  getGuestId: vi.fn(() => "guest-1"),
  isGuest: vi.fn(() => true),
}));
const navigation = vi.hoisted(() => ({ pathname: "/pricing" }));

vi.mock("../services/guestTracking", () => tracking);
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

import { GuestAnalyticsTracker, isUntrackedPath } from "./GuestAnalyticsTracker";

const visit = (pathname: string) => {
  navigation.pathname = pathname;
  window.history.pushState({}, "", pathname);
};

beforeEach(() => {
  tracking.trackGuest.mockClear();
  tracking.flushGuestEvents.mockClear();
  tracking.getGuestId.mockClear();
});
afterEach(cleanup);

describe("which pages are not tracked", () => {
  it("is a shared profile and nothing else", () => {
    expect(isUntrackedPath(`/share/${"a".repeat(43)}`)).toBe(true);
    expect(isUntrackedPath("/share/abc/anything")).toBe(true);
    for (const path of [
      "/",
      "/pricing",
      "/shared",
      "/sharing",
      "/api/share/abc",
      "/dashboard/share",
    ]) {
      expect(isUntrackedPath(path)).toBe(false);
    }
  });
});

describe("the guest tracker", () => {
  it("still records an ordinary page view and click", () => {
    visit("/pricing");
    render(
      <>
        <GuestAnalyticsTracker />
        <button>Book a session</button>
      </>
    );
    expect(tracking.trackGuest).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "page_view", entityId: "/pricing" })
    );
    fireEvent.click(document.querySelector("button")!);
    expect(tracking.trackGuest).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "click" })
    );
  });

  it("records nothing on a shared profile: no page view, no click, no scroll, no device id", () => {
    const token = "b".repeat(43);
    visit(`/share/${token}`);
    render(
      <>
        <GuestAnalyticsTracker />
        <a href="https://example.org/draw">Result page</a>
        <button>Play</button>
      </>
    );

    fireEvent.click(document.querySelector("a")!);
    fireEvent.click(document.querySelector("button")!);
    fireEvent.scroll(window);
    window.dispatchEvent(new Event("pagehide"));

    expect(tracking.trackGuest).not.toHaveBeenCalled();
    expect(tracking.getGuestId).not.toHaveBeenCalled();
    expect(JSON.stringify(tracking.trackGuest.mock.calls)).not.toContain(token);
  });

  it("does not carry a shared page's path into what it records afterwards", () => {
    const token = "c".repeat(43);
    visit(`/share/${token}`);
    const { rerender } = render(<GuestAnalyticsTracker />);
    visit("/pricing");
    rerender(<GuestAnalyticsTracker />);
    window.dispatchEvent(new Event("pagehide"));
    expect(JSON.stringify(tracking.trackGuest.mock.calls)).not.toContain(token);
  });
});
