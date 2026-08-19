// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory router/searchParams so the hook can be driven without Next.
const mocks = vi.hoisted(() => {
  const state = { search: "" };
  return {
    state,
    push: vi.fn((url: string) => {
      state.search = url.includes("?") ? url.slice(url.indexOf("?")) : "";
    }),
    replace: vi.fn((url: string) => {
      state.search = url.includes("?") ? url.slice(url.indexOf("?")) : "";
    }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  usePathname: () => "/checkout",
  useSearchParams: () => new URLSearchParams(mocks.state.search),
}));

import { defineFlow } from "./defineFlow";
import { useFlow } from "./useFlow";

type Ctx = { hasDetails: boolean; hasMethod: boolean };
const FLOW = defineFlow<"review" | "payment" | "confirm", Ctx>({
  id: "checkout",
  steps: ["review", "payment", "confirm"],
  canEnter: {
    payment: (c) => c.hasDetails,
    confirm: (c) => c.hasDetails && c.hasMethod,
  },
});

const ready: Ctx = { hasDetails: true, hasMethod: true };

beforeEach(() => {
  mocks.state.search = "";
  mocks.push.mockClear();
  mocks.replace.mockClear();
});

describe("useFlow", () => {
  it("starts on the first step with no param in the URL", () => {
    const { result } = renderHook(() => useFlow(FLOW, ready));
    expect(result.current.step).toBe("review");
    expect(result.current.number).toBe(1);
  });

  it("writes the step name to the URL on a forward move (push, not replace)", () => {
    const { result, rerender } = renderHook(() => useFlow(FLOW, ready));
    act(() => result.current.next());
    // User moves push, so Back walks the flow rather than leaving it.
    expect(mocks.push).toHaveBeenCalledWith("/checkout?step=payment", {
      scroll: false,
    });
    rerender();
    expect(result.current.step).toBe("payment");
  });

  it("omits the param for step one so a bare link means the beginning", () => {
    mocks.state.search = "?step=payment";
    const { result, rerender } = renderHook(() => useFlow(FLOW, ready));
    expect(result.current.step).toBe("payment");
    act(() => result.current.back());
    rerender();
    expect(result.current.step).toBe("review");
    // Back to step one drops ?step entirely.
    expect(mocks.push).toHaveBeenLastCalledWith("/checkout", { scroll: false });
  });

  it("reports the direction of the last move for transitions", () => {
    mocks.state.search = "?step=payment";
    const { result, rerender } = renderHook(() => useFlow(FLOW, ready));
    act(() => result.current.next());
    rerender();
    expect(result.current.direction).toBe(1);
    act(() => result.current.back());
    rerender();
    expect(result.current.direction).toBe(-1);
  });

  it("corrects an unreachable deep link with replace, so it is not a Back target", () => {
    mocks.state.search = "?step=confirm";
    const notReady: Ctx = { hasDetails: false, hasMethod: false };
    renderHook(() => useFlow(FLOW, notReady));
    // The clamp effect rewrites the URL, and uses replace so the bad step does
    // not become a history entry.
    expect(mocks.replace).toHaveBeenCalledWith("/checkout", { scroll: false });
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
