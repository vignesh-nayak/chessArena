import type { GameResult } from "@chessarena/shared";
import type { GameDocument } from "../models/Game.js";
import { User } from "../models/User.js";
import { nextRating } from "./elo.js";

/**
 * Single completion path. PvP games update ELO; AI games update stats only.
 */
export async function completeGame(
  game: GameDocument,
  result: Exclude<GameResult, null>,
): Promise<GameDocument> {
  if (game.status === "completed") {
    return game;
  }

  game.status = "completed";
  game.result = result;
  await game.save();

  const whiteId = game.whitePlayer;
  const blackId = game.blackPlayer;
  if (game.gameType === "pvp" && blackId !== "AI") {
    await applyPvpResult(whiteId, blackId, result, game._id);
    return game;
  }

  await User.updateOne({ _id: whiteId }, { $inc: statsInc(scoreFor(result, "white")) });
  return game;
}

function scoreFor(
  result: Exclude<GameResult, null>,
  color: "white" | "black",
): number {
  if (result === "draw") return 0.5;
  return result === color ? 1 : 0;
}

function statsInc(score: number): Record<string, number> {
  if (score === 1) return { "stats.wins": 1 };
  if (score === 0) return { "stats.losses": 1 };
  return { "stats.draws": 1 };
}

async function applyPvpResult(
  whiteId: GameDocument["whitePlayer"],
  blackId: GameDocument["blackPlayer"],
  result: Exclude<GameResult, null>,
  gameId: GameDocument["_id"],
): Promise<void> {
  const [white, black] = await Promise.all([
    User.findById(whiteId),
    User.findById(blackId),
  ]);
  const whiteScore = scoreFor(result, "white");
  const blackScore = scoreFor(result, "black");

  if (!white || !black) {
    console.error(
      `[api] Skipping ELO for game ${gameId.toString()}; a player record is missing`,
    );
    if (white) {
      await User.updateOne({ _id: white._id }, { $inc: statsInc(whiteScore) });
    }
    if (black) {
      await User.updateOne({ _id: black._id }, { $inc: statsInc(blackScore) });
    }
    return;
  }

  const whiteRating = white.rating ?? 1200;
  const blackRating = black.rating ?? 1200;
  const whiteNext = nextRating(
    whiteRating,
    blackRating,
    whiteScore,
    white.ratingHistory?.length ?? 0,
  );
  const blackNext = nextRating(
    blackRating,
    whiteRating,
    blackScore,
    black.ratingHistory?.length ?? 0,
  );
  const ratedAt = new Date();

  await User.updateOne(
    { _id: white._id },
    {
      $inc: statsInc(whiteScore),
      $set: { rating: whiteNext },
      $push: {
        ratingHistory: { rating: whiteNext, date: ratedAt, gameId },
      },
    },
  );
  await User.updateOne(
    { _id: black._id },
    {
      $inc: statsInc(blackScore),
      $set: { rating: blackNext },
      $push: {
        ratingHistory: { rating: blackNext, date: ratedAt, gameId },
      },
    },
  );
}
