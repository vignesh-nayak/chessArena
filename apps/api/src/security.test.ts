import assert from "node:assert/strict";
import { beforeEach, describe, it } from "@jest/globals";
import request from "supertest";
import { createApp } from "./app.js";
import { AUTH_RATE_LIMIT_MESSAGE, authRateLimit } from "./middleware/authRateLimit.js";

const app = createApp();

beforeEach(() => {
  authRateLimit.resetKey("127.0.0.1");
  authRateLimit.resetKey("::ffff:127.0.0.1");
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

describe("auth rate limit", () => {
  it("returns 429 on the sixth login attempt from one client", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = await request(app).post("/api/auth/login").send({});
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, "VALIDATION_ERROR");
    }

    const limited = await request(app).post("/api/auth/login").send({});
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error.code, "RATE_LIMITED");
    assert.equal(limited.body.error.message, AUTH_RATE_LIMIT_MESSAGE);
    assert.equal(
      limited.body.error.message,
      "Too many attempts — try again later.",
    );
  });
});
