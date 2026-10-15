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

  if (game.whitePlayer.toString() !== userId) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "You are not a participant in this game",
    };
  }

  return { ok: true, game };
}

async function whitePlayerFor(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) return null;
  return { id: user._id.toString(), username: user.username };
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
  const white = await whitePlayerFor(userId);
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

  res.status(201).json(toGameView(game, white));
}));

gamesRouter.get("/history", asyncHandler(async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const games = await Game.find({ whitePlayer: userId }).sort({
    createdAt: -1,
  });

  res.status(200).json({
    items: games.map((g) => toGameSummary(g)),
    total: games.length,
  });
}));

gamesRouter.get("/:id", asyncHandler(async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const loaded = await loadParticipantGame(req.params.id ?? "", userId);
  if (!loaded.ok) {
    sendError(res, loaded.status, loaded.code, loaded.message);
    return;
  }

  const white = await whitePlayerFor(userId);
  if (!white) {
    sendError(res, 401, "UNAUTHORIZED", "User not found");
    return;
  }

  res.status(200).json(toGameView(loaded.game, white));
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
  const isAiBlackTurn =
    turn === "b" &&
    game.gameType === "ai" &&
    game.blackPlayer === "AI";

  if (turn === "w") {
    // Human (White) move — allowed.
  } else if (isAiBlackTurn) {
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

  const white = await whitePlayerFor(userId);
  if (!white) {
    sendError(res, 401, "UNAUTHORIZED", "User not found");
    return;
  }

  res.status(200).json(toGameView(game, white));
}));

gamesRouter.patch("/:id/resign", asyncHandler(async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const loaded = await loadParticipantGame(req.params.id ?? "", userId);
  if (!loaded.ok) {
    sendError(res, loaded.status, loaded.code, loaded.message);
    return;
  }

  const game = loaded.game;
  if (game.status !== "in_progress") {
    sendError(res, 409, "CONFLICT", "Game is already finished");
    return;
  }

  await completeGame(game, "black");

  const white = await whitePlayerFor(userId);
  if (!white) {
    sendError(res, 401, "UNAUTHORIZED", "User not found");
    return;
  }

  res.status(200).json(toGameView(game, white));
}));
