import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "@jest/globals";
import {
  dailyPuzzleIndex,
  gradePuzzle,
  normalizeLichessPuzzle,
  utcDateKey,
  validatePuzzleSeed,
  type PuzzleSeed,
} from "./puzzles.js";

const BACK_RANK = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1";

describe("dailyPuzzleIndex", () => {
  it("stays inside the puzzle set and is stable for a UTC date", () => {
    const first = dailyPuzzleIndex("2026-10-21", 60);
    assert.equal(first, dailyPuzzleIndex("2026-10-21", 60));
    assert.ok(first >= 0 && first < 60);
  });

  it("changes when the set size changes", () => {
    const date = "2026-10-21";
    const small = dailyPuzzleIndex(date, 7);
    const large = dailyPuzzleIndex(date, 60);
    assert.notEqual(small, large);
  });

  it("can pick a different puzzle on another UTC date", () => {
    const count = 50;
    const today = dailyPuzzleIndex("2026-10-21", count);
    const other = dailyPuzzleIndex("2026-01-01", count);
    assert.notEqual(today, other);
  });

  it("reads the UTC calendar day", () => {
    assert.equal(utcDateKey(new Date("2026-10-21T23:30:00.000Z")), "2026-10-21");
    assert.equal(utcDateKey(new Date("2026-10-21T00:30:00.000Z")), "2026-10-21");
  });
});

describe("gradePuzzle", () => {
  it("solves a one-move mate and rejects a different move", () => {
    const solved = gradePuzzle(BACK_RANK, ["Ra8#"], ["Ra8#"]);
    assert.equal(solved.status, "solved");
    if (solved.status === "solved") {
      assert.match(solved.fen, /^R5k1/);
    }

    const wrong = gradePuzzle(BACK_RANK, ["Ra8#"], ["Rb1"]);
    assert.equal(wrong.status, "incorrect");
  });

  it("accepts a non-canonical SAN that is the same move", () => {
    const solved = gradePuzzle(BACK_RANK, ["Ra8#"], ["Ra8"]);
    assert.equal(solved.status, "solved");
  });

  it("returns only the opponent reply on a matching prefix", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const solution = ["e4", "e5", "Nf3"];
    const step = gradePuzzle(fen, solution, ["e4"]);
    assert.equal(step.status, "continue");
    if (step.status === "continue") {
      assert.equal(step.reply?.san, "e5");
      assert.equal(step.reply?.from, "e7");
      assert.equal(step.reply?.to, "e5");
    }

    const solved = gradePuzzle(fen, solution, ["e4", "e5", "Nf3"]);
    assert.equal(solved.status, "solved");
  });

  it("does not reveal the solver's next move", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const hidden = gradePuzzle(fen, ["e4", "e5", "Nf3"], ["e4", "e5"]);
    assert.equal(hidden.status, "continue");
    if (hidden.status === "continue") {
      assert.equal(hidden.reply, null);
    }
  });

  it("accepts a normal seed and a legal mate-in-2", () => {
    assert.equal(
      validatePuzzleSeed({
        fen: BACK_RANK,
        solution: ["Ra8#"],
        rating: 900,
        theme: "back-rank",
      }),
      null,
    );
    const replacement = validatePuzzleSeed({
      fen: "4K3/5PPP/8/8/8/2q5/3r4/6k1 b - - 0 1",
      solution: ["Qe5+", "Kf8", "Rd8#"],
      rating: 1560,
      theme: "mate-in-2",
    });
    assert.equal(replacement, null);
    assert.equal(
      gradePuzzle(
        "4K3/5PPP/8/8/8/2q5/3r4/6k1 b - - 0 1",
        ["Qe5+", "Kf8", "Rd8#"],
        ["Qe5+", "Kf8", "Rd8#"],
      ).status,
      "solved",
    );
  });

  it("rejects a seed where the opponent is already in check", () => {
    assert.equal(
      validatePuzzleSeed({
        fen: "4K3/5PPP/8/8/8/8/4q3/r5k1 b - - 0 1",
        solution: ["Rd1+", "Kf8", "Rd8#"],
        rating: 1560,
        theme: "mate-in-2",
      }),
      "Opponent is already in check at puzzle start",
    );
  });

  it("accepts every curated puzzle", () => {
    const puzzles = JSON.parse(
      readFileSync(new URL("../data/puzzles.json", import.meta.url), "utf8"),
    ) as PuzzleSeed[];
    const problems = puzzles.flatMap((puzzle, index) => {
      const problem = validatePuzzleSeed(puzzle);
      return problem ? [`${index + 1}: ${problem}`] : [];
    });
    assert.deepEqual(problems, []);
  });

  it("keeps an odd Lichess UCI line as the solver line", () => {
    const normalized = normalizeLichessPuzzle({
      fen: BACK_RANK,
      solution: ["a1a8"],
      themes: ["endgame", "backRank"],
    });
    assert.ok(normalized);
    if (!normalized) return;
    assert.equal(normalized.fen, BACK_RANK);
    assert.deepEqual(normalized.solution, ["Ra8#"]);
    assert.equal(normalized.theme, "backRank");
    assert.equal(
      validatePuzzleSeed({ ...normalized, rating: 1200 }),
      null,
    );
  });

  it("plays a leading Lichess setup move before the solver line", () => {
    const start = "6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1";
    const normalized = normalizeLichessPuzzle({
      fen: start,
      solution: ["h7h6", "a1a8"],
      themes: ["middlegame", "advantage", "mate"],
    });
    assert.ok(normalized);
    if (!normalized) return;
    assert.notEqual(normalized.fen, start);
    assert.deepEqual(normalized.solution, ["Ra8+"]);
    assert.equal(normalized.theme, "mate");
    assert.equal(validatePuzzleSeed({ ...normalized, rating: 900 }), null);
    assert.equal(
      gradePuzzle(normalized.fen, normalized.solution, ["Ra8+"]).status,
      "solved",
    );
  });

  it("rejects an illegal Lichess line", () => {
    assert.equal(
      normalizeLichessPuzzle({
        fen: BACK_RANK,
        solution: ["e2e4"],
        themes: ["mate"],
      }),
      null,
    );
  });

  it("rejects an illegal or overlong line", () => {
    assert.equal(
      gradePuzzle(BACK_RANK, ["Ra8#"], ["Qh5"]).status,
      "incorrect",
    );
    assert.equal(
      gradePuzzle(BACK_RANK, ["Ra8#"], ["Ra8#", "Kh7"]).status,
      "incorrect",
    );
  });
});
