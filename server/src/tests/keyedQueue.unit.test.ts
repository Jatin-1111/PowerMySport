import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { acquireKey, acquireKeys, activeKeyCount } = require("../utils/keyedQueue");

const tick = (ms = 1) => new Promise((resolve) => setTimeout(resolve, ms));

describe("keyedQueue", () => {
  it("runs holders of one key one at a time, in arrival order", async () => {
    const order: number[] = [];
    let running = 0;
    let maxRunning = 0;

    await Promise.all(
      Array.from({ length: 20 }, async (_, i) => {
        const release = await acquireKey("same");
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        order.push(i);
        await tick();
        running -= 1;
        release();
      })
    );

    assert.equal(maxRunning, 1);
    assert.deepEqual(
      order,
      Array.from({ length: 20 }, (_, i) => i)
    );
  });

  it("lets different keys run in parallel", async () => {
    let running = 0;
    let maxRunning = 0;
    await Promise.all(
      ["a", "b", "c", "d"].map(async (key) => {
        const release = await acquireKey(key);
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        await tick(5);
        running -= 1;
        release();
      })
    );
    assert.equal(maxRunning, 4);
  });

  it("cleans up after itself and ignores a double release", async () => {
    const release = await acquireKey("cleanup");
    assert.ok(activeKeyCount() >= 1);
    release();
    release();
    const next = await acquireKey("cleanup");
    next();
    assert.equal(activeKeyCount(), 0);
  });

  it("does not deadlock when two callers need the same pair in opposite order", async () => {
    const done: string[] = [];
    await Promise.all([
      (async () => {
        const release = await acquireKeys(["x", "y"]);
        await tick(3);
        done.push("first");
        release();
      })(),
      (async () => {
        const release = await acquireKeys(["y", "x"]);
        await tick(3);
        done.push("second");
        release();
      })(),
    ]);
    assert.deepEqual(done.sort(), ["first", "second"]);
  });
});
