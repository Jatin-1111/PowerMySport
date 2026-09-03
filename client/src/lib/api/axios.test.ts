// @vitest-environment jsdom

import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loginUrlFor } from "@/flow/policy";
import axiosInstance, { returnPathForUnauthorized, setUnauthorizedHandler } from "./axios";

/**
 * Covers RC-7's second half: a 401 used to hard-navigate to a bare `/login`,
 * discarding the page the user was on and racing the route guards. The return
 * path is what was lost, so it is what is pinned here — and the interceptor is
 * driven for real rather than having its decision re-implemented in the test.
 */

describe("returnPathForUnauthorized", () => {
  it("preserves the page the user was on", () => {
    expect(returnPathForUnauthorized("/dashboard/my-bookings")).toBe("/dashboard/my-bookings");
  });

  it("keeps the query string, so a filtered view comes back filtered", () => {
    expect(returnPathForUnauthorized("/coach/clients", "?status=active")).toBe(
      "/coach/clients?status=active"
    );
  });

  it.each(["/login", "/register", "/forgot-password", "/reset-password"])(
    "returns null on %s rather than offering it as a destination",
    (pathname) => {
      // `/login?redirect=/login` sends the user back to where they already are.
      expect(returnPathForUnauthorized(pathname)).toBeNull();
    }
  );

  it("returns null for a nested auth route too", () => {
    expect(returnPathForUnauthorized("/reset-password/abc123")).toBeNull();
  });

  it("rejects an absolute external URL smuggled in as a pathname", () => {
    // Validated by the same allowlist the login page uses, so the interceptor
    // cannot become an open redirect either.
    expect(returnPathForUnauthorized("https://evil.example/steal")).toBeNull();
  });

  it("produces a login URL that round-trips through loginUrlFor", () => {
    const returnTo = returnPathForUnauthorized("/coach/clients", "?status=active");
    expect(loginUrlFor(returnTo)).toBe("/login?redirect=%2Fcoach%2Fclients%3Fstatus%3Dactive");
  });

  it("falls back to a bare login URL when there is nowhere to return to", () => {
    expect(loginUrlFor(returnPathForUnauthorized("/login"))).toBe("/login");
  });
});

describe("the response interceptor, driven for real", () => {
  const unregister: Array<() => void> = [];

  /** Makes every request fail the way the API does when the session is gone. */
  const failWith = (status: number, url: string, message = "Unauthorized") => {
    axiosInstance.defaults.adapter = (config) =>
      Promise.reject(
        new AxiosError(
          message,
          "ERR_BAD_REQUEST",
          { ...config, url } as InternalAxiosRequestConfig,
          null,
          {
            status,
            statusText: "",
            data: { message },
            headers: {},
            config: { ...config, url } as InternalAxiosRequestConfig,
          }
        )
      );
  };

  const at = (url: string) => window.history.pushState({}, "", url);

  beforeEach(() => {
    at("/dashboard/my-bookings");
    localStorage.clear();
  });

  afterEach(() => {
    while (unregister.length) unregister.pop()?.();
    delete axiosInstance.defaults.adapter;
  });

  const register = (fn: (returnTo: string | null) => void) => {
    unregister.push(setUnauthorizedHandler(fn));
  };

  it("hands the registered handler the page the user was on", async () => {
    const handler = vi.fn();
    register(handler);
    failWith(401, "/bookings");

    await expect(axiosInstance.get("/bookings")).rejects.toThrow();

    expect(handler).toHaveBeenCalledExactlyOnceWith("/dashboard/my-bookings");
  });

  it("includes the query string", async () => {
    const handler = vi.fn();
    register(handler);
    at("/coach/clients?status=active");
    failWith(401, "/coach/clients");

    await expect(axiosInstance.get("/coach/clients")).rejects.toThrow();

    expect(handler).toHaveBeenCalledWith("/coach/clients?status=active");
  });

  it("passes null when the user is already on an auth page", async () => {
    const handler = vi.fn();
    register(handler);
    at("/login");
    failWith(401, "/bookings");

    await expect(axiosInstance.get("/bookings")).rejects.toThrow();

    // null tells the handler to tear the session down without navigating.
    expect(handler).toHaveBeenCalledWith(null);
  });

  it("ignores a 401 from the login endpoint itself", async () => {
    // Wrong password is not an expired session.
    const handler = vi.fn();
    register(handler);
    failWith(401, "/auth/login", "Invalid credentials");

    await expect(axiosInstance.post("/auth/login")).rejects.toThrow("Invalid credentials");

    expect(handler).not.toHaveBeenCalled();
  });

  it("also fires on the stale-profile 404 the API returns for a dead session", async () => {
    const handler = vi.fn();
    register(handler);
    failWith(404, "/auth/profile", "Session expired");

    await expect(axiosInstance.get("/auth/profile")).rejects.toThrow();

    expect(handler).toHaveBeenCalledWith("/dashboard/my-bookings");
  });

  it("leaves an ordinary 404 alone", async () => {
    const handler = vi.fn();
    register(handler);
    failWith(404, "/venues/nope", "Venue not found");

    await expect(axiosInstance.get("/venues/nope")).rejects.toThrow();

    expect(handler).not.toHaveBeenCalled();
  });

  it("clears the token itself when nothing is registered", async () => {
    // The SSR / pre-mount path. It must still not leave a dead token behind.
    localStorage.setItem("token", "dead");
    failWith(401, "/bookings");

    await expect(axiosInstance.get("/bookings")).rejects.toThrow();

    expect(localStorage.getItem("token")).toBeNull();
  });

  it("does not clobber a newer handler when a superseded one unregisters", async () => {
    // React can mount the new effect before the old one cleans up. Clearing
    // unconditionally would leave no handler at all, silently dropping the app
    // back to reloading the document.
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = setUnauthorizedHandler(first);
    register(second);

    offFirst();
    failWith(401, "/bookings");
    await expect(axiosInstance.get("/bookings")).rejects.toThrow();

    expect(second).toHaveBeenCalledWith("/dashboard/my-bookings");
    expect(first).not.toHaveBeenCalled();
  });
});
