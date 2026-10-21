import { MatchmakingJoinSchema, START_FEN } from "@chessarena/shared";
import { hasActivePvp } from "../../lib/activePvp.js";
import { PVP_INITIAL_MS, PVP_TIME_CONTROL } from "../../lib/clock.js";
import { Game } from "../../models/Game.js";
import { User } from "../../models/User.js";
import { emitSocketError } from "../errors.js";
import {
  enqueue,
  isQueued,
  isReserved,
  leaveQueue,
  listQueue,
  pairQueue,
  release,
  removeQueuedSocket,
  tryReserve,
  type QueueEntry,
} from "../matchmakingQueue.js";
import { armClock } from "../clocks.js";
import { cancelOtherChallenges } from "./challenge.js";
import type { AppServer, AppSocket } from "../types.js";


let ticking = false;
let timer: ReturnType<typeof setInterval> | null = null;

async function handleJoin(socket: AppSocket, payload: unknown): Promise<void> {
  const parsed = MatchmakingJoinSchema.safeParse(payload);
  if (!parsed.success) {
    emitSocketError(socket, "Unsupported time control");
    return;
  }

  const userId = socket.data.userId;
  if (isReserved(userId)) {
    emitSocketError(socket, "You are already in a game");
    return;
  }
  if (isQueued(userId)) {
    emitSocketError(socket, "You are already searching");
    return;
  }
  if (await hasActivePvp(userId)) {
    emitSocketError(socket, "You are already in a game");
    return;
  }

  const user = await User.findById(userId).select("rating").lean();
  if (!user) {
    emitSocketError(socket, "User not found");
    return;
  }

  const result = enqueue({
    userId,
    rating: user.rating ?? 1200,
    joinedAt: Date.now(),
    socketId: socket.id,
    timeControl: parsed.data.timeControl,
  });
  if (result === "queued") {
    emitSocketError(socket, "You are already searching");
    return;
  }
  if (result === "reserved") {
    emitSocketError(socket, "You are already in a game");
  }
}

function handleLeave(socket: AppSocket): void {
  leaveQueue(socket.data.userId);
}

async function createMatch(
  io: AppServer,
  a: QueueEntry,
  b: QueueEntry,
): Promise<void> {
  const [white, black] = Math.random() < 0.5 ? [a, b] : [b, a];
  const [whiteUser, blackUser] = await Promise.all([
    User.findById(white.userId).select("username").lean(),
    User.findById(black.userId).select("username").lean(),
  ]);
  if (!whiteUser?.username || !blackUser?.username) {
    throw new Error("Matched player record is missing");
  }

  const game = await Game.create({
    whitePlayer: white.userId,
    blackPlayer: black.userId,
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

  const whiteSocket = io.sockets.sockets.get(white.socketId);
  const blackSocket = io.sockets.sockets.get(black.socketId);
  await whiteSocket?.join(roomId);
  await blackSocket?.join(roomId);

  cancelOtherChallenges(io, [white.userId, black.userId]);

  const gameId = game._id.toString();
  const timeControl = { initial: 600 as const, increment: 5 as const };
  whiteSocket?.emit("matchmaking:matched", {
    gameId,
    color: "white",
    opponent: { userId: black.userId, username: blackUser.username },
    timeControl,
  });
  blackSocket?.emit("matchmaking:matched", {
    gameId,
    color: "black",
    opponent: { userId: white.userId, username: whiteUser.username },
    timeControl,
  });
}

async function matchPair(
  io: AppServer,
  a: QueueEntry,
  b: QueueEntry,
): Promise<void> {
  const userIds = [a.userId, b.userId];
  const socketA = io.sockets.sockets.get(a.socketId);
  const socketB = io.sockets.sockets.get(b.socketId);
  const aUp = Boolean(socketA?.connected);
  const bUp = Boolean(socketB?.connected);
  if (!aUp || !bUp) {
    release(userIds);
    if (aUp) enqueue(a);
    if (bUp) enqueue(b);
    return;
  }

  const [aBusy, bBusy] = await Promise.all([
    hasActivePvp(a.userId),
    hasActivePvp(b.userId),
  ]);
  if (aBusy || bBusy) {
    release(userIds);
    if (!aBusy) enqueue(a);
    if (!bBusy) enqueue(b);
    return;
  }

  try {
    await createMatch(io, a, b);
    release(userIds);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[socket] Matchmaking failed: ${message}`);
    release(userIds);
    enqueue(a);
    enqueue(b);
    emitSocketError(socketA!, "Could not start match");
    emitSocketError(socketB!, "Could not start match");
  }
}

async function tick(io: AppServer): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const reservedPairs: [QueueEntry, QueueEntry][] = [];
    for (const pair of pairQueue(listQueue(), Date.now()).pairs) {
      if (tryReserve([pair[0].userId, pair[1].userId])) {
        reservedPairs.push(pair);
      }
    }
    for (const [a, b] of reservedPairs) {
      await matchPair(io, a, b);
    }
  } finally {
    ticking = false;
  }
}

export function registerMatchmakingHandlers(io: AppServer): void {
  io.on("connection", (socket) => {
    socket.on("matchmaking:join", (payload) => {
      void handleJoin(socket, payload);
    });
    socket.on("matchmaking:leave", () => {
      handleLeave(socket);
    });
    socket.on("disconnect", () => {
      removeQueuedSocket(socket.id);
    });
  });

  if (!timer) {
    timer = setInterval(() => {
      void tick(io);
    }, 1000);
    timer.unref();
  }
}
