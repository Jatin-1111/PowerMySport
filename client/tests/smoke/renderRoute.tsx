import { render, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { expect, vi } from "vitest";

import { useAuthStore } from "@/modules/auth/store/authStore";
import { navState } from "../setup/navState";

/**
 * React/jsdom noise that says nothing about whether the route is healthy.
 * Anything not matched here fails the test.
 */
const IGNORED_CONSOLE_ERRORS = [
  /not wrapped in act\(/,
  /Warning: ReactDOM\.render/,
  /useLayoutEffect does nothing on the server/,
  /Not implemented: HTMLFormElement\.prototype\.(submit|requestSubmit)/,
  /Not implemented: navigation/,
];

export type Role = "player" | "coach" | "venue-lister" | "expert" | "academy";

export interface RenderRouteOptions {
  /** Seeds the auth store. Pass `null` for an anonymous visitor. */
  role?: Role | null;
  /** Query string, e.g. "type=venue&venueId=v1". */
  query?: string;
  /** Dynamic route params, e.g. { coachId: "c1" }. */
  params?: Record<string, string>;
  pathname?: string;
  /**
   * Floor for rendered text length. Defaults to 40, which catches a route that
   * silently collapses to nothing. Lower it for routes whose expected state is
   * a deliberately terse empty/error screen.
   */
  minTextLength?: number;
}

/**
 * Renders a route component the way a browser would reach it, then asserts the
 * page produced real output and logged no meaningful console errors.
 *
 * Returns the rendered text so callers can assert on landmark copy — that
 * assertion is what distinguishes "the page works" from "the page mounted and
 * rendered an error state".
 */
export async function renderRoute(
  Component: ComponentType,
  options: RenderRouteOptions = {},
): Promise<{ text: string; container: HTMLElement }> {
  const {
    role = "player",
    query = "",
    params = {},
    pathname = "/",
    minTextLength = 40,
  } = options;

  navState.searchParams = new URLSearchParams(query);
  navState.params = params;
  navState.pathname = pathname;

  if (role) {
    useAuthStore.setState({
      user: {
        _id: "test-user-id",
        name: "Test User",
        email: "test@example.local",
        role,
      } as never,
      token: "test-token",
    });
  } else {
    useAuthStore.setState({ user: null, token: null });
  }

  const captured: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
    captured.push(args.map(String).join(" "));
  });

  let container: HTMLElement;
  try {
    ({ container } = render(<Component />));
    // Let mount effects and their (mocked, immediately-resolved) requests flush.
    await waitFor(
      () => {
        expect(container).toBeTruthy();
      },
      { timeout: 2000 },
    );
  } finally {
    spy.mockRestore();
  }

  const real = captured.filter(
    (msg) => !IGNORED_CONSOLE_ERRORS.some((re) => re.test(msg)),
  );
  expect(real, "route logged console errors:\n" + real.join("\n---\n")).toEqual(
    [],
  );

  const text = container.textContent || "";
  // A route that renders almost nothing is a regression, even without a throw.
  expect(
    text.length,
    "route rendered almost no text (" + text.length + " chars)",
  ).toBeGreaterThanOrEqual(minTextLength);

  return { text, container };
}
