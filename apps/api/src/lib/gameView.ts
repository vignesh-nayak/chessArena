import type {
  GameSummary,
  GameView,
  Side,
} from "@chessarena/shared";
import { getFlags, stateFromSans } from "@chessarena/shared";
import type { GameDocument } from "../models/Game.js";

type PlayerRef = {
  id: string;
  username: string;
};

function lastMoveFromSans(
  moves: string[],
): { from: string; to: string } | null {
  if (moves.length === 0) return null;
  const rebuilt = stateFromSans(moves);
  if (!rebuilt.ok || !rebuilt.state.uciHistory?.length) return null;
  const uci = rebuilt.state.uciHistory[rebuilt.state.uciHistory.length - 1];
  if (!uci || uci.length < 4) return null;
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
}

function turnFromFen(fen: string): Side {
  return getFlags({ fen }).turn;
}

export function toGameView(
  game: GameDocument,
  white: PlayerRef,
): GameView {
  const rebuilt = stateFromSans(game.moves);
  const fen = rebuilt.ok ? rebuilt.state.fen : game.fen;
  const turn = rebuilt.ok ? rebuilt.flags.turn : turnFromFen(game.fen);

  return {
    id: game._id.toString(),
    fen,
    moves: game.moves,
    status: game.status as GameView["status"],
    result: game.result as GameView["result"],
    gameType: "ai",
    aiDifficulty: game.aiDifficulty as GameView["aiDifficulty"],
    turn,
    lastMove: lastMoveFromSans(game.moves),
    white: {
      id: white.id,
      username: white.username,
    },
    black: {
      id: "AI",
      username: "AI",
    },
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };
}

export function toGameSummary(game: GameDocument): GameSummary {
  return {
    id: game._id.toString(),
    status: game.status as GameSummary["status"],
    result: game.result as GameSummary["result"],
    gameType: "ai",
    aiDifficulty: game.aiDifficulty as GameSummary["aiDifficulty"],
    moveCount: game.moves.length,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };
}
