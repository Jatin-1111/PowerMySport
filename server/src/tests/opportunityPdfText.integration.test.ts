// Tests for reading a PDF's text layer (dataSourceExtraction/pdfText.ts) and for
// checking a model's quotes against it (quoteCheck.ts, "pdf" kind).
//
// The PDFs are generated with pdfkit, so these run on real PDF files, including a
// table drawn column by column, which is how the real Delhi University schedule
// reads once its text is pulled out: column after column, not row by row.
//
// Pinned: text comes out of a real PDF; anything that cannot yield text (corrupt,
// empty, a scan, too slow) yields null and never an error; the parsing happens off
// the server's own thread; a table row whose words are all in the PDF is
// "scattered", not "missing", while a quote with a number the PDF does not have is
// "unmatched"; and a PDF's verdicts never replace the stricter ones for web pages.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
// Reading goes through the real extraction in some tests below; with a key in the
// environment that would call Gemini. The model itself is always replaced.
process.env.GEMINI_API_KEY = "";
process.env.GOOGLE_API_KEY = "";

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const PDFDocument = require("pdfkit");

const { extractPdfText } = require("../admin/services/dataSourceExtraction/pdfText");
const {
  checkExtraction,
  checkQuoteAgainstPage,
  checkQuoteAgainstPdf,
  indexPage,
  normaliseForMatch,
} = require("../admin/services/dataSourceExtraction/quoteCheck");
const { mergeExtractions } = require("../admin/services/dataSourceExtraction/multiDocument");
const {
  extractOpportunityForSubmission,
} = require("../admin/services/dataSourceExtraction/opportunity");

/** A PDF with whatever `draw` puts on it. */
const makePdf = (draw: (doc: InstanceType<typeof PDFDocument>) => void): Promise<Buffer> =>
  new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    draw(doc);
    doc.end();
  });

const PROSE =
  "Candidates must be below 25 years of age as on 1 July 2026. The scholarship is worth Rs. 6,28,000 per annum. Registration opens on 3 August 2026 and closes on 20 August 2026.";

/** A schedule drawn the way the real one reads out: all of column one, then all of column two... */
const scheduleByColumn = () =>
  makePdf((doc) => {
    doc
      .fontSize(12)
      .text(
        "SCHEDULE OF SPORTS TRIAL FOR SPORTS SUPERNUMERARY QUOTA ADMISSION IN UG PROGRAMMES 2026",
        50,
        40
      );
    doc
      .fontSize(9)
      .text(
        "Candidates must report to the venue with their original sports certificates and a valid photo identity card. Reporting time is strictly as listed below.",
        50,
        70,
        { width: 480 }
      );
    const rows = [
      ["Archery", "29th July 2026", "09:00 AM"],
      ["Tennis", "30th July 2026", "08:30 AM"],
      ["Squash", "30th July 2026", "09:00 AM"],
      ["Boxing", "29th July 2026", "08:30 AM"],
      ["Cricket", "29th July 2026", "09:00 AM"],
      ["Hockey", "30th July 2026", "08:30 AM"],
      ["Netball", "29th July 2026", "09:00 AM"],
      ["Handball", "30th July 2026", "09:00 AM"],
      ["Football", "29th July 2026", "08:30 AM"],
      ["Kabaddi", "30th July 2026", "08:30 AM"],
      ["Shooting", "29th July 2026", "09:00 AM"],
      ["Volleyball", "30th July 2026", "09:00 AM"],
    ];
    for (let column = 0; column < 3; column += 1) {
      rows.forEach((row, i) => doc.fontSize(11).text(row[column], 50 + column * 180, 130 + i * 24));
    }
  });

describe("extractPdfText", () => {
  it("reads the text of a real PDF, page by page", async () => {
    const pdf = await makePdf((doc) => {
      doc.text(PROSE);
      doc.addPage().text("Page two: trials are held on 5th September at the stadium. ".repeat(4));
    });
    const result = await extractPdfText(pdf);

    assert.ok(result);
    assert.equal(result.pages, 2);
    assert.equal(result.pagesRead, 2);
    assert.match(result.text, /below 25 years of age as on 1 July 2026/);
    assert.match(result.text, /5th September at the stadium/);
  });

  it("stops at the page cap and says how many pages it read", async () => {
    const pdf = await makePdf((doc) => {
      for (let i = 1; i <= 12; i += 1) {
        doc.text(`Marker${i} ${"filler text for the page ".repeat(12)}`);
        if (i < 12) doc.addPage();
      }
    });
    const result = await extractPdfText(pdf, { maxPages: 3 });

    assert.ok(result);
    assert.equal(result.pagesRead, 3);
    assert.ok(result.pages >= 12);
    assert.match(result.text, /Marker3/);
    assert.doesNotMatch(result.text, /Marker4/);
  });

  it("gives null, not an error, for anything that has no usable text", async () => {
    const scan = await makePdf((doc) => {
      doc.rect(50, 50, 400, 400).stroke();
      doc.circle(200, 200, 80).fill("black");
    });
    const cases: Array<[string, Buffer]> = [
      ["corrupt bytes", Buffer.from("%PDF-1.4 this is not really a pdf ".repeat(50))],
      ["an empty file", Buffer.alloc(0)],
      ["a page of shapes and no text, like a scan", scan],
      ["plain text that is not a PDF", Buffer.from("hello ".repeat(500))],
    ];
    for (const [label, buffer] of cases) {
      assert.equal(await extractPdfText(buffer), null, label);
    }
  });

  it("gives up on one that takes too long, and returns at once when it does", async () => {
    const pdf = await makePdf((doc) => {
      for (let i = 0; i < 20; i += 1) {
        doc.text("Lorem ipsum dolor sit amet. ".repeat(60));
        doc.addPage();
      }
    });
    const started = Date.now();
    assert.equal(await extractPdfText(pdf, { timeoutMs: 1 }), null);
    assert.ok(Date.now() - started < 1000, "a timeout does not wait for the parse");
  });

  it("parses off the server's own thread, so a slow PDF does not stall everything else", async () => {
    const pdf = await makePdf((doc) => {
      for (let i = 0; i < 15; i += 1) {
        doc.text("Sports quota admission schedule. ".repeat(60));
        doc.addPage();
      }
    });
    let done = false;
    const extraction = extractPdfText(pdf).then((r: unknown) => {
      done = true;
      return r;
    });
    // The worker takes well over this to start and parse; a timer on the main thread
    // must still fire while it runs.
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(done, false, "the extraction was still running when the timer fired");
    assert.ok(await extraction);
  });

  it("reads a table out column by column, which is why a PDF's verdicts are weaker", async () => {
    const result = await extractPdfText(await scheduleByColumn());

    assert.ok(result);
    assert.match(
      result.text,
      /Archery[\s\S]*Tennis[\s\S]*Squash[\s\S]*Boxing[\s\S]*29th July 2026/
    );
    assert.doesNotMatch(
      normaliseForMatch(result.text),
      /tennis 30th july 2026 08 30 am/,
      "a row is not contiguous in the text"
    );
  });
});

describe("a quote against a PDF's text", () => {
  const prose = indexPage(normaliseForMatch(PROSE));

  it("finds a quote that is really there, as for a web page", () => {
    assert.equal(checkQuoteAgainstPdf("worth Rs. 6,28,000 per annum", prose), "found");
    assert.equal(checkQuoteAgainstPdf("below 25 years of age as on 1 July 2026", prose), "found");
  });

  it("calls a table row scattered when every number and word is in the PDF, only out of order", async () => {
    const text = (await extractPdfText(await scheduleByColumn()))!.text;
    const table = indexPage(normaliseForMatch(text));
    // Each cell of a row is whole in the text but the cells are far apart, so a quote
    // that strings them together has no run of three words anywhere.
    const row = "Tennis 30th July 08:30";

    assert.equal(checkQuoteAgainstPdf(row, table), "scattered");
    assert.equal(
      checkQuoteAgainstPage(row, table),
      "missing",
      "the same words against a web page are not found: that text is in reading order"
    );
  });

  it("calls a whole table row partial or scattered, never unmatched, when the PDF has all of it", async () => {
    const text = (await extractPdfText(await scheduleByColumn()))!.text;
    const table = indexPage(normaliseForMatch(text));
    // Its cells ("30th July 2026", "08:30 AM") are each whole in the text.
    const verdict = checkQuoteAgainstPdf("Tennis 30th July 2026 08:30 AM", table);
    assert.ok(["partial", "scattered"].includes(verdict), verdict);
  });

  it("calls a quote unmatched when a number in it is not in the PDF at all", async () => {
    const text = (await extractPdfText(await scheduleByColumn()))!.text;
    const table = indexPage(normaliseForMatch(text));

    // Right sport, right month, but 31st and 10:30 are nowhere in the schedule.
    assert.equal(checkQuoteAgainstPdf("Tennis 31st July 2026 10:30 AM", table), "unmatched");
  });

  it("calls a quote unmatched when most of its content words are not in the PDF", () => {
    assert.equal(
      checkQuoteAgainstPdf("Every applicant receives a fully funded scholarship abroad", prose),
      "unmatched"
    );
  });

  it("does not call a quote of only short, common words scattered", () => {
    assert.equal(checkQuoteAgainstPdf("of the on a to be", prose), "unmatched");
  });

  it("calls a quote with one garbled word partial, since the rest of it still matches in runs", () => {
    const text = indexPage(
      normaliseForMatch(
        "Candidates admitted under the supernumerary quota receive a seat outside the merit list in 2026"
      )
    );
    // "supernumerary" is split across a line in the PDF ("super-" / "numerary").
    assert.equal(
      checkQuoteAgainstPdf(
        "Candidates admitted under the supernumerry quota receive a seat outside the merit list in 2026",
        text
      ),
      "partial"
    );
  });

  it("lets one content word of a scrambled quote be missing, but not two", () => {
    // A table pulled apart: the words are all there, in no useful order.
    const scrambled = indexPage(
      normaliseForMatch("julia hotels golfer alpha india foxtrot bravo echoes charlie delta")
    );
    const ordered = "alpha bravo charlie delta echoes foxtrot golfer hotels india julia";
    assert.equal(checkQuoteAgainstPdf(ordered, scrambled), "scattered");
    assert.equal(checkQuoteAgainstPdf(ordered + " kilos", scrambled), "scattered", "10 of 11");
    assert.equal(
      checkQuoteAgainstPdf(ordered + " kilos lemons", scrambled),
      "unmatched",
      "10 of 12"
    );
  });

  it("is only ever reached for a PDF: a page's verdicts are unchanged", () => {
    assert.equal(
      checkQuoteAgainstPage("invented sentence about nothing relevant here", prose),
      "missing"
    );
    assert.equal(
      checkQuoteAgainstPdf("invented sentence about nothing relevant here", prose),
      "unmatched"
    );
  });
});

describe("checkExtraction for a PDF", () => {
  const fields = { eligibility: { ageMax: 25 } };
  const citations = {
    eligibility: "below 25 years of age",
    summary: "Every athlete wins a gold medal",
  };

  it("names the PDF's text as what it compared with, and uses the PDF verdicts", () => {
    const checks = checkExtraction(fields, citations, PROSE, "pdf");
    assert.equal(checks.against, "pdf-text");
    assert.equal(checks.quotes.eligibility, "found");
    assert.equal(checks.quotes.summary, "unmatched");
    assert.equal(checks.figures["eligibility.ageMax"], "ok");
  });

  it("says nothing about quotes for a PDF with no text, but still checks its figures", () => {
    const checks = checkExtraction(fields, citations, null, "pdf");
    assert.equal(checks.against, "none");
    assert.deepEqual(checks.quotes, {});
    assert.equal(checks.figures["eligibility.ageMax"], "ok");
  });

  it("defaults to a web page, as before", () => {
    assert.equal(checkExtraction(fields, citations, PROSE).against, "page-text");
    assert.equal(checkExtraction(fields, citations, PROSE).quotes.summary, "missing");
  });
});

describe("merging checks from a page and a PDF", () => {
  const source = (kind: "page" | "document", checks: Record<string, unknown>, over = {}) => ({
    url: `https://site.test/${kind}`,
    label: kind,
    kind,
    fields: { summary: "S", eligibility: { ageMax: 25 } },
    citations: { summary: "q", eligibility: "q" },
    warnings: [],
    checks: { against: "none", quotes: {}, figures: {}, shared: {}, ...checks },
    ...over,
  });

  it("names the page's text when a page supplied a quote, even if a PDF supplied another", () => {
    const merged = mergeExtractions([
      source(
        "document",
        { against: "pdf-text", quotes: { eligibility: "scattered" } },
        { fields: { eligibility: { ageMax: 25 } } }
      ),
      source(
        "page",
        { against: "page-text", quotes: { summary: "found" } },
        { fields: { summary: "S" } }
      ),
    ]);
    assert.equal(merged.checks.against, "page-text");
    assert.equal(merged.checks.quotes.eligibility, "scattered");
    assert.equal(merged.checks.quotes.summary, "found");
  });

  it("names the PDF's text when only PDFs supplied quotes", () => {
    const merged = mergeExtractions([
      source(
        "document",
        { against: "pdf-text", quotes: { eligibility: "found" } },
        { fields: { eligibility: { ageMax: 25 } } }
      ),
    ]);
    assert.equal(merged.checks.against, "pdf-text");
  });
});

describe("reading a PDF end to end, with the model replaced", () => {
  const submission = (url: string) => ({
    sourceKind: "LINK",
    sourceUrl: url,
    sourceLabel: "Circular",
    opportunityTrack: "admission",
  });
  const MODEL_JSON = {
    title: "Delhi University sports quota",
    category: "college",
    eligibility: { ageMax: 25 },
    benefit: { summary: "A seat.", amount: { value: 628000, currency: "INR", period: "year" } },
    cycle: { opensOn: "2026-08-03", closesOn: "2026-08-20" },
    _citations: {
      eligibility: "below 25 years of age as on 1 July 2026",
      benefit: "worth Rs. 6,28,000 per annum",
      cycle: "Registration opens on 3 August 2026 and closes on 22 August 2026",
    },
  };
  const options = (pdf: Buffer, over: Record<string, unknown> = {}) => ({
    client: {} as never,
    fetchPdf: async () => ({ buffer: pdf, finalUrl: "https://site.test/circular.pdf" }),
    call: async () => ({ data: MODEL_JSON, model: "fake" }),
    ...over,
  });

  it("checks the model's quotes against the PDF's real text, using the real reader", async () => {
    const pdf = await makePdf((doc) => doc.text(PROSE.repeat(2)));
    const result = await extractOpportunityForSubmission(
      submission("https://site.test/circular.pdf"),
      undefined,
      options(pdf)
    );

    assert.equal(result.status, "PENDING_REVIEW");
    assert.equal(result.citationChecks.against, "pdf-text");
    assert.equal(result.citationChecks.quotes.eligibility, "found");
    assert.equal(result.citationChecks.quotes.benefit, "found");
    // The model gave the wrong closing date (22 August); the PDF says 20.
    assert.equal(result.citationChecks.figures["cycle.closesOn"], "mismatch");
    assert.notEqual(result.citationChecks.quotes.cycle, "found");
  });

  it("still reads a PDF with no text layer, and says its quotes were not checked", async () => {
    const scan = await makePdf((doc) => doc.rect(50, 50, 300, 300).stroke());
    const result = await extractOpportunityForSubmission(
      submission("https://site.test/scan.pdf"),
      undefined,
      options(scan)
    );

    assert.equal(result.status, "PENDING_REVIEW");
    assert.equal(result.citationChecks.against, "none");
    assert.deepEqual(result.citationChecks.quotes, {});
  });

  it("uses a PDF's own text for the documents a page links to", async () => {
    const guidelines = await makePdf((doc) => doc.text(PROSE.repeat(2)));
    const result = await extractOpportunityForSubmission(
      { ...submission("https://site.test/admissions"), followDocuments: true },
      undefined,
      {
        client: {} as never,
        fetchPage: async () => ({
          text: "Delhi University sports quota admission 2026. ".repeat(10),
          html: `<main><a href="/files/sports-quota-guidelines-2026.pdf">Sports quota guidelines 2026</a></main>`,
          finalUrl: "https://site.test/admissions",
        }),
        fetchPdf: async (url: string) =>
          url.endsWith("admissions") ? null : { buffer: guidelines, finalUrl: url },
        call: async (_c: unknown, contents: unknown) =>
          typeof contents === "string"
            ? {
                data: { title: "Delhi University sports quota", category: "college" },
                model: "fake",
              }
            : { data: MODEL_JSON, model: "fake" },
        browse: async () => ({ data: null, error: "none" }),
      }
    );

    assert.equal(result.status, "PENDING_REVIEW");
    assert.equal(
      result.citationChecks.quotes.eligibility,
      "found",
      "checked against the PDF's text"
    );
    assert.equal(result.citationChecks.against, "pdf-text");
  });
});
