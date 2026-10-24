import assert from "node:assert/strict";
import { beforeEach, describe, it } from "@jest/globals";
import {
  consumeRateLimit,
  DEFAULT_USER_RATE_LIMIT,
  RATE_LIMIT_BLOCK_MS,
  RATE_LIMIT_WINDOW_MS,
  registerTestAccountUserId,
  resetUserRateLimit,
  setUserRateLimitNow,
  TEST_ACCOUNT_EMAIL,
  TEST_ACCOUNT_RATE_LIMIT,
} from "./userRateLimit.js";

beforeEach(() => {
  resetUserRateLimit();
});

describe("consumeRateLimit", () => {
  it("allows 20 requests per user per minute, then blocks that user and IP for one hour", () => {
    let now = 1_000_000;
    setUserRateLimitNow(() => now);

    for (let attempt = 0; attempt < DEFAULT_USER_RATE_LIMIT; attempt += 1) {
      assert.equal(
        consumeRateLimit({ userId: "user-a", ip: "203.0.113.8" }).ok,
        true,
      );
    }

    assert.equal(
      consumeRateLimit({ userId: "user-b", ip: "203.0.113.8" }).ok,
      true,
    );
    assert.equal(
      consumeRateLimit({ userId: "user-a", ip: "203.0.113.8" }).ok,
      false,
    );
    assert.equal(
      consumeRateLimit({ userId: "user-b", ip: "203.0.113.8" }).ok,
      false,
    );
    assert.equal(
      consumeRateLimit({ userId: "user-a", ip: "198.51.100.4" }).ok,
      false,
    );
    assert.equal(
      consumeRateLimit({ userId: "user-c", ip: "198.51.100.4" }).ok,
      true,
    );

    now += RATE_LIMIT_WINDOW_MS + 1;
    assert.equal(
      consumeRateLimit({ userId: "user-a", ip: "198.51.100.4" }).ok,
      false,
    );

    now += RATE_LIMIT_BLOCK_MS;
    assert.equal(
      consumeRateLimit({ userId: "user-a", ip: "198.51.100.4" }).ok,
      true,
    );
    assert.equal(
      consumeRateLimit({ userId: "user-b", ip: "203.0.113.8" }).ok,
      true,
    );
  });

  it("gives the test account 50 requests and shares that bucket across email and user id", () => {
    registerTestAccountUserId("test-user");

    for (let attempt = 0; attempt < 30; attempt += 1) {
      assert.equal(
        consumeRateLimit({ email: TEST_ACCOUNT_EMAIL, ip: "192.0.2.10" }).ok,
        true,
      );
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      assert.equal(
        consumeRateLimit({ userId: "test-user", ip: "192.0.2.11" }).ok,
        true,
      );
    }

    assert.equal(30 + 20, TEST_ACCOUNT_RATE_LIMIT);
    assert.equal(
      consumeRateLimit({ userId: "test-user", ip: "192.0.2.11" }).ok,
      false,
    );
    assert.equal(
      consumeRateLimit({
        email: "TestChess@gmail.com",
        ip: "192.0.2.10",
      }).ok,
      false,
    );
    assert.equal(
      consumeRateLimit({ email: "other@example.com", ip: "192.0.2.10" }).ok,
      true,
    );
  });

  it("starts a fresh minute window after 60 seconds when the user stayed under the limit", () => {
    let now = 5_000;
    setUserRateLimitNow(() => now);

    for (let attempt = 0; attempt < DEFAULT_USER_RATE_LIMIT; attempt += 1) {
      assert.equal(consumeRateLimit({ ip: "192.0.2.20" }).ok, true);
    }

    now += RATE_LIMIT_WINDOW_MS;
    assert.equal(consumeRateLimit({ ip: "192.0.2.20" }).ok, true);
  });
});
