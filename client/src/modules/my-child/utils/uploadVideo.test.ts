// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contentTypeOf, refusalFor, UploadError, uploadParts } from "./uploadVideo";

const MB = 1024 * 1024;

describe("what file is accepted", () => {
  it("takes the three types, and falls back to the extension when the phone sends no type", () => {
    expect(contentTypeOf({ name: "a.mp4", type: "video/mp4" })).toBe("video/mp4");
    expect(contentTypeOf({ name: "a.mov", type: "" })).toBe("video/quicktime");
    expect(contentTypeOf({ name: "A.MOV", type: "application/octet-stream" })).toBe(
      "video/quicktime"
    );
    expect(contentTypeOf({ name: "a.webm", type: "" })).toBe("video/webm");
  });

  it("refuses everything else, including a video type with a misleading extension", () => {
    expect(contentTypeOf({ name: "a.avi", type: "video/x-msvideo" })).toBeNull();
    expect(contentTypeOf({ name: "a.pdf", type: "application/pdf" })).toBeNull();
    expect(contentTypeOf({ name: "a.html", type: "text/html" })).toBeNull();
    expect(contentTypeOf({ name: "noextension", type: "" })).toBeNull();
  });

  it("explains a refusal in plain words, for a type, an empty file and a large one", () => {
    expect(refusalFor({ name: "a.avi", type: "", size: MB })).toMatch(/MP4, MOV or WebM/);
    expect(refusalFor({ name: "a.mp4", type: "video/mp4", size: 0 })).toMatch(/empty/);
    expect(refusalFor({ name: "a.mp4", type: "video/mp4", size: 301 * MB })).toMatch(/300 MB/);
    expect(refusalFor({ name: "a.mp4", type: "video/mp4", size: 300 * MB })).toBeNull();
  });
});

/** A stand-in for XMLHttpRequest that answers from a script, one answer per request. */
class FakeXhr {
  static script: Array<
    { status: number; etag?: string | null } | "network-error" | ((xhr: FakeXhr) => void)
  > = [];
  static sent: Array<{ url: string; size: number }> = [];
  static active = 0;
  static maxActive = 0;

  upload: { onprogress: ((event: { loaded: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  private url = "";
  private etag: string | null = null;

  open(_method: string, url: string) {
    this.url = url;
  }
  getResponseHeader() {
    return this.etag;
  }
  abort() {
    this.onabort?.();
  }
  send(body: Blob) {
    FakeXhr.sent.push({ url: this.url, size: body.size });
    FakeXhr.active += 1;
    FakeXhr.maxActive = Math.max(FakeXhr.maxActive, FakeXhr.active);
    const next = FakeXhr.script.shift() ?? { status: 200, etag: `"etag-${FakeXhr.sent.length}"` };
    queueMicrotask(() => {
      FakeXhr.active -= 1;
      if (typeof next === "function") return next(this);
      this.upload.onprogress?.({ loaded: body.size });
      if (next === "network-error") return this.onerror?.();
      this.status = next.status;
      this.etag = next.etag === undefined ? '"ok"' : next.etag;
      this.onload?.();
    });
  }
}

const plan = (sizes: number[], partBytes = 8 * MB) => ({
  videoId: "v1",
  partBytes,
  parts: sizes.map((sizeBytes, index) => ({
    partNumber: index + 1,
    sizeBytes,
    url: `https://storage.example/part/${index + 1}`,
  })),
});

const fileOf = (size: number) => new Blob([new Uint8Array(size)]);

describe("sending the parts", () => {
  beforeEach(() => {
    FakeXhr.script = [];
    FakeXhr.sent = [];
    FakeXhr.active = 0;
    FakeXhr.maxActive = 0;
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
  });
  afterEach(() => vi.unstubAllGlobals());

  const run = (over: Partial<Parameters<typeof uploadParts>[0]> = {}) => {
    const p = plan([8 * MB, 8 * MB, 4 * MB]);
    return uploadParts({
      file: fileOf(20 * MB),
      plan: p,
      signal: new AbortController().signal,
      onProgress: () => undefined,
      retryDelayMs: 0,
      ...over,
    });
  };

  it("sends each part to its own link, the size the server named, and returns the ETags in order", async () => {
    const parts = await run();
    expect(FakeXhr.sent.map((s) => s.size).sort()).toEqual([4 * MB, 8 * MB, 8 * MB]);
    expect(FakeXhr.sent.map((s) => s.url).sort()).toEqual([
      "https://storage.example/part/1",
      "https://storage.example/part/2",
      "https://storage.example/part/3",
    ]);
    expect(parts.map((p) => p.partNumber)).toEqual([1, 2, 3]);
    expect(new Set(parts.map((p) => p.etag)).size).toBe(3);
  });

  it("sends only a few at a time", async () => {
    await run({ concurrency: 2 });
    expect(FakeXhr.maxActive).toBeLessThanOrEqual(2);
  });

  it("reports whole-number progress that ends at 100", async () => {
    const seen: number[] = [];
    await run({ onProgress: (percent) => seen.push(percent) });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((p) => Number.isInteger(p) && p >= 0 && p <= 100)).toBe(true);
    expect(seen.at(-1)).toBe(100);
  });

  it("tries a part again after a dropped connection, and the clip still arrives", async () => {
    FakeXhr.script = ["network-error", { status: 500 }];
    const parts = await run({ concurrency: 1 });
    expect(parts).toHaveLength(3);
    expect(FakeXhr.sent.length).toBe(5); // two failed tries of part 1, then 1, 2, 3 in turn
  });

  it("gives up on a part after the attempts are used, and says the connection was the problem", async () => {
    FakeXhr.script = ["network-error", "network-error", "network-error"];
    await expect(run({ concurrency: 1, maxAttempts: 3 })).rejects.toThrow(/connection dropped/);
  });

  it("does not retry an expired link, because a second try cannot work", async () => {
    FakeXhr.script = [{ status: 403 }];
    await expect(run({ concurrency: 1 })).rejects.toThrow(/expired/);
    expect(FakeXhr.sent.length).toBe(1);
  });

  it("explains when storage will not show the ETag, which is a setup problem and not worth retrying", async () => {
    FakeXhr.script = [{ status: 200, etag: null }];
    const error = await run({ concurrency: 1 }).catch((e) => e);
    expect(error).toBeInstanceOf(UploadError);
    expect(error.message).toMatch(/not set up/);
    expect(FakeXhr.sent.length).toBe(1);
  });

  it("stops when cancelled, without trying again", async () => {
    const abort = new AbortController();
    FakeXhr.script = [(xhr) => xhr.abort()];
    const attempt = run({ concurrency: 1, signal: abort.signal });
    abort.abort();
    await expect(attempt).rejects.toThrow(/cancelled/);
  });
});
