import { Chess, type Square } from "chess.js";

export type Side = "w" | "b";

export type DrawReason =
  | "stalemate"
  | "insufficient_material"
  | "threefold_repetition"
  | "fifty_move";

export type GameState = {
  fen: string;
  /** When set, replays from start so threefold repetition is detected. */
  uciHistory?: string[];
};

export type GameFlags = {
  inCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  turn: Side;
  drawReason?: DrawReason;
  checkSquare: string | null;
  isGameOver: boolean;
};

export type LegalMoveTarget = {
  to: string;
  capture: boolean;
  promotion: boolean;
};

export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type CreateGameResult =
  | { ok: true; state: GameState; flags: GameFlags }
  | { ok: false; reason: "invalid_fen" };

export type TryMoveResult =
  | {
      ok: true;
      fen: string;
      san: string;
      from: string;
      to: string;
      flags: GameFlags;
      uciHistory: string[];
    }
  | { ok: false; reason: "illegal" | "game_over" };

function findKingSquare(chess: Chess, color: Side): string | null {
  const board = chess.board();
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank]?.[file];
      if (piece?.type === "k" && piece.color === color) {
        return `${String.fromCharCode(97 + file)}${8 - rank}`;
      }
    }
  }
  return null;
}

function drawReasonFromChess(chess: Chess): DrawReason | undefined {
  if (chess.isStalemate()) return "stalemate";
  if (chess.isInsufficientMaterial()) return "insufficient_material";
  if (chess.isThreefoldRepetition()) return "threefold_repetition";
  if (chess.isDrawByFiftyMoves()) return "fifty_move";
  return undefined;
}

function buildFlags(chess: Chess): GameFlags {
  const turn = chess.turn();
  const inCheck = chess.isCheck();
  const isDraw = chess.isDraw();
  return {
    inCheck,
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isDraw,
    turn,
    drawReason: isDraw ? drawReasonFromChess(chess) : undefined,
    checkSquare: inCheck ? findKingSquare(chess, turn) : null,
    isGameOver: chess.isGameOver(),
  };
}

function loadChess(fen: string): Chess | null {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

function buildChess(state: GameState): Chess | null {
  if (state.uciHistory && state.uciHistory.length > 0) {
    const chess = new Chess();
    for (const uci of state.uciHistory) {
      const parsed = parseUci(uci);
      if (!parsed) return null;
      try {
        chess.move({
          from: parsed.from as Square,
          to: parsed.to as Square,
          promotion: parsed.promotion,
        });
      } catch {
        return null;
      }
    }
    if (chess.fen() !== state.fen) {
      return loadChess(state.fen);
    }
    return chess;
  }
  return loadChess(state.fen);
}

export function createGame(fen: string = START_FEN): CreateGameResult {
  const chess = loadChess(fen);
  if (!chess) {
    return { ok: false, reason: "invalid_fen" };
  }
  return {
    ok: true,
    state: { fen: chess.fen(), uciHistory: [] },
    flags: buildFlags(chess),
  };
}

export function getFlags(state: GameState): GameFlags {
  const chess = buildChess(state);
  if (!chess) {
    return {
      inCheck: false,
      isCheckmate: false,
      isStalemate: false,
      isDraw: false,
      turn: "w",
      checkSquare: null,
      isGameOver: true,
    };
  }
  return buildFlags(chess);
}

export function getLegalMoves(
  state: GameState,
  square: string,
): LegalMoveTarget[] {
  const chess = buildChess(state);
  if (!chess || chess.isGameOver()) {
    return [];
  }
  const moves = chess.moves({ square: square as Square, verbose: true });
  return moves.map((move) => ({
    to: move.to,
    capture: Boolean(move.captured),
    promotion: Boolean(move.promotion),
  }));
}

export function getPieceColor(
  state: GameState,
  square: string,
): Side | null {
  const chess = buildChess(state);
  if (!chess) return null;
  const piece = chess.get(square as Square);
  return piece?.color ?? null;
}

function colorOrientation(side: Side): "white" | "black" {
  return side === "b" ? "black" : "white";
}

/**
 * Orientation that puts the solver's pieces at the bottom.
 * "white" keeps rank 1 at the bottom; "black" keeps rank 8 there.
 * Puzzle FENs sometimes place the side to move on the other half of the board.
 */
export function solverBoardOrientation(
  fen: string,
  side: Side,
): "white" | "black" {
  const placement = fen.trim().split(/\s+/)[0] ?? "";
  const ranks = placement.split("/");
  if (ranks.length !== 8) return colorOrientation(side);

  let solverRankSum = 0;
  let solverCount = 0;
  let opponentRankSum = 0;
  let opponentCount = 0;

  for (let index = 0; index < ranks.length; index += 1) {
    const rankNumber = 8 - index;
    for (const char of ranks[index] ?? "") {
      if (char >= "1" && char <= "8") continue;
      if (!/[prnbqk]/i.test(char)) continue;
      const pieceSide: Side = char === char.toUpperCase() ? "w" : "b";
      if (pieceSide === side) {
        solverRankSum += rankNumber;
        solverCount += 1;
      } else {
        opponentRankSum += rankNumber;
        opponentCount += 1;
      }
    }
  }

  if (solverCount === 0 || opponentCount === 0) return colorOrientation(side);

  const solverAvg = solverRankSum / solverCount;
  const opponentAvg = opponentRankSum / opponentCount;
  if (solverAvg === opponentAvg) return colorOrientation(side);
  return solverAvg < opponentAvg ? "white" : "black";
}

type ParsedUci = {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
};

function parseUci(uci: string): ParsedUci | null {
  const trimmed = uci.trim().toLowerCase();
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(trimmed)) {
    return null;
  }
  const from = trimmed.slice(0, 2);
  const to = trimmed.slice(2, 4);
  const promo = trimmed.slice(4);
  if (promo && !["q", "r", "b", "n"].includes(promo)) {
    return null;
  }
  return {
    from,
    to,
    promotion: promo ? (promo as "q" | "r" | "b" | "n") : undefined,
  };
}

function moveRequiresPromotion(
  chess: Chess,
  from: string,
  to: string,
): boolean {
  const moves = chess.moves({ square: from as Square, verbose: true });
  return moves.some((move) => move.to === to && Boolean(move.promotion));
}

export function tryMove(state: GameState, uci: string): TryMoveResult {
  const chess = buildChess(state);
  if (!chess) {
    return { ok: false, reason: "illegal" };
  }

  if (chess.isGameOver()) {
    return { ok: false, reason: "game_over" };
  }

  const parsed = parseUci(uci);
  if (!parsed) {
    return { ok: false, reason: "illegal" };
  }

  const { from, to, promotion } = parsed;

  if (moveRequiresPromotion(chess, from, to) && !promotion) {
    return { ok: false, reason: "illegal" };
  }

  let move;
  try {
    move = chess.move({
      from: from as Square,
      to: to as Square,
      promotion,
    });
  } catch {
    return { ok: false, reason: "illegal" };
  }

  if (!move) {
    return { ok: false, reason: "illegal" };
  }

  const uciHistory = [...(state.uciHistory ?? []), uci.trim().toLowerCase()];

  return {
    ok: true,
    fen: chess.fen(),
    san: move.san,
    from: move.from,
    to: move.to,
    flags: buildFlags(chess),
    uciHistory,
  };
}

export function toUci(from: string, to: string, promotion?: string): string {
  return `${from}${to}${promotion ?? ""}`.toLowerCase();
}

export type StateFromSansResult =
  | { ok: true; state: GameState; flags: GameFlags }
  | { ok: false; reason: "illegal" };

/**
 * Replay persisted SAN moves from the start so threefold repetition works
 * when only SAN is stored on the Game document.
 */
export function stateFromSans(moves: string[]): StateFromSansResult {
  const chess = new Chess();
  const uciHistory: string[] = [];

  for (const san of moves) {
    let move;
    try {
      move = chess.move(san);
    } catch {
      return { ok: false, reason: "illegal" };
    }
    if (!move) {
      return { ok: false, reason: "illegal" };
    }
    const promo = move.promotion ?? "";
    uciHistory.push(`${move.from}${move.to}${promo}`.toLowerCase());
  }

  return {
    ok: true,
    state: { fen: chess.fen(), uciHistory },
    flags: buildFlags(chess),
  };
}

export type ReplayedPly = {
  san: string;
  from: string;
  to: string;
  promotion?: string;
};

export type ReplaySansResult =
  | { ok: true; fen: string; moves: ReplayedPly[]; turn: Side }
  | { ok: false; reason: "invalid_fen" | "illegal" };

/**
 * Apply SAN moves starting from `fen`. Returned SAN is chess.js canonical
 * form, so `Nf3` and `Nf3+` compare equal after a replay.
 */
export function replaySans(fen: string, moves: string[]): ReplaySansResult {
  const chess = loadChess(fen);
  if (!chess) {
    return { ok: false, reason: "invalid_fen" };
  }

  const played: ReplayedPly[] = [];
  for (const san of moves) {
    let move;
    try {
      move = chess.move(san);
    } catch {
      return { ok: false, reason: "illegal" };
    }
    if (!move) {
      return { ok: false, reason: "illegal" };
    }
    const ply: ReplayedPly = {
      san: move.san,
      from: move.from,
      to: move.to,
    };
    if (move.promotion) {
      ply.promotion = move.promotion;
    }
    played.push(ply);
  }

  return {
    ok: true,
    fen: chess.fen(),
    moves: played,
    turn: chess.turn(),
  };
}
