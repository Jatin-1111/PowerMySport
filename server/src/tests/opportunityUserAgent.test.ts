// What the server says it is when it reads a link. Admissions and scholarships
// reads identify themselves; the tournament readers keep the browser-shaped agent
// some federation sites require. A regression in either direction is silent, so
// the header actually sent is checked here.
import assert = require("node:assert/strict");
const { afterEach, describe, it } = require("node:test");

const {
  READER_USER_AGENT,
  fetchPageForReading,
  fetchPageHtml,
  fetchPdfFromUrl,
} = require("../admin/services/dataSourceExtraction/http");

// A public address literal, so the safety check needs no DNS lookup.
const URL_OK = "http://93.184.216.34/page";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Replaces fetch with one that records the User-Agent and answers with `response`. */
const capture = (response: () => Response) => {
  const seen: string[] = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    seen.push(String((init?.headers as Record<string, string>)?.["User-Agent"]));
    return response();
  }) as typeof fetch;
  return seen;
};

const html = () =>
  new Response("<html><body><p>Hello</p></body></html>", {
    headers: { "content-type": "text/html" },
  });

describe("User-Agent", () => {
  it("says who is asking when an admissions or scholarships page is read", async () => {
    const seen = capture(html);
    const page = await fetchPageForReading(URL_OK, { identify: true });
    assert.ok(page, "the page should have been read");
    assert.deepEqual(seen, [READER_USER_AGENT]);
    assert.match(READER_USER_AGENT, /PowerMySportSourceReader/);
    assert.doesNotMatch(READER_USER_AGENT, /Chrome|Safari|Windows NT/);
  });

  it("says who is asking when a PDF is downloaded", async () => {
    const seen = capture(
      () => new Response("%PDF-1.4", { headers: { "content-type": "application/pdf" } })
    );
    const pdf = await fetchPdfFromUrl(URL_OK);
    assert.ok(pdf && "buffer" in pdf, "the PDF should have been downloaded");
    assert.deepEqual(seen, [READER_USER_AGENT]);
  });

  it("keeps the browser-shaped agent for the tournament readers", async () => {
    const seen = capture(html);
    await fetchPageForReading(URL_OK);
    await fetchPageHtml(URL_OK);
    assert.equal(seen.length, 2);
    for (const agent of seen) assert.match(agent, /Chrome/);
  });
});
