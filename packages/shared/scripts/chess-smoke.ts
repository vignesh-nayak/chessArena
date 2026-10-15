import assert from "node:assert/strict";
import {
  START_FEN,
  createGame,
  getFlags,
  getLegalMoves,
  tryMove,
  type GameState,
} from "../src/chess.js";

function play(state: GameState, uci: string): GameState {
  const result = tryMove(state, uci);
  assert.equal(result.ok, true, `Expected ok move ${uci}, got ${JSON.stringify(result)}`);
  return { fen: result.fen, uciHistory: result.uciHistory };
}

function playMany(state: GameState, moves: string[]): GameState {
  let current = state;
  for (const uci of moves) {
    current = play(current, uci);
  }
  return current;
}

const start = createGame(START_FEN);
assert.equal(start.ok, true);
const startState: GameState = start.ok ? start.state : { fen: START_FEN };

// invalid FEN
assert.deepEqual(createGame("not a fen"), { ok: false, reason: "invalid_fen" });
// illegal move
assert.deepEqual(tryMove(startState, "e2e5"), { ok: false, reason: "illegal" });

// scholar's mate
let state = playMany(startState, ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"]);
{
  const game = createGame(state.fen);
  assert.equal(game.ok, true);
  if (game.ok) assert.equal(game.flags.isCheckmate, true);
}

// fool's mate
state = playMany(startState, ["f2f3", "e7e5", "g2g4", "d8h4"]);
{
  const game = createGame(state.fen);
  assert.equal(game.ok, true);
  if (game.ok) assert.equal(game.flags.isCheckmate, true);
}

// stalemate
const stalemateFen = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1";
assert.equal(createGame(stalemateFen).flags.isStalemate, true);

// insufficient material
const insufficientFen = "k7/8/1K6/8/8/8/8/8 w - - 0 1";
assert.equal(createGame(insufficientFen).flags.isDraw, true);
assert.equal(createGame(insufficientFen).flags.drawReason, "insufficient_material");

// fifty-move rule position (chess.js recognizes draw)
const fiftyFen = "4k3/8/8/8/8/8/8/4K2R w - - 100 50";
assert.equal(createGame(fiftyFen).flags.isDraw, true);
assert.equal(createGame(fiftyFen).flags.drawReason, "fifty_move");

// threefold repetition
state = startState;
state = play(state, "g1f3");
state = play(state, "g8f6");
state = play(state, "f3g1");
state = play(state, "f6g8");
state = play(state, "g1f3");
state = play(state, "g8f6");
state = play(state, "f3g1");
state = play(state, "f6g8");
assert.equal(getFlags(state).isDraw, true);
assert.equal(getFlags(state).drawReason, "threefold_repetition");
assert.deepEqual(tryMove(state, "g1f3"), { ok: false, reason: "game_over" });

// castling
state = playMany(startState, [
  "e2e4",
  "e7e5",
  "g1f3",
  "b8c6",
  "f1c4",
  "f8c5",
  "e1g1",
]);
assert.match(createGame(state.fen).state.fen, /RNBQ1RK1/);

// en passant
state = playMany(startState, ["e2e4", "a7a6", "e4e5", "d7d5"]);
state = play(state, "e5d6");
assert.match(createGame(state.fen).state.fen, /p2P4/);

// promotion without piece rejected
state = playMany(startState, ["b2b4", "a7a5", "b4a5", "h7h6", "a5a6", "h6h5", "a6a7", "h5h4"]);
assert.deepEqual(tryMove(state, "a7b8"), { ok: false, reason: "illegal" });

// promotion with piece
const promoted = tryMove(state, "a7b8q");
assert.equal(promoted.ok, true);
if (promoted.ok) {
  assert.match(promoted.san, /=/);
}

// move after mate
const mateState = playMany(startState, ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"]);
assert.deepEqual(tryMove(mateState, "e8e7"), { ok: false, reason: "game_over" });

// getLegalMoves promotion flag
const promoTargets = getLegalMoves(state, "a7");
assert.ok(promoTargets.some((t) => t.to === "b8" && t.promotion));

console.log("chess-smoke: all checks passed");
