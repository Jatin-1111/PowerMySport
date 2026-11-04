// The weekly Lane-B scraper must never rewrite a curated tournament.
//
// Curated docs (isCurated=true) are hand-seeded by seedCuratedTournaments and
// power the detail pages. The scraper upserts by { sportSlug, name }, which is
// also a unique index, so when Gemini returns a name that matches a curated doc
// the guarded filter finds nothing and the upsert collides with the curated doc
// instead. What is pinned: the curated doc is left byte-for-byte alone, the
// collision does not abort the rest of the batch, and uncurated docs still
// refresh in place.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { Tournament } = require("../shared/models/Tournament");
const { upsertTournaments } = require("../shared/services/RealDataScraperService");

let mongod: { getUri(): string; stop(): Promise<void> };

const CURATED = {
  sportSlug: "tennis",
  name: "National Junior Championship",
  level: "National",
  description: "Hand-written curated description",
  ageGroup: "U14",
  sourceUrls: ["https://curated.example/source"],
  isCurated: true,
  isVerified: true,
  slug: "national-junior-championship",
};

before(async () => {
  // 60s, not the 10s default: mongod takes ~20s to come up on a Windows dev box.
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  await mongoose.connect(mongod.getUri());
  await Tournament.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Tournament.deleteMany({});
});

describe("upsertTournaments curated guard", () => {
  it("leaves a curated tournament untouched and still writes the rest of the batch", async () => {
    await Tournament.create(CURATED);
    const before = await Tournament.findOne({ slug: CURATED.slug }).lean();

    await upsertTournaments(
      "tennis",
      [
        {
          name: CURATED.name,
          level: "State",
          description: "Scraped overwrite attempt",
          ageGroup: "Open",
        },
        { name: "District Open", level: "District", description: "Scraped", ageGroup: "Open" },
      ],
      ["https://scraped.example/source"]
    );

    const curatedAfter = await Tournament.findOne({ slug: CURATED.slug }).lean();
    assert.deepEqual(curatedAfter, before);

    // Exactly one doc under the curated name: no duplicate was inserted.
    assert.equal(await Tournament.countDocuments({ sportSlug: "tennis", name: CURATED.name }), 1);

    // The item after the collision was still written.
    const district = await Tournament.findOne({
      sportSlug: "tennis",
      name: "District Open",
    }).lean();
    assert.ok(district);
    assert.equal(district.isCurated, false);
    assert.deepEqual(district.sourceUrls, ["https://scraped.example/source"]);
  });

  it("still refreshes an uncurated tournament in place", async () => {
    await Tournament.create({
      sportSlug: "tennis",
      name: "District Open",
      level: "District",
      description: "Old scraped text",
      ageGroup: "Open",
    });

    await upsertTournaments(
      "tennis",
      [{ name: "District Open", level: "State", description: "New scraped text", ageGroup: "U18" }],
      ["https://scraped.example/new"]
    );

    const docs = await Tournament.find({ sportSlug: "tennis", name: "District Open" }).lean();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].description, "New scraped text");
    assert.equal(docs[0].level, "State");
    assert.deepEqual(docs[0].sourceUrls, ["https://scraped.example/new"]);
  });
});
