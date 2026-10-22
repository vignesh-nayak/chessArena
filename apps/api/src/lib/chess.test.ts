import assert from "node:assert/strict";
import { describe, it } from "@jest/globals";
import { solverBoardOrientation, START_FEN, tryMove } from "@chessarena/shared";

const BACK_RANK = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1";

describe("tryMove", () => {
  it("accepts the opening pawn move e2e4", () => {
    const result = tryMove({ fen: START_FEN }, "e2e4");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.san, "e4");
    assert.match(result.fen, /4P3/);
  });

  it("rejects the illegal pawn move e2e5", () => {
    const result = tryMove({ fen: START_FEN }, "e2e5");
    assert.deepEqual(result, { ok: false, reason: "illegal" });
  });

  it("recognizes a1a8 as checkmate on the back rank", () => {
    const result = tryMove({ fen: BACK_RANK }, "a1a8");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.flags.isCheckmate, true);
  });
});

describe("solverBoardOrientation", () => {
  it("keeps a normal white-to-move position with White at the bottom", () => {
    assert.equal(solverBoardOrientation(BACK_RANK, "w"), "white");
  });

  it("flips a normal black-to-move position so Black on rank 8 is at the bottom", () => {
    const scholar = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2";
    assert.equal(solverBoardOrientation(scholar, "b"), "black");
  });

  it("puts the 1560 mate-in-2 solver on the bottom even though Black is on rank 1", () => {
    const mateInTwo = "4K3/5PPP/8/8/8/8/4q3/r5k1 b - - 0 1";
    assert.equal(solverBoardOrientation(mateInTwo, "b"), "white");
  });

  it("falls back to the side to move when the halves are even", () => {
    assert.equal(solverBoardOrientation("not-a-fen", "b"), "black");
    assert.equal(solverBoardOrientation("not-a-fen", "w"), "white");
  });
});
