import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendContactRequest, sharedCvUrl } from "./sharedProfile";

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

describe("the CV address", () => {
  it("is the file for this link, with the token encoded", () => {
    expect(sharedCvUrl("tok_en-1")).toMatch(/\/share\/tok_en-1\/cv\.pdf$/);
    expect(sharedCvUrl("a/b?c")).toMatch(/\/share\/a%2Fb%3Fc\/cv\.pdf$/);
  });
});

describe("asking the family to get in touch", () => {
  const input = { name: "Coach Miller", email: "miller@university.edu", message: "Hello" };

  it("posts what was typed as JSON, uncached and with no sign-in", async () => {
    fetchMock.mockResolvedValue(respond(201, { success: true, data: { sent: true } }));
    expect(await sendContactRequest("tok", input)).toEqual({ ok: true });

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/share\/tok\/contact$/);
    expect(options.method).toBe("POST");
    expect(options.cache).toBe("no-store");
    expect(JSON.parse(options.body)).toEqual(input);
    expect(options.headers.Authorization).toBeUndefined();
  });

  it("returns the server's reason when it is refused", async () => {
    fetchMock.mockResolvedValueOnce(
      respond(429, { success: false, message: "Too many requests." })
    );
    expect(await sendContactRequest("tok", input)).toEqual({
      ok: false,
      message: "Too many requests.",
    });
  });

  it("prefers the first validation problem, which reads best on its own", async () => {
    fetchMock.mockResolvedValueOnce(
      respond(400, {
        success: false,
        message: "Validation failed",
        errors: [{ message: "That email address does not look right" }],
      })
    );
    expect(await sendContactRequest("tok", input)).toEqual({
      ok: false,
      message: "That email address does not look right",
    });
  });

  it("falls back to a plain message for a dropped connection or a reply it cannot read", async () => {
    const plain = { ok: false, message: "Your request could not be sent. Please try again." };
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await sendContactRequest("tok", input)).toEqual(plain);

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);
    expect(await sendContactRequest("tok", input)).toEqual(plain);
  });
});
