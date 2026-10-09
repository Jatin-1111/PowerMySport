import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { reachForPlayingUp } = require("../client/services/plannerReach");

const sample = (id: string, ageGroup: string, mainRanks: number[]) => ({
  externalId: id,
  startDate: `2026-0${id}-01`,
  ladder: "Championship Series",
  ageGroup,
  gender: "Boys",
  mainDrawSize: 32,
  mainDirectSlots: mainRanks.length,
  mainRanks,
  mainUnranked: 0,
  qualifyingSize: 0,
  qualifyingDirectSlots: 0,
  qualifyingRanks: [],
  qualifyingUnranked: 0,
});

const entry = (slug: string, ageGroups: string[]) =>
  ({ edition: { slug, ladder: "Championship Series", ageGroups } }) as never;

describe("reach for events in an older age group", () => {
  const loaded: string[] = [];
  const load = async (_ladder: string, group: string) => {
    loaded.push(group);
    // The U-16 draws closed at rank 300; the U-18 draws at rank 100.
    return group === "U-16"
      ? [sample("1", "U-16", [300]), sample("2", "U-16", [280])]
      : [sample("3", "U-18", [100]), sample("4", "U-18", [90])];
  };

  it("judges against the youngest older group of the event, on the child's rank in that list", async () => {
    loaded.length = 0;
    const verdicts = await reachForPlayingUp({
      entries: [entry("up-16", ["U-16", "U-18"]), entry("up-18", ["U-18"])],
      ownAgeGroup: "U-14",
      gender: "Boys",
      alsoRanked: [
        { subcategory: "U-16", rank: 250 },
        { subcategory: "U-18", rank: 400 },
      ],
      load,
    });
    assert.equal(verdicts["up-16"].kind, "likely");
    assert.equal(verdicts["up-18"].kind, "unlikely");
    assert.deepEqual([...new Set(loaded)].sort(), ["U-16", "U-18"]);
  });

  it("gives no verdict when the event's groups cannot be read", async () => {
    const verdicts = await reachForPlayingUp({
      entries: [entry("odd", [])],
      ownAgeGroup: "U-14",
      gender: "Boys",
      alsoRanked: [],
      load,
    });
    assert.deepEqual(verdicts, {});
  });
});
