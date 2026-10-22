import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import jwt from "jsonwebtoken";
import { signAccessToken, signRefreshToken, verifyAccessToken } from "./tokens.js";

describe("access tokens", () => {
  it("round-trips a signed access token", () => {
    const token = signAccessToken("user-1");
    assert.deepEqual(verifyAccessToken(token), { sub: "user-1", typ: "access" });
  });

  it("rejects a garbage string", () => {
    assert.throws(() => verifyAccessToken("not-a-token"));
  });

  it("rejects a refresh token presented as an access token", () => {
    const token = signRefreshToken("user-1");
    assert.throws(() => verifyAccessToken(token));
  });

  it("rejects an access token that is already expired", () => {
    const token = jwt.sign(
      { sub: "user-1", typ: "access" },
      process.env.JWT_ACCESS_SECRET ?? "",
      { expiresIn: -1 },
    );
    assert.throws(() => verifyAccessToken(token));
  });
});
