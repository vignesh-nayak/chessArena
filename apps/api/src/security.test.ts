import assert from "node:assert/strict";
import { beforeEach, describe, it } from "@jest/globals";
import request from "supertest";
import { createApp } from "./app.js";
import {
  resetUserRateLimit,
  USER_RATE_LIMIT_MESSAGE,
} from "./middleware/userRateLimit.js";

const app = createApp();

beforeEach(() => {
  resetUserRateLimit();
});

describe("protected routes", () => {
  for (const path of [
    "/api/users/me",
    "/api/puzzles/daily",
    "/api/games/history",
  ]) {
    it(`rejects ${path} with no token`, async () => {
      const res = await request(app).get(path);
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, "UNAUTHORIZED");
    });

    it(`rejects ${path} with a bad token`, async () => {
      const res = await request(app).get(path).set("Authorization", "Bearer not-a-token");
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, "UNAUTHORIZED");
    });
  }
});

describe("user rate limit", () => {
  it("returns 429 on the 21st login attempt from one client and keeps blocking", async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const res = await request(app).post("/api/auth/login").send({});
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, "VALIDATION_ERROR");
    }

    const limited = await request(app).post("/api/auth/login").send({});
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error.code, "RATE_LIMITED");
    assert.equal(limited.body.error.message, USER_RATE_LIMIT_MESSAGE);
    assert.equal(
      limited.body.error.message,
      "too many request from this user, blocked for 1hour",
    );

    const stillBlocked = await request(app).post("/api/auth/login").send({});
    assert.equal(stillBlocked.status, 429);
    assert.equal(stillBlocked.body.error.message, USER_RATE_LIMIT_MESSAGE);
  });

  it("does not count game or puzzle routes, even after the client is blocked", async () => {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const puzzle = await request(app).get("/api/puzzles/daily");
      assert.equal(puzzle.status, 401);
      const history = await request(app).get("/api/games/history");
      assert.equal(history.status, 401);
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const res = await request(app).post("/api/auth/login").send({});
      assert.equal(res.status, 400);
    }
    const limited = await request(app).post("/api/auth/login").send({});
    assert.equal(limited.status, 429);

    const puzzle = await request(app).get("/api/puzzles/daily");
    assert.equal(puzzle.status, 401);
    const history = await request(app).get("/api/games/history");
    assert.equal(history.status, 401);
  });
});
