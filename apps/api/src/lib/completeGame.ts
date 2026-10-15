import type { GameResult } from "@chessarena/shared";
import type { GameDocument } from "../models/Game.js";
import { User } from "../models/User.js";

/**
 * Single completion path for AI games. W3-F01 can hook ELO here later.
 * Human is always White in Week 1 AI games.
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

  const userId = game.whitePlayer;
  if (result === "white") {
    await User.updateOne({ _id: userId }, { $inc: { "stats.wins": 1 } });
  } else if (result === "black") {
    await User.updateOne({ _id: userId }, { $inc: { "stats.losses": 1 } });
  } else {
    await User.updateOne({ _id: userId }, { $inc: { "stats.draws": 1 } });
  }

  return game;
}
