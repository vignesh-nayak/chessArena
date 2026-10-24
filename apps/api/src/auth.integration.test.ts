import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it } from "@jest/globals";
import request from "supertest";
import type { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "./app.js";
import { ensureTestAccount } from "./lib/ensureTestAccount.js";
import { TEST_ACCOUNT_EMAIL } from "./middleware/userRateLimit.js";
import { User } from "./models/User.js";
import { resetAuthRateLimit, startMemoryMongo, stopMemoryMongo } from "./test/mongo.js";

const app = createApp();
let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await startMemoryMongo();
});

afterAll(async () => {
  await stopMemoryMongo(mongo);
});

beforeEach(() => {
  resetAuthRateLimit();
});

describe("signup and login", () => {
  it("returns the signed-up user from GET /api/users/me", async () => {
    const username = "ada_lovelace";
    const email = "ada@example.com";
    const password = "password1";

    const signup = await request(app)
      .post("/api/auth/signup")
      .send({ username, email, password });
    assert.equal(signup.status, 201);
    assert.equal(signup.body.user.username, username);
    assert.equal(typeof signup.body.accessToken, "string");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.username, username);

    const me = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.username, username);
  });

  it("logs in with the seeded test account and does not create a second one", async () => {
    await ensureTestAccount();
    await ensureTestAccount();

    const login = await request(app).post("/api/auth/login").send({
      email: TEST_ACCOUNT_EMAIL,
      password: TEST_ACCOUNT_EMAIL,
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.email, TEST_ACCOUNT_EMAIL);
    assert.equal(login.body.user.username, "testchess");

    const again = await request(app).post("/api/auth/login").send({
      email: TEST_ACCOUNT_EMAIL,
      password: TEST_ACCOUNT_EMAIL,
    });
    assert.equal(again.status, 200);
    assert.equal(again.body.user.id, login.body.user.id);
    assert.equal(await User.countDocuments({ email: TEST_ACCOUNT_EMAIL }), 1);
  });
});
