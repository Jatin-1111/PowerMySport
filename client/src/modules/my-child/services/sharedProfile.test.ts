import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchSharedPlayback, fetchSharedProfile } from "./sharedProfile";

const respond = (status: number, body?: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("reading a shared profile", () => {
  it("returns the profile, asking for it uncached and without any sign-in", async () => {
    const view = { child: { name: "Anaya" } };
    fetchMock.mockResolvedValue(respond(200, { success: true, data: view }));

    const result = await fetchSharedProfile("tok_en-1");

    expect(result).toEqual({ kind: "ok", view });
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/share\/tok_en-1$/);
    expect(options.cache).toBe("no-store");
    expect(options.headers.Authorization).toBeUndefined();
    expect(options.credentials).toBeUndefined();
  });

  it("encodes the token, so it cannot add a path or a query to the request", async () => {
    fetchMock.mockResolvedValue(respond(404));
    await fetchSharedProfile("a/b?c=d");
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/share\/a%2Fb%3Fc%3Dd$/);
  });

  it("tells a link we never issued from one that is over", async () => {
    fetchMock.mockResolvedValueOnce(respond(404));
    expect(await fetchSharedProfile("x")).toEqual({ kind: "missing" });
    fetchMock.mockResolvedValueOnce(respond(410));
    expect(await fetchSharedProfile("x")).toEqual({ kind: "gone" });
  });

  it("calls anything else, including too many requests and a dropped connection, unavailable", async () => {
    fetchMock.mockResolvedValueOnce(respond(429));
    expect(await fetchSharedProfile("x")).toEqual({ kind: "unavailable" });
    fetchMock.mockResolvedValueOnce(respond(500));
    expect(await fetchSharedProfile("x")).toEqual({ kind: "unavailable" });
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchSharedProfile("x")).toEqual({ kind: "unavailable" });
    fetchMock.mockResolvedValueOnce(respond(200, { success: false }));
    expect(await fetchSharedProfile("x")).toEqual({ kind: "unavailable" });
  });
});

describe("asking to play a clip", () => {
  it("returns the short link, uncached", async () => {
    fetchMock.mockResolvedValue(
      respond(200, { success: true, data: { url: "https://s.example/p" } })
    );
    expect(await fetchSharedPlayback("tok", "vid1")).toEqual({ url: "https://s.example/p" });
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/share\/tok\/videos\/vid1\/playback$/);
    expect(options.cache).toBe("no-store");
  });

  it("fails for a clip that is not available or a link that has ended", async () => {
    fetchMock.mockResolvedValueOnce(respond(404));
    await expect(fetchSharedPlayback("tok", "v")).rejects.toThrow(/404/);
    fetchMock.mockResolvedValueOnce(respond(410));
    await expect(fetchSharedPlayback("tok", "v")).rejects.toThrow(/410/);
    fetchMock.mockResolvedValueOnce(respond(200, { success: true, data: {} }));
    await expect(fetchSharedPlayback("tok", "v")).rejects.toThrow();
  });
});
