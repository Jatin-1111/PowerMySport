import { vi } from "vitest";

/**
 * Mutable stand-in for Next's routing context.
 *
 * Kept in its own module (rather than in smokeSetup) because vitest forbids
 * exporting a `vi.hoisted` binding, and the `next/navigation` mock factory needs
 * to read this lazily at first import of the mocked module.
 *
 * Tests drive it through `renderRoute`, not directly.
 */
export const navState = {
  pathname: "/",
  searchParams: new URLSearchParams(),
  params: {} as Record<string, string>,
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  },
};

export function resetNavState() {
  navState.pathname = "/";
  navState.searchParams = new URLSearchParams();
  navState.params = {};
}
