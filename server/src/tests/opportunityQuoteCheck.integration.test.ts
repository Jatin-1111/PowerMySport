// Tests for the quote and figure checks made when a source is read
// (dataSourceExtraction/quoteCheck.ts), and for how they reach the review screen.
//
// Two things are pinned together because they pull in opposite directions. A
// quote that differs from its page only in case, punctuation, spacing, a
// thousands separator or an elided middle must NOT be rejected, or reviewers
// learn to ignore the flag. A quote that was invented, or a figure that is not
// in its own quote, MUST be caught, or the flag is worth nothing.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const Admin = require("../admin/models/Admin").default;
const { Opportunity } = require("../shared/models/Opportunity");
const { DataSourceSubmission } = require("../shared/models/DataSourceSubmission");
const {
  checkExtraction,
  checkFigures,
  checkQuoteAgainstPage,
  normaliseForMatch,
  sharedQuotes,
} = require("../admin/services/dataSourceExtraction/quoteCheck");
const { proposedChanges } = require("../admin/services/opportunitySourceMerge");
const { generateToken } = require("../utils/jwt");
const redis = require("../config/redis").default;

const page = (text: string) => ` ${normaliseForMatch(text)} `;

const PAGE = `
  Delhi University Sports Quota 2026-27.
  Candidates must be below 25 years of age as on 1 July 2026. The scholarship is
  worth ₹6.28 lakh per annum, paid in two instalments of Rs. 3,14,000 each.
  Registration opens on 3 August 2026 and closes on 20.08.2026. Trials will be held
  on 5th September at the Major Dhyan Chand stadium for athletes who hold a
  national-level medal in the last four years.
`;

describe("normaliseForMatch", () => {
  it("ignores case, punctuation and spacing", () => {
    assert.equal(
      normaliseForMatch("  Under-14   PLAYERS, only!  "),
      normaliseForMatch("under 14 players only")
    );
  });

  it("reads thousands separators as one number, Indian grouping included", () => {
    assert.equal(normaliseForMatch("Rs. 50,000"), "rs 50000");
    assert.equal(normaliseForMatch("₹1,00,000"), "100000");
  });

  it("keeps a decimal point between digits and drops a full stop between words", () => {
    assert.equal(normaliseForMatch("₹6.28 lakh. Next"), "6.28 lakh next");
  });
});

describe("checkQuoteAgainstPage", () => {
  const hay = page(PAGE);

  it("finds a quote that differs only in case, punctuation and spacing", () => {
    assert.equal(
      checkQuoteAgainstPage("REGISTRATION OPENS on 3 August 2026, and closes on 20.08.2026", hay),
      "found"
    );
  });

  it("finds a quote across a thousands separator", () => {
    assert.equal(
      checkQuoteAgainstPage("two instalments of Rs. 314000 each", hay),
      "found",
      "3,14,000 on the page is 314000 in the quote"
    );
  });

  it("finds a quote whose middle the model elided, however it marked it", () => {
    for (const marker of ["...", "…", "[...]"]) {
      assert.equal(
        checkQuoteAgainstPage(
          `Candidates must be below 25 years ${marker} worth ₹6.28 lakh per annum`,
          hay
        ),
        "found",
        `elision written as ${marker}`
      );
    }
  });

  it("calls a long quote with one changed word partly found", () => {
    assert.equal(
      checkQuoteAgainstPage(
        "Trials will be held on 5th September at the Major Dhyan Chand stadium for players who hold a national-level medal",
        hay
      ),
      "partial"
    );
  });

  it("calls an invented quote missing", () => {
    assert.equal(
      checkQuoteAgainstPage("Every applicant receives a full scholarship of ₹10 lakh a year", hay),
      "missing"
    );
  });

  it("does not let a paraphrase pass as a quote", () => {
    assert.equal(
      checkQuoteAgainstPage("Athletes under twenty-five can apply for the quota", hay),
      "missing"
    );
  });

  it("does not call a short quote partly found, because a short match is a coincidence", () => {
    assert.equal(checkQuoteAgainstPage("sports quota for girls", hay), "missing");
  });

  it("finds a very short quote that is really there, and misses one that is not", () => {
    assert.equal(checkQuoteAgainstPage("national-level medal", hay), "found");
    assert.equal(checkQuoteAgainstPage("world championship", hay), "missing");
  });

  it("treats an empty quote as missing", () => {
    assert.equal(checkQuoteAgainstPage("   ", hay), "missing");
    assert.equal(checkQuoteAgainstPage("...", hay), "missing");
  });
});

describe("checkFigures", () => {
  const figures = (fields: Record<string, unknown>, citations: Record<string, string>) =>
    checkFigures(fields, citations);

  it("accepts an age written as digits, as words, or inside 'under-14'", () => {
    for (const quote of [
      "Under-14 players",
      "players aged 14",
      "fourteen years",
      "14th birthday",
    ]) {
      assert.equal(
        figures({ eligibility: { ageMin: 14 } }, { eligibility: quote })["eligibility.ageMin"],
        quote === "14th birthday" ? "mismatch" : "ok",
        quote
      );
    }
  });

  it("flags an age that is not in its quote", () => {
    const out = figures(
      { eligibility: { ageMin: 12, ageMax: 17 } },
      { eligibility: "Under-14 and under-16 categories" }
    );
    assert.equal(out["eligibility.ageMin"], "mismatch");
    assert.equal(out["eligibility.ageMax"], "mismatch");
  });

  it("matches an amount the model converted: lakh, crore, thousands, or plain", () => {
    const amount = (value: number, quote: string) =>
      figures(
        { benefit: { amount: { value, currency: "INR", period: "year" } } },
        { benefit: quote }
      )["benefit.amount"];
    assert.equal(amount(628000, "family income up to ₹6.28 lakh per annum"), "ok");
    assert.equal(amount(628000, "Rs 6,28,000"), "ok");
    assert.equal(amount(50000, "a grant of Rs. 50,000 a year"), "ok");
    assert.equal(amount(50000, "a grant of 50k"), "ok");
    assert.equal(amount(25000000, "an outlay of ₹2.5 crore"), "ok");
  });

  it("flags an amount that is not in its quote", () => {
    const out = figures(
      { benefit: { amount: { value: 100000, currency: "INR", period: "year" } } },
      { benefit: "A grant of Rs. 50,000 a year" }
    );
    assert.equal(out["benefit.amount"], "mismatch");
  });

  it("matches dates written as words or numbers, with or without the year", () => {
    const opens = (iso: string, quote: string) =>
      figures({ cycle: { opensOn: iso } }, { cycle: quote })["cycle.opensOn"];
    assert.equal(opens("2026-08-03", "opens on 3 August 2026"), "ok");
    assert.equal(opens("2026-08-03", "opens 3rd Aug"), "ok");
    assert.equal(opens("2026-08-03", "opens 03.08.2026"), "ok");
    assert.equal(opens("2026-09-05", "5th Sept trials"), "ok");
    assert.equal(opens("2026-08-03", "opens on 4 August 2026"), "mismatch");
    assert.equal(opens("2026-08-03", "opens in the autumn"), "mismatch");
  });

  it("needs every key date in the quote", () => {
    const keyDates = (dates: string[], quote: string) =>
      figures(
        { cycle: { keyDates: dates.map((date) => ({ label: "x", date })) } },
        { cycle: quote }
      )["cycle.keyDates"];
    assert.equal(
      keyDates(["2026-09-05", "2026-09-12"], "Trials on 5 September and 12 September"),
      "ok"
    );
    assert.equal(keyDates(["2026-09-05", "2026-09-12"], "Trials on 5 September"), "mismatch");
  });

  it("says nothing about a field that has no quote, or text fields", () => {
    assert.deepEqual(figures({ eligibility: { ageMin: 14 } }, {}), {});
    assert.deepEqual(
      figures({ summary: "Extra seats" }, { summary: "Extra seats for athletes" }),
      {}
    );
  });
});

describe("sharedQuotes", () => {
  // The quotes the model really gave for India Khelo Football, which is the case
  // this exists for: one sentence offered as proof of three unrelated fields.
  const IKF = {
    benefit: "IKF is a neutral platform that connects all dots of the football ecosystem.",
    category: "IKF is a neutral platform that connects all dots of the football ecosystem.",
    summary: "IKF is a neutral platform that connects all dots of the football ecosystem.",
    eligibility: "IKF remains committed to transparency, fairness, and creating a safe pathway.",
    sports: "IKF remains committed to transparency, fairness, and creating a safe pathway.",
    keyFacts: "Players pay a single registration fee of ₹125 (inclusive of GST).",
    selection: "Players pay a single registration fee of ₹125 (inclusive of GST).",
    title: "India Khelo Football (IKF)",
  };

  it("flags one quote offered for three or more fields, and says how many", () => {
    assert.deepEqual(sharedQuotes(IKF), { benefit: 3, category: 3, summary: 3 });
  });

  it("leaves a quote shared by only two fields alone, which is often legitimate", () => {
    const shared = sharedQuotes(IKF);
    for (const field of ["eligibility", "sports", "keyFacts", "selection", "title"]) {
      assert.equal(shared[field], undefined, field);
    }
  });

  it("treats quotes that differ only in case and punctuation as the same quote", () => {
    assert.deepEqual(
      sharedQuotes({
        a: "The scholarship lasts 2 years.",
        b: "the scholarship lasts 2 years",
        c: "THE SCHOLARSHIP LASTS 2 YEARS!",
      }),
      { a: 3, b: 3, c: 3 }
    );
  });

  it("is reported whether or not there was page text to check quotes against", () => {
    assert.deepEqual(checkExtraction({}, IKF, null).shared, {
      benefit: 3,
      category: 3,
      summary: 3,
    });
    assert.deepEqual(checkExtraction({}, IKF, "page text").shared, {
      benefit: 3,
      category: 3,
      summary: 3,
    });
  });

  it("reaches each proposed change under the shared field", () => {
    const changes = proposedChanges(
      null,
      { summary: "S", sports: ["tennis"] },
      IKF,
      checkExtraction({}, IKF, null)
    );
    const byPath = Object.fromEntries(changes.map((c: { path: string }) => [c.path, c]));
    assert.equal(byPath["summary"].sharedQuote, 3);
    assert.equal(byPath["sports"].sharedQuote, undefined);
  });
});

describe("checkExtraction", () => {
  const fields = {
    eligibility: { ageMax: 25 },
    cycle: { opensOn: "2026-08-03" },
    summary: "A sports quota.",
  };
  const citations = {
    eligibility: "below 25 years of age as on 1 July 2026",
    cycle: "Registration opens on 3 August 2026",
    summary: "The quota gives every athlete a free seat",
  };

  it("checks quotes against the page when there is page text", () => {
    const checks = checkExtraction(fields, citations, PAGE);
    assert.equal(checks.against, "page-text");
    assert.deepEqual(checks.quotes, {
      eligibility: "found",
      cycle: "found",
      summary: "missing",
    });
    assert.equal(checks.figures["eligibility.ageMax"], "ok");
    assert.equal(checks.figures["cycle.opensOn"], "ok");
  });

  it("makes no verdict on quotes without page text, but still checks figures", () => {
    const checks = checkExtraction(fields, citations, null);
    assert.equal(checks.against, "none");
    assert.deepEqual(checks.quotes, {});
    assert.equal(checks.figures["eligibility.ageMax"], "ok");
  });
});

describe("proposedChanges with checks", () => {
  const extracted = { eligibility: { ageMax: 25, level: "A national medal" }, summary: "S" };
  const citations = { eligibility: "below 25 years" };
  const checks = {
    against: "page-text",
    quotes: { eligibility: "partial", summary: "missing" },
    figures: { "eligibility.ageMax": "ok" },
  };

  it("attaches the quote verdict to every path under a field, and the figure verdict to its own path", () => {
    const changes = proposedChanges(null, extracted, citations, checks);
    const byPath = Object.fromEntries(changes.map((c: { path: string }) => [c.path, c])) as Record<
      string,
      { quoteCheck?: string; figureCheck?: string }
    >;
    assert.equal(byPath["eligibility.ageMax"]?.quoteCheck, "partial");
    assert.equal(byPath["eligibility.ageMax"]?.figureCheck, "ok");
    assert.equal(byPath["eligibility.level"]?.quoteCheck, "partial");
    assert.equal(byPath["eligibility.level"]?.figureCheck, undefined);
  });

  it("gives no verdict for a field that has no quote to judge", () => {
    const changes = proposedChanges(null, extracted, citations, checks);
    const summary = changes.find((c: { path: string }) => c.path === "summary");
    assert.equal(summary?.quoteCheck, undefined);
  });

  it("behaves as before when there are no checks", () => {
    const changes = proposedChanges(null, extracted, citations);
    for (const change of changes) {
      assert.equal(change.quoteCheck, undefined);
      assert.equal(change.figureCheck, undefined);
    }
  });
});

describe("the review endpoint", () => {
  let mongod: { getUri(): string; stop(): Promise<void> };
  let token: string;

  before(async () => {
    mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
    await redis.quit?.().catch(() => undefined);
  });

  beforeEach(async () => {
    await Promise.all([
      Opportunity.deleteMany({}),
      DataSourceSubmission.deleteMany({}),
      Admin.deleteMany({}),
    ]);
    const id = new mongoose.Types.ObjectId();
    await Admin.collection.insertOne({
      _id: id,
      name: "Test admin",
      email: `${id.toString()}@example.test`,
      password: "not-a-real-hash",
      role: "OPERATIONS_ADMIN",
      permissions: ["opportunities:manage"],
      isActive: true,
    });
    token = generateToken({
      id: id.toString(),
      email: `${id}@example.test`,
      role: "OPERATIONS_ADMIN",
    });
  });

  const seed = (over: Record<string, unknown> = {}) =>
    DataSourceSubmission.create({
      targetType: "OPPORTUNITY",
      sportSlug: "tennis",
      opportunityTrack: "scholarship",
      sourceLabel: "Circular",
      sourceKind: "LINK",
      sourceUrl: "https://site.test/circular",
      status: "PENDING_REVIEW",
      submittedBy: new mongoose.Types.ObjectId(),
      extractedData: { eligibility: { ageMax: 25 }, summary: "A quota" },
      citations: { eligibility: "below 25 years", summary: "made up quote" },
      citationChecks: {
        against: "page-text",
        quotes: { eligibility: "found", summary: "missing" },
        figures: { "eligibility.ageMax": "ok" },
      },
      ...over,
    });

  it("returns each change with its quote and figure verdicts", async () => {
    const submission = await seed();
    const res = await request(app)
      .get(`/api/admin/opportunity-sources/${submission._id}`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200, JSON.stringify(res.body));
    const byPath = Object.fromEntries(
      res.body.data.changes.map((c: { path: string }) => [c.path, c])
    );
    assert.equal(byPath["eligibility.ageMax"].quoteCheck, "found");
    assert.equal(byPath["eligibility.ageMax"].figureCheck, "ok");
    assert.equal(byPath["summary"].quoteCheck, "missing");
  });

  it("still serves a submission read before these checks existed", async () => {
    const submission = await seed({ citationChecks: undefined });
    const res = await request(app)
      .get(`/api/admin/opportunity-sources/${submission._id}`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200, JSON.stringify(res.body));
    for (const change of res.body.data.changes) {
      assert.equal(change.quoteCheck, undefined);
      assert.equal(change.figureCheck, undefined);
    }
  });
});
