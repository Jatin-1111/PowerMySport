// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/modules/auth/store/authStore";
import type { User } from "@/types";
import { QueryProvider } from "./QueryProvider";

/**
 * These assert on `QueryClient.clear` itself rather than on a proxy, so they
 * pin the actual behaviour: the cache is emptied exactly when the signed-in
 * identity changes, and never merely because the session finished hydrating.
 */
let clearSpy: ReturnType<typeof vi.spyOn>;

const asUser = (id: string): User =>
  ({ id, name: "Test", email: "t@example.com", role: "Parent" }) as User;

const setSession = (state: { hydrated: boolean; user: User | null }) =>
  act(() => useAuthStore.setState(state));

const mount = () =>
  render(
    <QueryProvider>
      <div>app</div>
    </QueryProvider>,
  );

beforeEach(() => {
  clearSpy = vi.spyOn(QueryClient.prototype, "clear");
  useAuthStore.setState({ hydrated: false, user: null, token: null });
});

afterEach(() => {
  clearSpy.mockRestore();
});

describe("QueryProvider cache scoping", () => {
  it("does not clear the cache while the session is still hydrating", () => {
    // A signed-in user looks like `user: null` until hydration finishes. Acting
    // on that would wipe the cache on every single page load.
    mount();
    setSession({ hydrated: false, user: asUser("u1") });
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it("does not clear on the first identity it observes after hydration", () => {
    mount();
    // Restoring an existing session is not an identity *change*.
    setSession({ hydrated: true, user: asUser("u1") });
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it("clears the cache when the signed-in user changes", () => {
    mount();
    setSession({ hydrated: true, user: asUser("u1") });
    expect(clearSpy).not.toHaveBeenCalled();

    // The shared-device case this exists for: one account replaced by another
    // without a full page load.
    setSession({ hydrated: true, user: asUser("u2") });
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it("clears on logout", () => {
    mount();
    setSession({ hydrated: true, user: asUser("u1") });
    setSession({ hydrated: true, user: null });
    // Previously nothing cleared here, so the next user in the same tab could be
    // served the previous user's bookings and friend list.
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it("clears again on a subsequent sign-in", () => {
    mount();
    setSession({ hydrated: true, user: asUser("u1") });
    setSession({ hydrated: true, user: null });
    setSession({ hydrated: true, user: asUser("u2") });
    expect(clearSpy).toHaveBeenCalledTimes(2);
  });
});
