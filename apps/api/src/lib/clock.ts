export const PVP_TIME_CONTROL = { initial: 600, increment: 5 } as const;
export const PVP_INITIAL_MS = PVP_TIME_CONTROL.initial * 1000;

export type ClockSide = "w" | "b";

export type StoredClock = {
  whiteMs: number;
  blackMs: number;
  incrementMs: number;
};

export function clockFromControl(
  timeControl: { initial: number; increment: number } | null | undefined,
  whiteMs: number | null | undefined,
  blackMs: number | null | undefined,
): StoredClock | null {
  if (!timeControl) return null;
  const initialMs = timeControl.initial * 1000;
  return {
    whiteMs: whiteMs ?? initialMs,
    blackMs: blackMs ?? initialMs,
    incrementMs: timeControl.increment * 1000,
  };
}

export function liveTimes(
  stored: Pick<StoredClock, "whiteMs" | "blackMs">,
  active: ClockSide,
  elapsedMs: number,
): { whiteMs: number; blackMs: number } {
  const elapsed = Math.max(0, elapsedMs);
  if (active === "w") {
    return { whiteMs: stored.whiteMs - elapsed, blackMs: stored.blackMs };
  }
  return { whiteMs: stored.whiteMs, blackMs: stored.blackMs - elapsed };
}

export type SettledClock =
  | {
      flagged: true;
      winner: "white" | "black";
      whiteMs: number;
      blackMs: number;
    }
  | {
      flagged: false;
      whiteMs: number;
      blackMs: number;
    };

/** Subtract elapsed from the mover, then add the increment. A clock already at 0 flags first. */
export function settleMove(
  stored: StoredClock,
  active: ClockSide,
  elapsedMs: number,
  incrementMs = stored.incrementMs,
): SettledClock {
  const live = liveTimes(stored, active, elapsedMs);
  const activeMs = active === "w" ? live.whiteMs : live.blackMs;
  if (activeMs <= 0) {
    return {
      flagged: true,
      winner: active === "w" ? "black" : "white",
      whiteMs: active === "w" ? 0 : stored.whiteMs,
      blackMs: active === "b" ? 0 : stored.blackMs,
    };
  }
  const next = activeMs + incrementMs;
  if (active === "w") {
    return { flagged: false, whiteMs: next, blackMs: stored.blackMs };
  }
  return { flagged: false, whiteMs: stored.whiteMs, blackMs: next };
}

export function displayedClock(
  stored: Pick<StoredClock, "whiteMs" | "blackMs">,
  active: ClockSide,
  turnStartedAt: number | null,
  now: number,
): { whiteTime: number; blackTime: number } {
  const elapsed = turnStartedAt == null ? 0 : Math.max(0, now - turnStartedAt);
  const live = liveTimes(stored, active, elapsed);
  return {
    whiteTime: Math.max(0, Math.floor(live.whiteMs)),
    blackTime: Math.max(0, Math.floor(live.blackMs)),
  };
}
