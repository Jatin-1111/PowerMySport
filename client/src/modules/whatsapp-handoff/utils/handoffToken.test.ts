// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetToken, recalledToken, rememberToken } from "./handoffToken";

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("handoff token storage", () => {
  it("holds the token for the visit and gives it back", () => {
    expect(recalledToken()).toBeNull();
    rememberToken("abc.def");
    expect(recalledToken()).toBe("abc.def");
  });

  it("forgets it", () => {
    rememberToken("abc.def");
    forgetToken();
    expect(recalledToken()).toBeNull();
  });

  it("keeps it only for the tab, never in long-lived storage", () => {
    rememberToken("abc.def");
    expect(window.localStorage.length).toBe(0);
  });

  it("does not throw when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => rememberToken("abc.def")).not.toThrow();
    expect(recalledToken()).toBeNull();
    expect(() => forgetToken()).not.toThrow();
  });
});
