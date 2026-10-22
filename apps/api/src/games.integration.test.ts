import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it } from "@jest/globals";
import request from "supertest";
import type { MongoMemoryServer } from "mongodb-memory-server";
import { START_FEN, tryMove } from "@chessarena/shared";
import { createApp } from "./app.js";
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

describe("AI games", () => {
  it("records e2e4 as the SAN e4 and the position after that pawn move", async () => {
    const signup = await request(app).post("/api/auth/signup").send({
      username: "white_player",
      email: "white@example.com",
      password: "password1",
    });
    assert.equal(signup.status, 201);
    const token = signup.body.accessToken as string;

    const created = await request(app)
      .post("/api/games")
      .set("Authorization", `Bearer ${token}`)
      .send({ gameType: "ai", aiDifficulty: 1 });
    assert.equal(created.status, 201);
    assert.equal(created.body.fen, START_FEN);
    assert.deepEqual(created.body.moves, []);

    const moved = await request(app)
      .patch(`/api/games/${created.body.id}/move`)
      .set("Authorization", `Bearer ${token}`)
      .send({ move: "e2e4" });
    assert.equal(moved.status, 200);
    assert.deepEqual(moved.body.moves, ["e4"]);

    const expected = tryMove({ fen: START_FEN }, "e2e4");
    assert.equal(expected.ok, true);
    if (!expected.ok) return;
    assert.equal(moved.body.fen, expected.fen);
  });
});
