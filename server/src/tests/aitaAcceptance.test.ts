// The acceptance-list reader: what it keeps (numbers), what it never keeps (anyone's name),
// and that it asks for the page the way the page asks for itself. The HTML here is shaped
// like AITA's own, from reading a real list on 2026-10-09, with invented players.

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  parseAcceptanceCategory,
  parseCategories,
} = require("../shared/services/aita/acceptanceParser");
const {
  AitaAcceptanceSource,
  factSheetUrl,
} = require("../shared/services/aita/AitaAcceptanceSource");

interface Row {
  slot: string;
  rank?: number | null;
  name?: string;
  taken?: boolean;
}

const playerRow = (row: Row): string =>
  row.taken === false
    ? `<tr><td class="text-dark bg-soft-success id">${row.slot}</td><td class="text-start flag"><label>State: &nbsp;</label>-</td><td class="text-start name primary-color">(Available Slot)</td><td class="dob">-</td><td class="player_rank"><label>AITA Rank: &nbsp;</label>-</td></tr>`
    : `<tr><td class="text-dark bg-soft-success id">${row.slot}</td><td class="text-start flag"><label>State: &nbsp;</label>UP</td><td class="text-start name primary-color">${row.name ?? "Invented PLAYER"}</td><td class="text-start first_name">Invented</td><td class="text-start family_name">PLAYER</td><td class="dob">2010</td><td class="player_rank"><label>AITA Rank: &nbsp;</label>${row.rank ?? "-"}</td><td class="wtn_rank">-</td></tr>`;

const category = (options: {
  entered?: number;
  asOn?: string;
  mdSize?: number;
  mdWc?: number;
  mdQ?: number;
  mdSe?: number;
  md?: Row[];
  qdSize?: number;
  qdWc?: number;
  qd?: Row[];
}): string => {
  const {
    entered = 40,
    asOn = "17-08-2026",
    mdSize = 32,
    mdWc = 0,
    mdQ = 8,
    mdSe = 1,
    md = [],
    qdSize = 64,
    qdWc = 4,
    qd = [],
  } = options;
  return (
    `<div class="card"><div class="card-body"><h6>Boys Entered-${entered} (Acceptance List AS On -${asOn})</h6>` +
    `<h5>Main Draw</h5><p>- Size: ${mdSize} positions (${mdWc} - MD Wild Cards, ${mdQ} - Qualifiers, ${mdSe} - Special Exempts).</p>` +
    `<table><tbody>${md.map(playerRow).join("")}` +
    `<tr><td class="text-dark bg-soft-success id">MDWC-01</td><td class="name">MDWC-01 -</td><td class="player_rank">-</td></tr>` +
    `<tr><td class="text-dark bg-soft-success id">SE-01</td><td class="name">SE-01 -</td><td class="player_rank">-</td></tr>` +
    `</tbody></table>` +
    `<h5>Qualifying Draw</h5><p>- Size: ${qdSize} positions (${qdWc} - QD Wild Cards).</p>` +
    `<table><tbody>${qd.map(playerRow).join("")}</tbody></table>` +
    `<h5 class="text-danger">Withdrawn-1</h5><table><tbody><tr><td class="text-danger bg-soft-danger id">1</td>` +
    `<td class="first_name">Withdrawn</td><td class="family_name">PERSON</td><td class=" family_name">ALT-02</td>` +
    `<td class="name">Withdrawn PERSON MD-08</td><td class="player_rank"><label>AITA Rank: &nbsp;</label>545</td></tr></tbody></table>` +
    `</div></div>`
  );
};

const ranked = (...ranks: Array<number | null>): Row[] =>
  ranks.map((rank, i) => ({ slot: `MD-${String(i + 1).padStart(2, "0")}`, rank }));

describe("reading one category", () => {
  it("takes the draw sizes, and works out the direct places a ranked player competes for", () => {
    const parsed = parseAcceptanceCategory(category({ md: ranked(10, 20, 30) }));
    assert.equal(parsed.mainDrawSize, 32);
    // 32 places, less 0 wild cards, 8 qualifiers and 1 special exempt.
    assert.equal(parsed.mainDirectSlots, 23);
    assert.equal(parsed.qualifyingSize, 64);
    assert.equal(parsed.qualifyingDirectSlots, 60);
  });

  it("reads the accepted ranks, best first, and counts the unranked", () => {
    const parsed = parseAcceptanceCategory(category({ md: ranked(88, 43, null, 272, null) }));
    assert.deepEqual(parsed.mainRanks, [43, 88, 272]);
    assert.equal(parsed.mainUnranked, 2);
  });

  it("reads the qualifying separately from the main draw", () => {
    const qd: Row[] = [434, 457, null].map((rank, i) => ({ slot: `QD-0${i + 1}`, rank }));
    const parsed = parseAcceptanceCategory(category({ md: ranked(5), qd }));
    assert.deepEqual(parsed.mainRanks, [5]);
    assert.deepEqual(parsed.qualifyingRanks, [434, 457]);
    assert.equal(parsed.qualifyingUnranked, 1);
  });

  it("does not count a place nobody has taken", () => {
    const md = [
      ...ranked(10, 20),
      { slot: "MD-03", taken: false },
      { slot: "MD-04", taken: false },
    ];
    const parsed = parseAcceptanceCategory(category({ md }));
    assert.deepEqual(parsed.mainRanks, [10, 20]);
    assert.equal(parsed.mainUnranked, 0);
  });

  it("ignores wild cards, exempts and the withdrawn table", () => {
    const parsed = parseAcceptanceCategory(category({ md: ranked(10) }));
    assert.deepEqual(parsed.mainRanks, [10]);
    assert.equal(parsed.mainUnranked, 0);
    // The withdrawn player's rank (545) must not be read as an accepted one.
    assert.ok(!parsed.mainRanks.includes(545));
  });

  it("reads how many entered and when the list was frozen", () => {
    const parsed = parseAcceptanceCategory(category({ entered: 86, asOn: "17-08-2026" }));
    assert.equal(parsed.entered, 86);
    assert.equal(parsed.asOn, "2026-08-17");
  });

  it("keeps no name, state or year of birth: the result is numbers only", () => {
    const parsed = parseAcceptanceCategory(category({ md: ranked(10, 20) }));
    const json = JSON.stringify(parsed);
    assert.doesNotMatch(json, /Invented|PLAYER|Withdrawn|PERSON/);
    for (const value of Object.values(parsed)) {
      assert.ok(
        typeof value === "number" ||
          value === null ||
          typeof value === "string" ||
          Array.isArray(value)
      );
    }
    // The only strings are the list's own date.
    assert.deepEqual(
      Object.entries(parsed)
        .filter(([, value]) => typeof value === "string")
        .map(([key]) => key),
      ["asOn"]
    );
  });

  it("returns nothing for a category with no main draw", () => {
    assert.equal(parseAcceptanceCategory("<div>No records</div>"), null);
  });

  it("copes with a category that has no qualifying", () => {
    const html = category({ md: ranked(1) }).replace(/<h5>Qualifying Draw<\/h5>.*?<\/table>/s, "");
    const parsed = parseAcceptanceCategory(html);
    assert.equal(parsed.qualifyingSize, 0);
    assert.deepEqual(parsed.qualifyingRanks, []);
  });
});

describe("reading the categories on offer", () => {
  const html =
    `<a data-gender="1" class="nav-link active" id="cat_19-tab" data-bs-toggle="tab" href="#tab-cat_19">BS18</a>` +
    `<a data-gender="2" class="nav-link " id="cat_24-tab" data-bs-toggle="tab" href="#tab-cat_24">GS18</a>` +
    `<a data-gender="1" class="nav-link " id="cat_30-tab" data-bs-toggle="tab" href="#tab-cat_30">BD14</a>`;

  it("takes the singles categories, with their gender and age group", () => {
    assert.deepEqual(parseCategories(html), [
      { categoryId: 19, gender: "Boys", code: "BS18", ageGroup: "U-18" },
      { categoryId: 24, gender: "Girls", code: "GS18", ageGroup: "U-18" },
    ]);
  });
});

describe("asking for an event the way the page does", () => {
  const token = (n: number) => `${String(n).repeat(8)}`.slice(0, 8).padEnd(16, "a");
  const make = () => {
    const calls: Array<{ url: string; ajax: boolean; cookie: string }> = [];
    let issued = 1;
    const fetch = async (url: string, options: { ajax: boolean; cookie: string }) => {
      calls.push({ url, ...options });
      if (url.includes("tournament-acceptance-factsheet")) {
        return {
          status: 200,
          body: `<html><title>AITA National Series Tournament</title><script>localStorage.setItem("csrf_form_token","${token(1)}")</script></html>`,
          cookies: ["session=abc; path=/; HttpOnly"],
        };
      }
      issued += 1;
      if (url.includes("tournament-acceptance-list")) {
        return {
          status: 200,
          body: JSON.stringify({
            status: true,
            token: token(issued),
            data: `<a data-gender="1" id="cat_19-tab" href="#">BS16</a><a data-gender="2" id="cat_24-tab" href="#">GS16</a>`,
          }),
        };
      }
      return {
        status: 200,
        body: JSON.stringify({
          status: true,
          token: token(issued),
          data: category({ md: ranked(10, 20) }),
        }),
      };
    };
    return { calls, fetch };
  };

  it("opens the fact sheet, then lists the categories, then loads each, passing the token on", async () => {
    const { calls, fetch } = make();
    const source = new AitaAcceptanceSource({ fetch, sleep: async () => {}, intervalMs: 0 });

    const event = await source.fetchEvent(31);

    assert.equal(event.tourId, 31);
    assert.equal(event.title, "AITA National Series Tournament");
    assert.deepEqual(
      event.categories.map((c: { code: string }) => c.code),
      ["BS16", "GS16"]
    );
    assert.deepEqual(event.categories[0].parsed.mainRanks, [10, 20]);

    assert.equal(calls[0]!.url, factSheetUrl(31));
    assert.match(calls[0]!.url, /tournament-acceptance-factsheet-MzE=$/);
    assert.equal(calls[0]!.ajax, false);
    // Each request after the first carries the session cookie and the token the last one returned.
    assert.match(
      calls[1]!.url,
      new RegExp(`tournament-acceptance-list\\?csrf_form_token=${token(1)}&tour_id=31`)
    );
    assert.equal(calls[1]!.cookie, "session=abc");
    assert.match(
      calls[2]!.url,
      new RegExp(
        `tournament-acceptance-load\\?csrf_form_token=${token(2)}&tour_id=31&categoryid=19`
      )
    );
    assert.match(calls[3]!.url, new RegExp(`csrf_form_token=${token(3)}&tour_id=31&categoryid=24`));
    assert.ok(calls.slice(1).every((call) => call.ajax));
  });

  it("returns an event with no categories when the list is empty", async () => {
    const fetch = async (url: string) =>
      url.includes("factsheet")
        ? {
            status: 200,
            body: `<title>t</title>localStorage.setItem("csrf_form_token","${token(1)}")`,
          }
        : { status: 200, body: JSON.stringify({ status: false }) };
    const source = new AitaAcceptanceSource({ fetch, sleep: async () => {}, intervalMs: 0 });
    assert.deepEqual((await source.fetchEvent(5)).categories, []);
  });

  it("fails clearly when the page carries no token", async () => {
    const source = new AitaAcceptanceSource({
      fetch: async () => ({ status: 200, body: "<html></html>" }),
      sleep: async () => {},
      intervalMs: 0,
    });
    await assert.rejects(source.fetchEvent(5), /No token/);
  });

  it("does not retry a page that is not there, but retries a server error", async () => {
    let calls = 0;
    const gone = new AitaAcceptanceSource({
      fetch: async () => {
        calls += 1;
        return { status: 404, body: "" };
      },
      sleep: async () => {},
      intervalMs: 0,
    });
    await assert.rejects(gone.fetchEvent(5), /404/);
    assert.equal(calls, 1);

    let attempts = 0;
    const flaky = new AitaAcceptanceSource({
      fetch: async (url: string) => {
        attempts += 1;
        if (attempts < 3) return { status: 503, body: "" };
        return url.includes("factsheet")
          ? {
              status: 200,
              body: `<title>t</title>localStorage.setItem("csrf_form_token","${token(1)}")`,
            }
          : { status: 200, body: JSON.stringify({ status: false }) };
      },
      sleep: async () => {},
      intervalMs: 0,
    });
    assert.equal((await flaky.fetchEvent(5)).tourId, 5);
    assert.ok(attempts >= 3);
  });

  it("spaces its requests", async () => {
    const waits: number[] = [];
    const { fetch } = make();
    const source = new AitaAcceptanceSource({
      fetch,
      sleep: async (ms: number) => {
        waits.push(ms);
      },
      intervalMs: 1500,
    });
    await source.fetchEvent(31);
    assert.ok(waits.length >= 3, "it paused between requests");
  });
});

// ─── From finished events to records ──────────────────────────────────────────

const {
  captureAcceptance,
  ladderOf,
  recordsFrom,
  selectTargets,
} = require("../shared/services/aita/acceptanceCapture");

const target = (over: Record<string, unknown> = {}) => ({
  externalId: "31",
  name: "AITA National Series Tournament",
  levelText: "National Series (7 Days)",
  startDate: "2026-09-12",
  endDate: "2026-09-18",
  ...over,
});

describe("which events are worth fetching", () => {
  const today = "2026-10-09";

  it("reads the level from the name, or from the printed level", () => {
    assert.equal(ladderOf(target()), "National Series");
    assert.equal(
      ladderOf(target({ name: "Haryana Open", levelText: "Super Series (7 Days)" })),
      "Super Series"
    );
    assert.equal(ladderOf(target({ name: "Haryana Open", levelText: null })), null);
  });

  it("takes only finished events on the junior ladder", () => {
    const rows = [
      target({ externalId: "1" }),
      target({ externalId: "2", endDate: "2026-10-12" }), // not finished
      target({ externalId: "3", name: "AITA Men Rs 1 Lakh Tennis Tournament", levelText: null }),
      target({ externalId: "4", name: "ITF Masters (Jaipur)", levelText: null }),
      target({ externalId: "5", name: "Haryana Open", levelText: null }),
    ];
    const chosen = selectTargets(rows, { today, alreadyCaptured: new Set() });
    assert.deepEqual(
      chosen.map((row: { externalId: string }) => row.externalId),
      ["1"]
    );
    assert.equal(chosen[0].ladder, "National Series");
  });

  it("skips what is already held, and counts an event once however often it is listed", () => {
    const rows = [
      target({ externalId: "1" }),
      target({ externalId: "1" }),
      target({ externalId: "2" }),
    ];
    const chosen = selectTargets(rows, { today, alreadyCaptured: new Set(["2"]) });
    assert.deepEqual(
      chosen.map((row: { externalId: string }) => row.externalId),
      ["1"]
    );
  });

  it("works through the newest first, and stops at the limit", () => {
    const rows = [
      target({ externalId: "late", endDate: "2026-09-30" }),
      target({ externalId: "early", endDate: "2026-08-01" }),
      target({ externalId: "mid", endDate: "2026-09-01" }),
    ];
    const chosen = selectTargets(rows, { today, alreadyCaptured: new Set(), limit: 2 });
    assert.deepEqual(
      chosen.map((row: { externalId: string }) => row.externalId),
      ["late", "mid"]
    );
  });

  it("stops asking about events old enough that they never had a list", () => {
    const rows = [
      target({ externalId: "recent", endDate: "2026-09-20" }),
      target({ externalId: "old", endDate: "2026-03-01" }),
    ];
    const chosen = selectTargets(rows, { today, alreadyCaptured: new Set(), since: "2026-06-01" });
    assert.deepEqual(
      chosen.map((row: { externalId: string }) => row.externalId),
      ["recent"]
    );
  });
});

describe("turning a fetched event into records", () => {
  const now = new Date("2026-10-09T10:00:00Z");
  const event = {
    tourId: 31,
    title: "t",
    categories: [
      {
        categoryId: 19,
        gender: "Boys",
        code: "BS16",
        ageGroup: "U-16",
        parsed: parseAcceptanceCategory(category({ md: ranked(10, 20), entered: 33 })),
      },
      { categoryId: 24, gender: "Girls", code: "GS16", ageGroup: "U-16", parsed: null },
    ],
  };

  it("makes a record for each readable category, with the event's level and day", () => {
    const records = recordsFrom(event, { ...target(), ladder: "National Series" }, now);
    assert.equal(records.length, 1);
    assert.equal(records[0].category, "BS16");
    assert.equal(records[0].ageGroup, "U-16");
    assert.equal(records[0].gender, "Boys");
    assert.equal(records[0].ladder, "National Series");
    assert.equal(records[0].startDate, "2026-09-12");
    assert.deepEqual(records[0].mainRanks, [10, 20]);
    assert.equal(records[0].entered, 33);
    assert.equal(records[0].capturedAt, now.toISOString());
  });

  it("carries no name or other identifying text", () => {
    const [record] = recordsFrom(event, { ...target(), ladder: "National Series" }, now);
    assert.doesNotMatch(JSON.stringify(record), /Invented|PLAYER|PERSON/);
  });
});

describe("a run across several events", () => {
  const now = new Date("2026-10-09T10:00:00Z");
  const good = {
    tourId: 1,
    title: "t",
    categories: [
      {
        categoryId: 1,
        gender: "Boys",
        code: "BS14",
        ageGroup: "U-14",
        parsed: parseAcceptanceCategory(category({ md: ranked(5) })),
      },
    ],
  };

  it("keeps going when one event fails, and reports it", async () => {
    const saved: unknown[][] = [];
    const lines: string[] = [];
    const report = await captureAcceptance({
      targets: [
        { ...target({ externalId: "1" }), ladder: "National Series" },
        { ...target({ externalId: "2" }), ladder: "National Series" },
        { ...target({ externalId: "3" }), ladder: "National Series" },
      ],
      source: {
        fetchEvent: async (id: number) => {
          if (id === 2) throw new Error("GET returned 404");
          if (id === 3) return { tourId: 3, title: "t", categories: [] };
          return good;
        },
      },
      save: async (records: unknown[]) => {
        saved.push(records);
      },
      now,
      log: (line: string) => lines.push(line),
    });
    assert.equal(report.fetched, 2);
    assert.equal(report.records, 1);
    assert.equal(report.skippedNoRecords, 1);
    assert.deepEqual(report.failed, [{ externalId: "2", reason: "GET returned 404" }]);
    assert.equal(saved.length, 1);
    assert.ok(lines.some((line) => /FAILED/.test(line)));
  });
});

// ─── The scheduled run ────────────────────────────────────────────────────────

const {
  initializeAitaAcceptanceScheduler,
  isAitaAcceptanceCaptureRunning,
  runAitaAcceptanceCapture,
} = require("../utils/aitaAcceptanceScheduler");

describe("the scheduled capture", () => {
  const now = new Date("2026-10-09T10:00:00Z");
  const row = (externalId: string, endDate: string, name = "AITA National Series Tournament") => ({
    externalId,
    name,
    levelText: null,
    startDate: endDate,
    endDate,
  });
  const fetched = {
    tourId: 1,
    title: "t",
    categories: [
      {
        categoryId: 1,
        gender: "Boys",
        code: "BS14",
        ageGroup: "U-14",
        parsed: parseAcceptanceCategory(category({ md: ranked(5) })),
      },
    ],
  };
  const make = (rows: unknown[], held: string[] = []) => {
    const saved: unknown[][] = [];
    const asked: number[] = [];
    return {
      saved,
      asked,
      deps: {
        readCalendar: async () => rows,
        alreadyCaptured: async () => new Set(held),
        source: {
          fetchEvent: async (id: number) => {
            asked.push(id);
            return fetched;
          },
        },
        save: async (records: unknown[]) => {
          saved.push(records);
        },
        now: () => now,
      },
    };
  };

  it("fetches only events that have finished and are not yet held", async () => {
    const { deps, asked, saved } = make(
      [row("1", "2026-09-20"), row("2", "2026-10-12"), row("3", "2026-09-10")],
      ["3"]
    );
    const report = await runAitaAcceptanceCapture(deps);
    assert.deepEqual(asked, [1]);
    assert.equal(report.records, 1);
    assert.equal(saved.length, 1);
  });

  it("does not look at events too old to have had a list", async () => {
    const { deps, asked } = make([row("1", "2026-02-01")]);
    await runAitaAcceptanceCapture(deps);
    assert.deepEqual(asked, []);
  });

  it("is not left running after it finishes, or after it fails", async () => {
    const { deps } = make([row("1", "2026-09-20")]);
    await runAitaAcceptanceCapture(deps);
    assert.equal(isAitaAcceptanceCaptureRunning(), false);

    const broken = {
      ...deps,
      readCalendar: async () => {
        throw new Error("AITA is down");
      },
    };
    assert.equal(await runAitaAcceptanceCapture(broken), null);
    assert.equal(isAitaAcceptanceCaptureRunning(), false);
  });

  it("does not run two at once", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { deps } = make([row("1", "2026-09-20")]);
    const slow = {
      ...deps,
      readCalendar: async () => {
        await gate;
        return [row("1", "2026-09-20")];
      },
    };
    const first = runAitaAcceptanceCapture(slow);
    assert.equal(await runAitaAcceptanceCapture(deps), null);
    release();
    assert.ok(await first);
  });

  it("starts nothing on a developer's machine, where the database is production", () => {
    const before = { env: process.env.NODE_ENV, on: process.env.AITA_ACCEPTANCE_CRON };
    process.env.NODE_ENV = "development";
    delete process.env.AITA_ACCEPTANCE_CRON;
    assert.equal(initializeAitaAcceptanceScheduler(), null);
    process.env.NODE_ENV = "production";
    process.env.AITA_ACCEPTANCE_CRON_DISABLED = "true";
    assert.equal(initializeAitaAcceptanceScheduler(), null);
    delete process.env.AITA_ACCEPTANCE_CRON_DISABLED;
    if (before.env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = before.env;
    if (before.on !== undefined) process.env.AITA_ACCEPTANCE_CRON = before.on;
  });
});
