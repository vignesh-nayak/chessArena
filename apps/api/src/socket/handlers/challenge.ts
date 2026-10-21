import type { ServerToClientEvents } from "@chessarena/shared";
import { START_FEN } from "@chessarena/shared";
import { hasActivePvp } from "../../lib/activePvp.js";
import { PVP_INITIAL_MS, PVP_TIME_CONTROL } from "../../lib/clock.js";
import { Game } from "../../models/Game.js";
import { emitSocketError } from "../errors.js";
import { armClock } from "../clocks.js";
import { enqueue, release, tryReserve } from "../matchmakingQueue.js";
import { getLobbyUser } from "../lobbyPresence.js";
import {
  cancelChallengesInvolving,
  getPendingChallenge,
  createChallenge,
  declineChallenge,
  hasPendingIncoming,
  hasPendingOutgoing,
  takeChallengeForAccept,
  type PendingChallenge,
} from "../challengeStore.js";
import type { AppServer, AppSocket } from "../types.js";

function emitToUser<E extends keyof ServerToClientEvents>(
  io: AppServer,
  userId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
): void {
  const member = getLobbyUser(userId);
  if (!member) return;
  for (const socketId of member.socketIds) {
    io.to(socketId).emit(event, ...args);
  }
}

export function cancelOtherChallenges(io: AppServer, userIds: string[]): void {
  const cancelled = cancelChallengesInvolving(userIds);
  for (const challenge of cancelled) notifyCancelled(io, challenge);
}

function notifyCancelled(io: AppServer, challenge: PendingChallenge): void {
  emitToUser(io, challenge.fromUserId, "challenge:declined", {
    challengeId: challenge.challengeId,
  });
  emitToUser(io, challenge.toUserId, "error", {
    message: "Challenge cancelled",
  });
}

async function handleSend(io: AppServer, socket: AppSocket, payload: unknown) {
  const toUserId =
    typeof payload === "object" &&
    payload !== null &&
    "toUserId" in payload &&
    typeof (payload as { toUserId?: unknown }).toUserId === "string"
      ? (payload as { toUserId: string }).toUserId
      : "";
  if (!toUserId) {
    emitSocketError(socket, "Invalid challenge");
    return;
  }

  const fromUserId = socket.data.userId;
  if (toUserId === fromUserId) {
    emitSocketError(socket, "You cannot challenge yourself");
    return;
  }

  const sender = getLobbyUser(fromUserId);
  const target = getLobbyUser(toUserId);
  if (!sender || !target) {
    emitSocketError(socket, "That player is not in the lobby");
    return;
  }

  if (hasPendingOutgoing(fromUserId)) {
    emitSocketError(socket, "You already have a pending challenge");
    return;
  }
  if (hasPendingIncoming(toUserId)) {
    emitSocketError(socket, "That player already has a pending challenge");
    return;
  }

  const senderBusy = await hasActivePvp(fromUserId);
  const targetBusy = await hasActivePvp(toUserId);
  if (senderBusy || targetBusy) {
    emitSocketError(
      socket,
      senderBusy
        ? "You are already in a game"
        : "That player is already in a game",
    );
    return;
  }

  const challenge = createChallenge(
    {
      fromUserId,
      toUserId,
      fromUsername: sender.username,
    },
    (expired) => {
      emitToUser(io, expired.fromUserId, "challenge:declined", {
        challengeId: expired.challengeId,
      });
      emitToUser(io, expired.toUserId, "error", {
        message: "Challenge expired",
      });
    },
  );

  emitToUser(io, toUserId, "challenge:received", {
    fromUserId,
    fromUsername: sender.username,
    challengeId: challenge.challengeId,
  });
}

function handleDecline(io: AppServer, socket: AppSocket, payload: unknown): void {
  const challengeId =
    typeof payload === "object" &&
    payload !== null &&
    "challengeId" in payload &&
    typeof (payload as { challengeId?: unknown }).challengeId === "string"
      ? (payload as { challengeId: string }).challengeId
      : "";
  if (!challengeId) {
    emitSocketError(socket, "Invalid challenge");
    return;
  }

  const declined = declineChallenge(challengeId, socket.data.userId);
  if (!declined) {
    emitSocketError(socket, "Challenge not found");
    return;
  }

  emitToUser(io, declined.fromUserId, "challenge:declined", {
    challengeId: declined.challengeId,
  });
}

async function handleAccept(io: AppServer, socket: AppSocket, payload: unknown) {
  const challengeId =
    typeof payload === "object" &&
    payload !== null &&
    "challengeId" in payload &&
    typeof (payload as { challengeId?: unknown }).challengeId === "string"
      ? (payload as { challengeId: string }).challengeId
      : "";
  if (!challengeId) {
    emitSocketError(socket, "Invalid challenge");
    return;
  }

  const pending = getPendingChallenge(challengeId);
  if (!pending || pending.toUserId !== socket.data.userId) {
    emitSocketError(socket, "Challenge not found");
    return;
  }

  const userIds = [pending.fromUserId, pending.toUserId];
  const removed = tryReserve(userIds);
  if (!removed) {
    emitSocketError(socket, "You are already in a game");
    return;
  }

  let restoreSearch = false;
  try {
    const challenge = takeChallengeForAccept(challengeId, socket.data.userId);
    if (!challenge) {
      restoreSearch = true;
      emitSocketError(socket, "Challenge not found");
      return;
    }

    const sender = getLobbyUser(challenge.fromUserId);
    const target = getLobbyUser(challenge.toUserId);
    if (!sender || !target) {
      restoreSearch = true;
      emitSocketError(socket, "That player is not in the lobby");
      return;
    }

    if (
      (await hasActivePvp(challenge.fromUserId)) ||
      (await hasActivePvp(challenge.toUserId))
    ) {
      emitSocketError(socket, "You are already in a game");
      return;
    }

    const senderIsWhite = Math.random() < 0.5;
    const whiteId = senderIsWhite ? challenge.fromUserId : challenge.toUserId;
    const blackId = senderIsWhite ? challenge.toUserId : challenge.fromUserId;
    const whiteUser = senderIsWhite ? sender : target;
    const blackUser = senderIsWhite ? target : sender;

    const game = await Game.create({
      whitePlayer: whiteId,
      blackPlayer: blackId,
      moves: [],
      fen: START_FEN,
      status: "in_progress",
      result: null,
      gameType: "pvp",
      aiDifficulty: null,
      drawOfferedBy: null,
      socketRoomId: "pending",
      timeControl: { ...PVP_TIME_CONTROL },
      whiteTimeRemaining: PVP_INITIAL_MS,
      blackTimeRemaining: PVP_INITIAL_MS,
    });
    const roomId = `game:${game._id.toString()}`;
    game.socketRoomId = roomId;
    await game.save();
    armClock(game._id.toString());

    for (const socketId of [...whiteUser.socketIds, ...blackUser.socketIds]) {
      io.sockets.sockets.get(socketId)?.join(roomId);
    }

    cancelOtherChallenges(io, [challenge.fromUserId, challenge.toUserId]);

    emitToUser(io, whiteId, "game:started", {
      gameId: game._id.toString(),
      color: "white",
      opponent: { userId: blackUser.userId, username: blackUser.username },
    });
    emitToUser(io, blackId, "game:started", {
      gameId: game._id.toString(),
      color: "black",
      opponent: { userId: whiteUser.userId, username: whiteUser.username },
    });
  } catch (err) {
    restoreSearch = true;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[socket] Challenge accept failed: ${message}`);
    emitSocketError(socket, "Could not start game");
  } finally {
    release(userIds);
    if (restoreSearch) {
      for (const entry of removed) enqueue(entry);
    }
  }
}

export function registerChallengeHandlers(io: AppServer): void {
  io.on("connection", (socket) => {
    socket.on("challenge:send", (payload) => {
      void handleSend(io, socket, payload);
    });
    socket.on("challenge:decline", (payload) => {
      handleDecline(io, socket, payload);
    });
    socket.on("challenge:accept", (payload) => {
      void handleAccept(io, socket, payload);
    });
    socket.on("disconnect", () => {
      const cancelled = cancelChallengesInvolving([socket.data.userId]);
      for (const challenge of cancelled) {
        notifyCancelled(io, challenge);
      }
    });
  });
}
