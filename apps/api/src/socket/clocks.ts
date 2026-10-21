import { clockFromControl, displayedClock, type ClockSide } from "../lib/clock.js";
import { Game } from "../models/Game.js";

type ArmedClock = {
  turnStartedAt: number;
};

const armed = new Map<string, ArmedClock>();

type ClockGame = {
  _id: { toString(): string };
  status: string;
  gameType: string;
  timeControl?: { initial: number; increment: number } | null;
  whiteTimeRemaining?: number | null;
  blackTimeRemaining?: number | null;
};

export function armClock(gameId: string, now = Date.now()): void {
  if (armed.has(gameId)) return;
  armed.set(gameId, { turnStartedAt: now });
}

export function markTurnStarted(gameId: string, now: number): void {
  armed.set(gameId, { turnStartedAt: now });
}

export function disarmClock(gameId: string): void {
  armed.delete(gameId);
}

export function clockStartedAt(gameId: string): number | null {
  return armed.get(gameId)?.turnStartedAt ?? null;
}

export function listArmedGameIds(): string[] {
  return [...armed.keys()];
}

export function snapshotClocks(
  game: ClockGame,
  turn: ClockSide,
  now = Date.now(),
): { whiteTime: number | null; blackTime: number | null } {
  const stored = clockFromControl(
    game.timeControl,
    game.whiteTimeRemaining,
    game.blackTimeRemaining,
  );
  if (!stored || game.gameType !== "pvp") {
    return { whiteTime: null, blackTime: null };
  }
  if (game.status !== "in_progress") {
    return {
      whiteTime: Math.max(0, Math.floor(stored.whiteMs)),
      blackTime: Math.max(0, Math.floor(stored.blackMs)),
    };
  }
  return displayedClock(stored, turn, clockStartedAt(game._id.toString()), now);
}

export async function armPersistedClocks(now = Date.now()): Promise<void> {
  const games = await Game.find({
    gameType: "pvp",
    status: "in_progress",
    timeControl: { $exists: true },
  }).select("_id");
  for (const game of games) {
    armClock(game._id.toString(), now);
  }
}
