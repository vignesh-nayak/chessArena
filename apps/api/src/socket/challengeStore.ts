import { randomUUID } from "node:crypto";

const CHALLENGE_TTL_MS = 60_000;

export type PendingChallenge = {
  challengeId: string;
  fromUserId: string;
  toUserId: string;
  fromUsername: string;
  expiresAt: number;
};

type StoredChallenge = PendingChallenge & {
  timer: ReturnType<typeof setTimeout>;
};

const challenges = new Map<string, StoredChallenge>();
const challengeIdsByUser = new Map<string, Set<string>>();

function track(userId: string, challengeId: string): void {
  let ids = challengeIdsByUser.get(userId);
  if (!ids) {
    ids = new Set();
    challengeIdsByUser.set(userId, ids);
  }
  ids.add(challengeId);
}

function untrack(userId: string, challengeId: string): void {
  const ids = challengeIdsByUser.get(userId);
  if (!ids) return;
  ids.delete(challengeId);
  if (ids.size === 0) challengeIdsByUser.delete(userId);
}

function drop(challenge: StoredChallenge): void {
  clearTimeout(challenge.timer);
  challenges.delete(challenge.challengeId);
  untrack(challenge.fromUserId, challenge.challengeId);
  untrack(challenge.toUserId, challenge.challengeId);
}

export function hasPendingOutgoing(userId: string): boolean {
  const ids = challengeIdsByUser.get(userId);
  if (!ids) return false;
  for (const id of ids) {
    const challenge = challenges.get(id);
    if (challenge?.fromUserId === userId) return true;
  }
  return false;
}

export function hasPendingIncoming(userId: string): boolean {
  const ids = challengeIdsByUser.get(userId);
  if (!ids) return false;
  for (const id of ids) {
    const challenge = challenges.get(id);
    if (challenge?.toUserId === userId) return true;
  }
  return false;
}

export function createChallenge(
  input: {
    fromUserId: string;
    toUserId: string;
    fromUsername: string;
  },
  onExpire: (challenge: PendingChallenge) => void,
): PendingChallenge {
  const challengeId = randomUUID();
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  const timer = setTimeout(() => {
    const current = challenges.get(challengeId);
    if (!current) return;
    const expired: PendingChallenge = {
      challengeId: current.challengeId,
      fromUserId: current.fromUserId,
      toUserId: current.toUserId,
      fromUsername: current.fromUsername,
      expiresAt: current.expiresAt,
    };
    drop(current);
    onExpire(expired);
  }, CHALLENGE_TTL_MS);

  const stored: StoredChallenge = {
    challengeId,
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
    fromUsername: input.fromUsername,
    expiresAt,
    timer,
  };
  challenges.set(challengeId, stored);
  track(input.fromUserId, challengeId);
  track(input.toUserId, challengeId);
  return {
    challengeId,
    fromUserId: stored.fromUserId,
    toUserId: stored.toUserId,
    fromUsername: stored.fromUsername,
    expiresAt,
  };
}

export function takeChallengeForAccept(
  challengeId: string,
  userId: string,
): PendingChallenge | null {
  const challenge = challenges.get(challengeId);
  if (!challenge || challenge.toUserId !== userId) return null;
  if (challenge.expiresAt <= Date.now()) {
    drop(challenge);
    return null;
  }
  const taken: PendingChallenge = {
    challengeId: challenge.challengeId,
    fromUserId: challenge.fromUserId,
    toUserId: challenge.toUserId,
    fromUsername: challenge.fromUsername,
    expiresAt: challenge.expiresAt,
  };
  drop(challenge);
  return taken;
}

export function declineChallenge(
  challengeId: string,
  userId: string,
): PendingChallenge | null {
  const challenge = challenges.get(challengeId);
  if (!challenge || challenge.toUserId !== userId) return null;
  const declined: PendingChallenge = {
    challengeId: challenge.challengeId,
    fromUserId: challenge.fromUserId,
    toUserId: challenge.toUserId,
    fromUsername: challenge.fromUsername,
    expiresAt: challenge.expiresAt,
  };
  drop(challenge);
  return declined;
}

export function cancelChallengesInvolving(userIds: string[]): PendingChallenge[] {
  const ids = new Set<string>();
  for (const userId of userIds) {
    const owned = challengeIdsByUser.get(userId);
    if (!owned) continue;
    for (const id of owned) ids.add(id);
  }

  const cancelled: PendingChallenge[] = [];
  for (const id of ids) {
    const challenge = challenges.get(id);
    if (!challenge) continue;
    cancelled.push({
      challengeId: challenge.challengeId,
      fromUserId: challenge.fromUserId,
      toUserId: challenge.toUserId,
      fromUsername: challenge.fromUsername,
      expiresAt: challenge.expiresAt,
    });
    drop(challenge);
  }
  return cancelled;
}
