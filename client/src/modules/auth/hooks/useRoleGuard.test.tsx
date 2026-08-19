// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` is hoisted above the module body, so anything its factory closes
// over has to be created in a `vi.hoisted` block rather than as a plain const.
const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  toastError: vi.fn(),
  pathname: { current: "/dashboard" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
  usePathname: () => mocks.pathname.current,
}));

vi.mock("@/lib/toast", () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}));

const { replace, push, toastError } = mocks;
const setPathname = (value: string) => {
  mocks.pathname.current = value;
};

import { useAuthStore } from "@/modules/auth/store/authStore";
import type { User } from "@/types";
import { useRoleGuard } from "./useRoleGuard";

const userWithRole = (role: User["role"]): User =>
  ({ id: "u1", name: "Test", email: "t@example.com", role }) as User;

/** Put the store into one of the three session states. */
const setSession = (
  state: "unknown" | "anonymous" | { role: User["role"] },
) => {
  if (state === "unknown") {
    useAuthStore.setState({ hydrated: false, user: null });
  } else if (state === "anonymous") {
    useAuthStore.setState({ hydrated: true, user: null });
  } else {
    useAuthStore.setState({ hydrated: true, user: userWithRole(state.role) });
  }
};

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
  toastError.mockClear();
  setPathname("/dashboard");
  useAuthStore.setState({ hydrated: false, user: null, token: null });
});

describe("useRoleGuard", () => {
  it("waits without navigating while the session is unresolved", () => {
    setSession("unknown");
    const { result } = renderHook(() => useRoleGuard());

    expect(result.current).toBe("unknown");
    // The regression this pins: acting on an unresolved session bounced signed-in
    // users out mid-hydration.
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends an anonymous visitor to login with the return path", () => {
    setPathname("/dashboard/my-bookings");
    setSession("anonymous");
    const { result } = renderHook(() => useRoleGuard());

    expect(result.current).toBe("redirecting");
    expect(replace).toHaveBeenCalledWith(
      "/login?redirect=%2Fdashboard%2Fmy-bookings",
    );
  });

  it("admits a permitted role and stays put", () => {
    setSession({ role: "Parent" });
    const { result } = renderHook(() => useRoleGuard());

    expect(result.current).toBe("allowed");
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a signed-in wrong-role user home, with an explanation", () => {
    setPathname("/venue-lister/inventory");
    setSession({ role: "Coach" });
    const { result } = renderHook(() => useRoleGuard());

    expect(result.current).toBe("redirecting");
    expect(replace).toHaveBeenCalledWith("/");
    expect(toastError).toHaveBeenCalled();
  });

  it("leaves public paths open to anonymous visitors", () => {
    setPathname("/academy/onboarding");
    setSession("anonymous");
    const { result } = renderHook(() => useRoleGuard());

    expect(result.current).toBe("allowed");
    expect(replace).not.toHaveBeenCalled();
  });

  it("leaves ungoverned routes alone", () => {
    setPathname("/booking");
    setSession("anonymous");
    const { result } = renderHook(() => useRoleGuard());

    expect(result.current).toBe("allowed");
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects once, not on every re-render", () => {
    setPathname("/coach/earnings");
    setSession("anonymous");
    const { rerender } = renderHook(() => useRoleGuard());

    rerender();
    rerender();

    // Repeated redirects are what MAX_GATE_REDIRECTS in the coach shell exists
    // to absorb.
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("does not treat the public coach profile as the coach console", () => {
    // /coaches/[coachId] is what a parent books from. Gating it would break
    // discovery for signed-out visitors.
    setPathname("/coaches/abc123");
    setSession("anonymous");
    const { result } = renderHook(() => useRoleGuard());

    expect(result.current).toBe("allowed");
    expect(replace).not.toHaveBeenCalled();
  });
});
