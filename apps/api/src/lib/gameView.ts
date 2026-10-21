import type { GameSummary, GameView, Side } from "@chessarena/shared";
import { getFlags, stateFromSans } from "@chessarena/shared";
import type { GameDocument } from "../models/Game.js";

type PlayerRef = {
  id: string;
  username: string;
};

function lastMoveFromSans(
  moves: string[],
): { from: string; to: string; promotion?: "q" | "r" | "b" | "n" } | null {
  if (moves.length === 0) return null;
  const rebuilt = stateFromSans(moves);
  if (!rebuilt.ok || !rebuilt.state.uciHistory?.length) return null;
  const uci = rebuilt.state.uciHistory[rebuilt.state.uciHistory.length - 1];
  if (!uci || uci.length < 4) return null;
  const promo = uci.slice(4, 5);
  const promotion =
    promo === "q" || promo === "r" || promo === "b" || promo === "n"
      ? promo
      : undefined;
  return promotion
    ? { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion }
    : { from: uci.slice(0, 2), to: uci.slice(2, 4) };
}

function turnFromFen(fen: string): Side {
  return getFlags({ fen }).turn;
}

export function toGameView(
  game: GameDocument,
  players: { white: PlayerRef; black: PlayerRef },
): GameView {
  const rebuilt = stateFromSans(game.moves);
  const fen = rebuilt.ok ? rebuilt.state.fen : game.fen;
  const turn = rebuilt.ok ? rebuilt.flags.turn : turnFromFen(game.fen);
  const shared = {
    id: game._id.toString(),
    fen,
    moves: game.moves,
    status: game.status as GameView["status"],
    result: game.result as GameView["result"],
    turn,
    lastMove: lastMoveFromSans(game.moves),
    white: players.white,
    black: players.black,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };

  if (game.gameType === "pvp") {
    return {
      ...shared,
      gameType: "pvp",
      aiDifficulty: null,
    };
  }

  return {
    ...shared,
    gameType: "ai",
    aiDifficulty: game.aiDifficulty as 1 | 2 | 3,
  };
}

export function toGameSummary(game: GameDocument): GameSummary {
  const shared = {
    id: game._id.toString(),
    status: game.status as GameSummary["status"],
    result: game.result as GameSummary["result"],
    moveCount: game.moves.length,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };

  if (game.gameType === "pvp") {
    return {
      ...shared,
      gameType: "pvp",
      aiDifficulty: null,
    };
  }

  return {
    ...shared,
    gameType: "ai",
    aiDifficulty: game.aiDifficulty as 1 | 2 | 3,
  };
}
