import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { mongoDatabaseName } from "./mongoDatabase.js";

describe("mongoDatabaseName", () => {
  it("uses prod only when NODE_ENV is production", () => {
    assert.equal(mongoDatabaseName("production"), "prod");
  });

  it("uses test for local dev and the test runner", () => {
    assert.equal(mongoDatabaseName(undefined), "test");
    assert.equal(mongoDatabaseName("test"), "test");
    assert.equal(mongoDatabaseName("development"), "test");
  });
});
