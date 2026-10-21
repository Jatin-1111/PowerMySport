// The assistant's tournament-details tool and its hand-off to the team, run against a real
// (in-memory) MongoDB. What matters: a named tournament is found by what a parent calls it and
// reports whether entries have closed, and a parent's question reaches the team only after they
// have given a name and an email and agreed, never twice in an hour, and without anything else
// from the chat.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
// Any email these tests would send goes to a port nothing listens on, so a real .env's SMTP
// credentials can never be used here. dotenv does not overwrite values already set.
process.env.EMAIL_HOST = "127.0.0.1";
process.env.EMAIL_PORT = "1";
process.env.EMAIL_USER = "test";
process.env.EMAIL_PASSWORD = "test";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { TournamentEdition } = require("../shared/models/TournamentEdition");
const { SupportTicket } = require("../client/models/SupportTicket");
const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
const {
  createHandoffTicket,
  HANDOFF_SUBJECT_PREFIX,
} = require("../client/services/SupportHandoffService");
const { searchTerms } = require("../shared/services/tournamentEditionQueries");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  await TournamentEdition.deleteMany({});
  await SupportTicket.deleteMany({});
});

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => {
  const d = new Date(Date.now() + days * DAY);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// The tools return different shapes, and the tests read them field by field.
type Tool = {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: Record<string, unknown>, ctx?: object) => Promise<any>;
};
const tool = (name: string): Tool => ASSISTANT_CHAT_TOOLS.find((t: Tool) => t.name === name);

let counter = 0;
const seed = (over: Record<string, unknown> = {}) => {
  counter += 1;
  return TournamentEdition.create({
    sportSlug: "tennis",
    name: `AITA CS7 (Town ${counter})`,
    slug: `edition-${counter}`,
    editionYear: 2026,
    startDate: inDays(10 + counter),
    sourceUrl: "https://example.test",
    city: `Town ${counter}`,
    state: "Delhi",
    ageGroups: ["Under-14"],
    ...over,
  });
};

describe("searchTerms", () => {
  it("drops the words of a question and keeps the words of a name", () => {
    assert.deepEqual(searchTerms("When do entries close for the Delhi tournament?"), ["delhi"]);
    assert.deepEqual(searchTerms("State Junior Championship"), ["state", "junior", "championship"]);
  });

  it("falls back to every word when a question is all question words, and caps the count", () => {
    assert.deepEqual(searchTerms("when is the tournament"), ["when", "is", "the", "tournament"]);
    assert.equal(searchTerms("a1 b2 c3 d4 e5 f6 g7 h8").length, 6);
    assert.deepEqual(searchTerms("   "), []);
  });
});

describe("get_tournament_details", () => {
  it("finds a tournament by its city and reports its dates, deadline and fees", async () => {
    await seed({
      name: "AITA CS7 (Delhi)",
      slug: "aita-cs7-delhi",
      city: "Delhi",
      venue: "Siri Fort",
      registrationDeadlineDate: inDays(5),
      entryOpensDate: inDays(-10),
      withdrawalDeadlineDate: inDays(8),
      deadlineTimes: { entryCloses: "23:59" },
      feeSingles: 700,
      feeDoubles: 900,
      detailUrl: "https://example.test/aita/delhi",
    });
    await seed({ name: "AITA CS7 (Pune)", city: "Pune", state: "Maharashtra" });

    const result = await tool("get_tournament_details").execute({
      query: "When do entries close for the Delhi tournament?",
    });
    assert.equal(result.found, true);
    assert.equal(result.tournaments.length, 1);
    const t = result.tournaments[0];
    assert.equal(t.name, "AITA CS7 (Delhi)");
    assert.equal(t.venue, "Siri Fort");
    assert.equal(t.entriesClose, inDays(5).toISOString().slice(0, 10));
    assert.equal(t.entriesCloseAt, "23:59");
    assert.equal(t.entriesClosed, false);
    assert.equal(t.feeSinglesRupees, 700);
    assert.equal(t.tournamentPage, "https://powermysport.com/tournaments/aita-cs7-delhi");
    assert.equal(t.officialPage, "https://example.test/aita/delhi");
  });

  it("says entries have closed once the deadline date has passed, but not on the day itself", async () => {
    await seed({ name: "Closed Open", registrationDeadlineDate: inDays(-1) });
    await seed({ name: "Today Open", registrationDeadlineDate: inDays(0) });
    const closed = await tool("get_tournament_details").execute({ query: "Closed Open" });
    const today = await tool("get_tournament_details").execute({ query: "Today Open" });
    assert.equal(closed.tournaments[0].entriesClosed, true);
    assert.equal(today.tournaments[0].entriesClosed, false);
  });

  it("leaves entriesClosed unknown, not false, when no deadline is published", async () => {
    await seed({ name: "No Deadline Open" });
    const result = await tool("get_tournament_details").execute({ query: "No Deadline Open" });
    assert.equal(result.tournaments[0].entriesClosed, undefined);
  });

  it("matches every word, so a name and a city narrow the search", async () => {
    await seed({ name: "Junior Open (Delhi)", city: "Delhi" });
    await seed({ name: "Junior Open (Pune)", city: "Pune" });
    const both = await tool("get_tournament_details").execute({ query: "Junior Open" });
    const one = await tool("get_tournament_details").execute({ query: "Junior Open Pune" });
    assert.equal(both.tournaments.length, 2);
    assert.equal(one.tournaments.length, 1);
    assert.equal(one.tournaments[0].city, "Pune");
  });

  it("can be narrowed to a sport", async () => {
    await seed({ name: "Delhi Open", sportSlug: "tennis" });
    await seed({ name: "Delhi Open Badminton", sportSlug: "badminton" });
    const result = await tool("get_tournament_details").execute({
      query: "Delhi",
      sportSlug: "badminton",
    });
    assert.deepEqual(
      result.tournaments.map((t: { sport: string }) => t.sport),
      ["badminton"]
    );
  });

  it("leaves out cancelled, merged and finished tournaments", async () => {
    await seed({ name: "Cancelled Open", status: "cancelled" });
    await seed({ name: "Merged Open", mergedInto: "another-open" });
    await seed({ name: "Finished Open", startDate: inDays(-9), endDate: inDays(-3) });
    await seed({ name: "Ongoing Open", startDate: inDays(-2), endDate: inDays(3) });

    for (const name of ["Cancelled", "Merged", "Finished"]) {
      const result = await tool("get_tournament_details").execute({ query: `${name} Open` });
      assert.equal(result.found, false, `${name} should not be found`);
    }
    const ongoing = await tool("get_tournament_details").execute({ query: "Ongoing Open" });
    assert.equal(ongoing.found, true);
  });

  it("returns at most three, soonest first, and says there are more", async () => {
    for (let i = 0; i < 5; i += 1)
      await seed({ name: `Series Open ${i}`, startDate: inDays(20 - i) });
    const result = await tool("get_tournament_details").execute({ query: "Series Open" });
    assert.equal(result.tournaments.length, 3);
    assert.equal(result.moreMatches, true);
    const starts = result.tournaments.map((t: { starts: string }) => t.starts);
    assert.deepEqual([...starts].sort(), starts);
  });

  it("says plainly when nothing matches, and asks for what is missing when nothing was asked", async () => {
    const none = await tool("get_tournament_details").execute({ query: "Nowhere Open" });
    assert.equal(none.found, false);
    assert.match(none.message, /No upcoming or ongoing tournament matches/);
    const blank = await tool("get_tournament_details").execute({ query: "   " });
    assert.match(blank.error, /which tournament/i);
  });

  it("treats regex characters in a query as plain text", async () => {
    await seed({ name: "Plain Open" });
    const result = await tool("get_tournament_details").execute({ query: "(.*+?[" });
    assert.equal(result.found, false);
  });
});

describe("createHandoffTicket", () => {
  const good = {
    name: "Meera Iyer",
    email: "Meera.Iyer@Example.com",
    summary: "I would like to talk to the team about coaching for my daughter.",
    parentAgreed: true,
  };
  const noEmail = { sendReceipt: async () => undefined };

  it("creates a ticket from what the parent said, with the email lower-cased", async () => {
    const result = await createHandoffTicket(good, noEmail);
    assert.equal(result.ok, true);
    const ticket = await SupportTicket.findOne({}).lean();
    assert.equal(ticket.requesterName, "Meera Iyer");
    assert.equal(ticket.requesterEmail, "meera.iyer@example.com");
    assert.ok(ticket.subject.startsWith(HANDOFF_SUBJECT_PREFIX));
    assert.match(ticket.description, /coaching for my daughter/);
    assert.equal(ticket.category, "OTHER");
  });

  it("sends nothing unless the parent has clearly agreed: anything but true is refused", async () => {
    for (const agreed of [false, undefined, "true", 1, "yes"]) {
      const result = await createHandoffTicket({ ...good, parentAgreed: agreed }, noEmail);
      assert.deepEqual(result, { ok: false, reason: "not_agreed" });
    }
    assert.equal(await SupportTicket.countDocuments(), 0);
  });

  it("refuses a missing name, a bad email and an empty summary, each for its own reason", async () => {
    assert.deepEqual(await createHandoffTicket({ ...good, name: "   " }, noEmail), {
      ok: false,
      reason: "missing_name",
    });
    for (const email of ["", "not-an-email", "a@b", "two words@example.com", undefined]) {
      assert.deepEqual(await createHandoffTicket({ ...good, email }, noEmail), {
        ok: false,
        reason: "invalid_email",
      });
    }
    assert.deepEqual(await createHandoffTicket({ ...good, summary: "" }, noEmail), {
      ok: false,
      reason: "missing_summary",
    });
    assert.equal(await SupportTicket.countDocuments(), 0);
  });

  it("refuses a second request from the same email within the hour, then allows it later", async () => {
    // Real time, because the ticket's own createdAt comes from the database's clock.
    const start = new Date();
    assert.equal((await createHandoffTicket(good, { ...noEmail, now: () => start })).ok, true);

    const soon = new Date(start.getTime() + 30 * 60 * 1000);
    assert.deepEqual(
      await createHandoffTicket(
        { ...good, email: "meera.iyer@example.com" },
        { ...noEmail, now: () => soon }
      ),
      { ok: false, reason: "already_sent" }
    );
    assert.equal(await SupportTicket.countDocuments(), 1);

    // The check looks back from the time given, so an hour later it is a new request.
    const later = new Date(Date.now() + 2 * 60 * 60 * 1000);
    assert.equal((await createHandoffTicket(good, { ...noEmail, now: () => later })).ok, true);
  });

  it("strips control characters and caps what it stores", async () => {
    await createHandoffTicket(
      {
        ...good,
        name: `Meera\u0000\nIyer ${"x".repeat(200)}`,
        summary: `a\u0007b ${"y".repeat(2000)}`,
      },
      noEmail
    );
    const ticket = await SupportTicket.findOne({}).lean();
    assert.ok(ticket.requesterName.length <= 80);
    assert.equal(/[\u0000-\u001f]/.test(ticket.requesterName), false);
    assert.ok(ticket.description.length < 800);
    assert.equal(ticket.subject.length <= HANDOFF_SUBJECT_PREFIX.length + 80, true);
  });

  it("sends a receipt to the parent, and a failing receipt does not undo the request", async () => {
    const sent: Array<{ email: string; name: string }> = [];
    const ok = await createHandoffTicket(good, {
      sendReceipt: async (details: { email: string; name: string }) => {
        sent.push(details);
      },
    });
    assert.equal(ok.ok, true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(
      sent.map((s) => s.email),
      ["meera.iyer@example.com"]
    );

    const failing = await createHandoffTicket(
      { ...good, email: "other@example.com" },
      {
        sendReceipt: async () => {
          throw new Error("smtp down");
        },
      }
    );
    assert.equal(failing.ok, true);
    assert.equal(await SupportTicket.countDocuments(), 2);
  });

  it("puts the ticket on the parent's account when they are signed in", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    await createHandoffTicket({ ...good, userId }, noEmail);
    const ticket = await SupportTicket.findOne({}).lean();
    assert.equal(String(ticket.userId), userId);
  });
});

describe("request_team_followup, as the model calls it", () => {
  it("tells the model what to do next when it was called too early, and creates nothing", async () => {
    const early = await tool("request_team_followup").execute({
      name: "Meera",
      email: "meera@example.com",
      summary: "talk to the team",
      parentAgreed: false,
    });
    assert.equal(early.sent, false);
    assert.match(early.instruction, /clear yes/);

    const badEmail = await tool("request_team_followup").execute({
      name: "Meera",
      email: "nope",
      summary: "talk to the team",
      parentAgreed: true,
    });
    assert.equal(badEmail.sent, false);
    assert.match(badEmail.instruction, /does not look right/);
    assert.equal(await SupportTicket.countDocuments(), 0);
  });

  it("creates the request once the parent has agreed, and refuses to repeat it", async () => {
    const args = {
      name: "Meera Iyer",
      email: "meera@example.com",
      summary: "talk to the team about coaching",
      parentAgreed: true,
    };
    const first = await tool("request_team_followup").execute(args);
    assert.equal(first.sent, true);
    assert.match(first.instruction, /24 hours/);
    assert.equal(await SupportTicket.countDocuments(), 1);

    const again = await tool("request_team_followup").execute(args);
    assert.equal(again.sent, false);
    assert.match(again.instruction, /Already passed on/);
    assert.equal(await SupportTicket.countDocuments(), 1);
  });
});
