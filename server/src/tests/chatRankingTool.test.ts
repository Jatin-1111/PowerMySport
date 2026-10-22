// get_child_ranking: what the assistant is allowed to say about a child's ranking.
// RankingClaimService is replaced with fixtures, so no database is involved.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { afterEach, describe, it } = require("node:test");

const { RankingClaimService } = require("../client/services/RankingClaimService");
const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");

const tool = ASSISTANT_CHAT_TOOLS.find((t: { name: string }) => t.name === "get_child_ranking");
const original = RankingClaimService.list;
afterEach(() => {
  RankingClaimService.list = original;
});

const claim = (name: string | null, sportSlug: string, standings: unknown[]) => ({
  id: "c1",
  dependentId: "d1",
  dependentName: name,
  sportSlug,
  federationCode: "AITA",
  regNo: "SECRET-REG-123",
  verifiedAt: new Date(),
  standings,
});

const standing = {
  rank: 212,
  regNo: "SECRET-REG-123",
  fullName: "Aarav Full Surname",
  birthYear: 2012,
  state: "Delhi",
  category: "Boys",
  subcategory: "U-14",
  totalPoints: 96,
  asOnDate: new Date("2026-10-12T00:00:00Z"),
  rankDelta: 9,
};

describe("get_child_ranking", () => {
  it("is registered for the assistant", () => {
    assert.ok(tool);
  });

  it("says the number is not linked when no account is known, and reads nothing", async () => {
    let read = false;
    RankingClaimService.list = async () => {
      read = true;
      return [];
    };
    const out = await tool.execute({}, {});
    assert.equal(out.linked, false);
    assert.equal(out.reason, "number_not_linked");
    assert.equal(read, false);
  });

  it("says no ranking is linked when the account has none at all", async () => {
    RankingClaimService.list = async () => [];
    const out = await tool.execute({ childName: "Zoya" }, { userId: "u1" });
    assert.equal(out.linked, false);
    assert.equal(out.reason, "no_ranking_linked");
  });

  it("names who is on the account when the name asked for is not, instead of saying nothing is linked", async () => {
    RankingClaimService.list = async () => [claim("Jatin Sharma", "tennis", [standing])];
    const out = await tool.execute({ childName: "Vikrant" }, { userId: "u1" });
    assert.equal(out.linked, false);
    assert.equal(out.reason, "child_not_on_account");
    assert.deepEqual(out.childrenOnAccount, [{ child: "Jatin", sport: "tennis" }]);
  });

  it("returns rank, points and movement with a first name only", async () => {
    RankingClaimService.list = async () => [claim("Aarav Sharma", "tennis", [standing])];
    const out = await tool.execute({ childName: "aar", sportSlug: "tennis" }, { userId: "u1" });
    assert.equal(out.linked, true);
    assert.deepEqual(out.children, [
      {
        child: "Aarav",
        sport: "tennis",
        lists: [
          {
            list: "Boys U-14",
            rank: 212,
            points: 96,
            listPublished: "2026-10-12",
            movedUpPlaces: 9,
          },
        ],
      },
    ]);
    const text = JSON.stringify(out);
    assert.ok(!text.includes("SECRET-REG-123"));
    assert.ok(!text.includes("Surname"));
    assert.ok(!text.includes("2012"));
  });

  it("says plainly when a linked child is in no current list", async () => {
    RankingClaimService.list = async () => [claim("Aarav Sharma", "tennis", [])];
    const out = await tool.execute({}, { userId: "u1" });
    assert.equal(out.linked, true);
    assert.match(out.children[0].lists, /not in any current list/);
  });
});
