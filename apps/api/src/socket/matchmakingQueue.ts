export type MatchTimeControl = {
  initial: number;
  increment: number;
};

export type QueueEntry = {
  userId: string;
  rating: number;
  joinedAt: number;
  socketId: string;
  timeControl: MatchTimeControl;
};

const WINDOW_START = 100;
const WINDOW_STEP = 50;
const WINDOW_CAP = 400;
const WINDOW_STEP_SECONDS = 10;

const queue = new Map<string, QueueEntry>();
const reserved = new Set<string>();

export function ratingWindow(waitSeconds: number): number {
  const steps = Math.floor(Math.max(0, waitSeconds) / WINDOW_STEP_SECONDS);
  return Math.min(WINDOW_CAP, WINDOW_START + WINDOW_STEP * steps);
}

function sameTimeControl(a: MatchTimeControl, b: MatchTimeControl): boolean {
  return a.initial === b.initial && a.increment === b.increment;
}

/**
 * Oldest seeker first. That seeker takes the oldest opponent inside their
 * own window. The opponent's window does not have to cover the gap.
 */
export function pairQueue(
  entries: QueueEntry[],
  now: number,
): { pairs: [QueueEntry, QueueEntry][]; rest: QueueEntry[] } {
  const pool = [...entries].sort(
    (a, b) => a.joinedAt - b.joinedAt || a.userId.localeCompare(b.userId),
  );
  const paired = new Set<string>();
  const pairs: [QueueEntry, QueueEntry][] = [];

  for (const seeker of pool) {
    if (paired.has(seeker.userId)) continue;
    const window = ratingWindow((now - seeker.joinedAt) / 1000);
    let opponent: QueueEntry | null = null;
    for (const other of pool) {
      if (other.userId === seeker.userId || paired.has(other.userId)) continue;
      if (!sameTimeControl(seeker.timeControl, other.timeControl)) continue;
      if (Math.abs(other.rating - seeker.rating) <= window) {
        opponent = other;
        break;
      }
    }
    if (!opponent) continue;
    pairs.push([seeker, opponent]);
    paired.add(seeker.userId);
    paired.add(opponent.userId);
  }

  return {
    pairs,
    rest: pool.filter((entry) => !paired.has(entry.userId)),
  };
}

export function listQueue(): QueueEntry[] {
  return [...queue.values()];
}

export function isQueued(userId: string): boolean {
  return queue.has(userId);
}

export function isReserved(userId: string): boolean {
  return reserved.has(userId);
}

export function enqueue(entry: QueueEntry): "ok" | "queued" | "reserved" {
  if (reserved.has(entry.userId)) return "reserved";
  if (queue.has(entry.userId)) return "queued";
  queue.set(entry.userId, entry);
  return "ok";
}

export function leaveQueue(userId: string): void {
  queue.delete(userId);
}

export function removeQueuedSocket(socketId: string): void {
  for (const [userId, entry] of queue) {
    if (entry.socketId !== socketId) continue;
    queue.delete(userId);
    return;
  }
}

/** Removes queued users and marks every id reserved. Null if any id is already reserved. */
export function tryReserve(userIds: string[]): QueueEntry[] | null {
  if (userIds.some((id) => reserved.has(id))) return null;
  const removed: QueueEntry[] = [];
  for (const id of userIds) {
    const entry = queue.get(id);
    if (entry) {
      removed.push(entry);
      queue.delete(id);
    }
    reserved.add(id);
  }
  return removed;
}

export function release(userIds: string[]): void {
  for (const id of userIds) reserved.delete(id);
}
