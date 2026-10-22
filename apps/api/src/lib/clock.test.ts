import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { displayedClock, liveTimes, settleMove, type StoredClock } from "./clock.js";

const clock: StoredClock = {
  whiteMs: 600_000,
  blackMs: 600_000,
  incrementMs: 5_000,
};

describe("liveTimes", () => {
  it("decreases only the side to move", () => {
    assert.deepEqual(liveTimes(clock, "w", 1_500), {
      whiteMs: 598_500,
      blackMs: 600_000,
    });
    assert.deepEqual(liveTimes(clock, "b", 2_000), {
      whiteMs: 600_000,
      blackMs: 598_000,
    });
  });
});

describe("settleMove", () => {
  it("adds the increment after a move that still has time", () => {
    const settled = settleMove(clock, "w", 10_000);
    assert.equal(settled.flagged, false);
    if (settled.flagged) return;
    assert.equal(settled.whiteMs, 595_000);
    assert.equal(settled.blackMs, 600_000);
  });

  it("flags before applying the increment when time is already gone", () => {
    const short: StoredClock = { whiteMs: 1_000, blackMs: 600_000, incrementMs: 5_000 };
    const settled = settleMove(short, "w", 1_000);
    assert.deepEqual(settled, {
      flagged: true,
      winner: "black",
      whiteMs: 0,
      blackMs: 600_000,
    });
  });
});

describe("displayedClock", () => {
  it("shows the live active clock and the stored inactive clock", () => {
    assert.deepEqual(displayedClock(clock, "b", 1_000, 3_500), {
      whiteTime: 600_000,
      blackTime: 597_500,
    });
  });
});
