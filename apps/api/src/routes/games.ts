import {
  CreateGameBodySchema,
  MoveBodySchema,
  START_FEN,
  stateFromSans,
  tryMove,
  type GameResult,
} from "@chessarena/shared";
import { Router } from "express";
import mongoose from "mongoose";
import { completeGame } from "../lib/completeGame.js";
import { asyncHandler, sendError } from "../lib/errors.js";
import { toGameSummary, toGameView } from "../lib/gameView.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/requireAuth.js";
import { Game, type GameDocument } from "../models/Game.js";
import { User } from "../models/User.js";

export const gamesRouter = Router();

gamesRouter.use(requireAuth);

function playerId(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toString" in value) {
    return String(value);
  }
  return "";
}

async function loadParticipantGame(
  gameId: string,
  userId: string,
): Promise<
  | { ok: true; game: GameDocument }
  | {
      ok: false;
      status: 404 | 403;
      code: "NOT_FOUND" | "FORBIDDEN";
      message: string;
    }
> {
  if (!mongoose.isValidObjectId(gameId)) {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: "Game not found",
    };
  }

  const game = await Game.findById(gameId);
  if (!game) {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: "Game not found",
    };
  }

  const whiteId = playerId(game.whitePlayer);
  const blackId = playerId(game.blackPlayer);
  if (whiteId !== userId && blackId !== userId) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "You are not a participant in this game",
    };
  }

  return { ok: true, game };
}

const aiPlayer = { id: "AI", username: "AI", rating: null };

async function playerFor(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) return null;
  return {
    id: user._id.toString(),
    username: user.username,
    rating: user.rating ?? 1200,
  };
}

async function playersFor(game: GameDocument) {
  const white = await playerFor(playerId(game.whitePlayer));
  if (!white) return null;
  if (game.gameType === "ai" || game.blackPlayer === "AI") {
    return { white, black: aiPlayer };
  }
  const black = await playerFor(playerId(game.blackPlayer));
  if (!black) return null;
  return { white, black };
}

gamesRouter.post("/", asyncHandler(async (req, res) => {
  const parsed = CreateGameBodySchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(
      res,
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid request body",
    );
    return;
  }

  const { userId } = req as AuthenticatedRequest;
  const white = await playerFor(userId);
  if (!white) {
    sendError(res, 401, "UNAUTHORIZED", "User not found");
    return;
  }

  const game = await Game.create({
    whitePlayer: userId,
    blackPlayer: "AI",
    moves: [],
    fen: START_FEN,
    status: "in_progress",
    result: null,
    gameType: "ai",
    aiDifficulty: parsed.data.aiDifficulty,
  });

  res.status(201).json(
    toGameView(game, { white, black: aiPlayer }),
  );
}));

gamesRouter.get("/history", asyncHandler(async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const games = await Game.find({
    $or: [{ whitePlayer: userId }, { blackPlayer: userId }],
  }).sort({ updatedAt: -1 });

  const items = [];
  for (const game of games) {
    const players = await playersFor(game);
    if (!players) continue;
    items.push(toGameSummary(game, players));
  }

  res.status(200).json({
    items,
    total: items.length,
  });
}));

gamesRouter.get("/live", asyncHandler(async (_req, res) => {
  const games = await Game.find({
    gameType: "pvp",
    status: "in_progress",
  })
    .sort({ updatedAt: -1 })
    .limit(20);

  const items = [];
  for (const game of games) {
    const players = await playersFor(game);
    if (!players) continue;
    items.push({
      id: game._id.toString(),
      white: players.white,
      black: players.black,
      moveCount: game.moves.length,
    });
  }

  res.status(200).json({ items });
}));

gamesRouter.get("/:id/replay", asyncHandler(async (req, res) => {
  const gameId = req.params.id ?? "";
  if (!mongoose.isValidObjectId(gameId)) {
    sendError(res, 404, "NOT_FOUND", "Game not found");
    return;
  }

  const game = await Game.findById(gameId);
  if (!game) {
    sendError(res, 404, "NOT_FOUND", "Game not found");
    return;
  }
  if (game.status === "in_progress") {
    sendError(res, 409, "CONFLICT", "This game is still in progress");
    return;
  }

  if (!stateFromSans(game.moves).ok) {
    sendError(res, 500, "INTERNAL", "Stored game moves are invalid");
    return;
  }

  const players = await playersFor(game);
  if (!players) {
    sendError(res, 401, "UNAUTHORIZED", "User not found");
    return;
  }

  res.status(200).json({
    id: game._id.toString(),
    whitePlayer: players.white,
    blackPlayer: players.black,
    moves: game.moves,
    result: game.result,
    status: game.status,
    gameType: game.gameType,
    aiDifficulty: game.gameType === "ai" ? game.aiDifficulty : null,
    createdAt: game.createdAt.toISOString(),
  });
}));

gamesRouter.get("/:id", asyncHandler(async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const gameId = req.params.id ?? "";
  if (!mongoose.isValidObjectId(gameId)) {
    sendError(res, 404, "NOT_FOUND", "Game not found");
    return;
  }

  const game = await Game.findById(gameId);
  if (!game) {
    sendError(res, 404, "NOT_FOUND", "Game not found");
    return;
  }

  if (game.gameType !== "pvp") {
    const whiteId = playerId(game.whitePlayer);
    const blackId = playerId(game.blackPlayer);
    if (whiteId !== userId && blackId !== userId) {
      sendError(res, 403, "FORBIDDEN", "You are not a participant in this game");
      return;
    }
  }

  const players = await playersFor(game);
  if (!players) {
    sendError(res, 401, "UNAUTHORIZED", "User not found");
    return;
  }

  res.status(200).json(toGameView(game, players));
}));

gamesRouter.patch("/:id/move", asyncHandler(async (req, res) => {
  const parsed = MoveBodySchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(
      res,
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid request body",
    );
    return;
  }

  const { userId } = req as unknown as AuthenticatedRequest;
  const loaded = await loadParticipantGame(req.params.id ?? "", userId);
  if (!loaded.ok) {
    sendError(res, loaded.status, loaded.code, loaded.message);
    return;
  }

  const game = loaded.game;
  if (game.gameType === "pvp") {
    sendError(res, 409, "CONFLICT", "Play this game over the live connection");
    return;
  }
  if (game.status !== "in_progress") {
    sendError(res, 409, "CONFLICT", "Game is already finished");
    return;
  }

  const rebuilt = stateFromSans(game.moves);
  if (!rebuilt.ok) {
    sendError(res, 500, "INTERNAL", "Stored game moves are invalid");
    return;
  }

  const turn = rebuilt.flags.turn;
  if (turn === "w") {
    // Human (White) move — allowed.
  } else if (turn === "b" && game.blackPlayer === "AI") {
    // Client proposes Stockfish UCI for AI; still validated below.
  } else {
    sendError(res, 409, "OUT_OF_TURN", "It is not your turn");
    return;
  }

  const moveResult = tryMove(rebuilt.state, parsed.data.move);
  if (!moveResult.ok) {
    if (moveResult.reason === "game_over") {
      sendError(res, 409, "CONFLICT", "Game is already finished");
      return;
    }
    sendError(res, 400, "ILLEGAL_MOVE", "Illegal move");
    return;
  }

  game.moves = [...game.moves, moveResult.san];
  game.fen = moveResult.fen;
  await game.save();

  if (moveResult.flags.isCheckmate) {
    // After the move, turn is the mated side.
    const result: Exclude<GameResult, null> =
      moveResult.flags.turn === "b" ? "white" : "black";
    await completeGame(game, result);
  } else if (moveResult.flags.isDraw || moveResult.flags.isStalemate) {
    await completeGame(game, "draw");
  }

  const players = await playersFor(game);
  if (!players) {
    sendError(res, 401, "UNAUTHORIZED", "User not found");
    return;
  }

  res.status(200).json(toGameView(game, players));
}));

gamesRouter.patch("/:id/resign", asyncHandler(async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const loaded = await loadParticipantGame(req.params.id ?? "", userId);
  if (!loaded.ok) {
    sendError(res, loaded.status, loaded.code, loaded.message);
    return;
  }

  const game = loaded.game;
  if (game.gameType === "pvp") {
    sendError(res, 409, "CONFLICT", "Resign from the live game");
    return;
  }
  if (game.status !== "in_progress") {
    sendError(res, 409, "CONFLICT", "Game is already finished");
    return;
  }

  await completeGame(game, "black");

  const players = await playersFor(game);
  if (!players) {
    sendError(res, 401, "UNAUTHORIZED", "User not found");
    return;
  }

  res.status(200).json(toGameView(game, players));
}));
