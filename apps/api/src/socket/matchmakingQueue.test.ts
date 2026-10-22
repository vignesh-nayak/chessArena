import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import {
  pairQueue,
  ratingWindow,
  type QueueEntry,
} from "./matchmakingQueue.js";

const tenPlusFive = { initial: 600, increment: 5 };

function entry(overrides: Partial<QueueEntry> & Pick<QueueEntry, "userId">): QueueEntry {
  return {
    rating: 1200,
    joinedAt: 0,
    socketId: overrides.userId,
    timeControl: tenPlusFive,
    ...overrides,
  };
}

describe("ratingWindow", () => {
  it("starts at 100, steps by 50 every 10 seconds, and caps at 400", () => {
    assert.equal(ratingWindow(0), 100);
    assert.equal(ratingWindow(9), 100);
    assert.equal(ratingWindow(10), 150);
    assert.equal(ratingWindow(60), 400);
    assert.equal(ratingWindow(100), 400);
  });
});

describe("pairQueue", () => {
  it("pairs similar ratings immediately", () => {
    const result = pairQueue(
      [entry({ userId: "a", rating: 1200 }), entry({ userId: "b", rating: 1250, joinedAt: 1 })],
      1,
    );
    assert.deepEqual(
      result.pairs.map((pair) => pair.map((player) => player.userId)),
      [["a", "b"]],
    );
    assert.equal(result.rest.length, 0);
  });

  it("waits until the older player's window covers a wide gap", () => {
    const older = entry({ userId: "a", rating: 1400, joinedAt: 0 });
    const newer = entry({ userId: "b", rating: 1200, joinedAt: 0 });
    const tooSoon = pairQueue([older, newer], 19_000);
    assert.equal(tooSoon.pairs.length, 0);
    assert.equal(tooSoon.rest.length, 2);

    const ready = pairQueue([older, newer], 20_000);
    assert.deepEqual(
      ready.pairs.map((pair) => pair.map((player) => player.userId)),
      [["a", "b"]],
    );
  });

  it("pairs two of three players and leaves the outsider queued", () => {
    const result = pairQueue(
      [
        entry({ userId: "a", rating: 1200, joinedAt: 0 }),
        entry({ userId: "b", rating: 1250, joinedAt: 1_000 }),
        entry({ userId: "c", rating: 1600, joinedAt: 2_000 }),
      ],
      2_000,
    );
    assert.deepEqual(
      result.pairs.map((pair) => pair.map((player) => player.userId)),
      [["a", "b"]],
    );
    assert.deepEqual(
      result.rest.map((player) => player.userId),
      ["c"],
    );
  });

  it("prefers the oldest opponent inside the seeker's window", () => {
    const result = pairQueue(
      [
        entry({ userId: "a", rating: 1200, joinedAt: 0 }),
        entry({ userId: "b", rating: 1500, joinedAt: 1_000 }),
        entry({ userId: "c", rating: 1210, joinedAt: 2_000 }),
      ],
      60_000,
    );
    assert.deepEqual(
      result.pairs.map((pair) => pair.map((player) => player.userId)),
      [["a", "b"]],
    );
    assert.deepEqual(
      result.rest.map((player) => player.userId),
      ["c"],
    );
  });

  it("does not pair different time controls", () => {
    const result = pairQueue(
      [
        entry({ userId: "a" }),
        entry({
          userId: "b",
          timeControl: { initial: 180, increment: 0 },
        }),
      ],
      0,
    );
    assert.equal(result.pairs.length, 0);
    assert.equal(result.rest.length, 2);
  });
});
