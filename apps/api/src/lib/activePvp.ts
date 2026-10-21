import { Game } from "../models/Game.js";

export async function hasActivePvp(userId: string): Promise<boolean> {
  const game = await Game.exists({
    gameType: "pvp",
    status: "in_progress",
    $or: [{ whitePlayer: userId }, { blackPlayer: userId }],
  });
  return game !== null;
}
