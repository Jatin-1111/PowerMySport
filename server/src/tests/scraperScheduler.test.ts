/* eslint-disable @typescript-eslint/no-var-requires */
// The legacy weekly scrapers write AI-found free text to the one database, so
// WHEN they start is the property worth pinning: never on a developer's machine by
// accident, always on the deployed server, and switchable off in both places.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { afterEach, describe, it } = require("node:test");

const { initializeScraperScheduler } = require("../utils/scraperScheduler");

const KEYS = ["NODE_ENV", "SCRAPER_CRON", "SCRAPER_CRON_DISABLED"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

const start = (env: Partial<Record<(typeof KEYS)[number], string>>) => {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, env);
  return initializeScraperScheduler().job;
};

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("initializeScraperScheduler", () => {
  it("does not start on a developer's machine", () => {
    assert.equal(start({ NODE_ENV: "development" }), null);
    assert.equal(start({}), null);
  });

  it("does not start under test", () => {
    assert.equal(start({ NODE_ENV: "test" }), null);
  });

  it("starts on the deployed server", () => {
    const job = start({ NODE_ENV: "production" });
    assert.ok(job, "expected a scheduled job");
    job.stop();
  });

  it("starts locally only when asked for by name", () => {
    const job = start({ NODE_ENV: "development", SCRAPER_CRON: "on" });
    assert.ok(job);
    job.stop();
  });

  it("can be switched off even on the deployed server", () => {
    assert.equal(start({ NODE_ENV: "production", SCRAPER_CRON_DISABLED: "true" }), null);
    assert.equal(
      start({ NODE_ENV: "development", SCRAPER_CRON: "on", SCRAPER_CRON_DISABLED: "true" }),
      null
    );
  });
});
