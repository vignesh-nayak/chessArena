import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { expectedScore, kFactor, nextRating } from "./elo.js";

describe("kFactor", () => {
  it("stays 32 until 30 rated games are on record", () => {
    assert.equal(kFactor(0), 32);
    assert.equal(kFactor(29), 32);
    assert.equal(kFactor(30), 16);
  });
});

describe("nextRating", () => {
  it("moves equal ratings by K/2 on a win", () => {
    assert.equal(expectedScore(1200, 1200), 0.5);
    assert.equal(nextRating(1200, 1200, 1, 0), 1216);
    assert.equal(nextRating(1200, 1200, 0, 0), 1184);
  });

  it("uses K=16 once 30 games are recorded", () => {
    assert.equal(nextRating(1200, 1200, 1, 30), 1208);
    assert.equal(nextRating(1200, 1200, 0, 30), 1192);
  });

  it("leaves both players unchanged on an equal draw", () => {
    assert.equal(nextRating(1200, 1200, 0.5, 0), 1200);
    assert.equal(nextRating(1200, 1200, 0.5, 30), 1200);
  });

  it("covers a win, draw, and loss between 1200 and 1400", () => {
    assert.equal(nextRating(1200, 1400, 1, 0), 1224);
    assert.equal(nextRating(1400, 1200, 0, 0), 1376);
    assert.equal(nextRating(1200, 1400, 0.5, 0), 1208);
    assert.equal(nextRating(1400, 1200, 0.5, 0), 1392);
    assert.equal(nextRating(1200, 1400, 0, 0), 1192);
    assert.equal(nextRating(1400, 1200, 1, 0), 1408);
  });

  it("does not drop below zero", () => {
    assert.equal(nextRating(0, 0, 0, 0), 0);
  });
});
