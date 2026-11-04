// Unit tests for the weekly source watch: robots.txt, how one fetch is
// classified, and how it is compared with last week. No network, no database.

// The watch service imports AdminService, which needs a JWT secret at load time.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  classifyResponse,
  documentLinks,
  evaluate,
  normaliseText,
  robotsAllows,
} = require("../admin/services/opportunityWatch");

const page = (words: number, extra = "") =>
  Buffer.from(`<html><body><main>${"word ".repeat(words)}${extra}</main></body></html>`);

describe("robotsAllows", () => {
  it("honours Disallow for every agent", () => {
    const robots = "User-agent: *\nDisallow: /private/\n";
    assert.equal(robotsAllows(robots, "/private/circular.pdf"), false);
    assert.equal(robotsAllows(robots, "/public/circular.pdf"), true);
  });

  it("ignores rules for other agents", () => {
    const robots = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow:\n";
    assert.equal(robotsAllows(robots, "/anything"), true);
  });

  it("lets the longer Allow win over a shorter Disallow", () => {
    const robots = "User-agent: *\nDisallow: /docs/\nAllow: /docs/scholarship/\n";
    assert.equal(robotsAllows(robots, "/docs/scholarship/2026.pdf"), true);
    assert.equal(robotsAllows(robots, "/docs/other.pdf"), false);
  });
});

describe("classifyResponse", () => {
  const base = {
    requestedUrl: "https://example.test/page",
    finalUrl: "https://example.test/page",
    contentType: "text/html",
    body: page(400),
  };

  it("calls a 404 gone and a 403 blocked", () => {
    assert.equal(classifyResponse({ ...base, httpStatus: 404 }).status, "gone");
    assert.equal(classifyResponse({ ...base, httpStatus: 403 }).status, "blocked");
  });

  it("calls a file link that now answers with a page moved", () => {
    const result = classifyResponse({
      ...base,
      requestedUrl: "https://example.test/uploads/guidelines.pdf",
      httpStatus: 200,
    });
    assert.equal(result.status, "moved");
  });

  it("fingerprints a PDF by its bytes", () => {
    const result = classifyResponse({
      ...base,
      requestedUrl: "https://example.test/a.pdf",
      contentType: "application/pdf",
      body: Buffer.from("%PDF-1.7 bytes"),
      httpStatus: 200,
    });
    assert.equal(result.status, "ok");
    assert.equal(result.kind, "pdf");
    assert.match(result.fingerprint, /^[0-9a-f]{64}$/);
  });

  it("calls an almost empty page blocked, not unchanged", () => {
    const result = classifyResponse({
      ...base,
      body: Buffer.from("<html></html>"),
      httpStatus: 200,
    });
    assert.equal(result.status, "blocked");
  });

  it("reads a normal page, counting the documents it links to", () => {
    const result = classifyResponse({
      ...base,
      body: page(400, '<a href="/files/2026.pdf">2026</a><a href="notes.docx">notes</a>'),
      httpStatus: 200,
    });
    assert.equal(result.status, "ok");
    assert.equal(result.documentLinkCount, 2);
  });
});

describe("normaliseText and documentLinks", () => {
  it("ignores visitor counters and last-updated stamps", () => {
    assert.equal(
      normaliseText("Scholarship rules\nVisitors: 12345\nLast updated: 27/09/2026"),
      normaliseText("Scholarship rules\nVisitors: 99999\nLast updated: 04/10/2026")
    );
  });

  it("keeps a changed date in the rules themselves", () => {
    assert.notEqual(normaliseText("Trial on 30 July"), normaliseText("Trial on 28 July"));
  });

  it("resolves document links against the page", () => {
    assert.deepEqual(
      documentLinks(
        '<a href="/a.pdf">x</a><a href="https://other.test/b.pdf">y</a>',
        "https://site.test/p/"
      ),
      ["https://other.test/b.pdf", "https://site.test/a.pdf"]
    );
  });
});

describe("evaluate", () => {
  const ok = (fingerprint: string, linkFingerprint = "L1", kind = "html") => ({
    status: "ok",
    kind,
    fingerprint,
    linkFingerprint,
  });

  it("records the first readable fetch as a baseline, not a change", () => {
    const result = evaluate(null, ok("A"));
    assert.equal(result.baseline, true);
    assert.equal(result.changed, false);
  });

  it("reports new documents before a text change", () => {
    const previous = { status: "ok", fingerprint: "A", linkFingerprint: "L1" };
    assert.equal(evaluate(previous, ok("B", "L2")).changeKind, "documents");
    assert.equal(evaluate(previous, ok("B", "L1")).changeKind, "text");
    assert.equal(evaluate(previous, ok("A", "L1")).changed, false);
  });

  it("never reads a failed fetch as unchanged", () => {
    const previous = { status: "ok", fingerprint: "A", linkFingerprint: "L1" };
    const result = evaluate(previous, { status: "blocked" });
    assert.equal(result.changed, false);
    assert.equal(result.statusChanged, true);
  });
});
