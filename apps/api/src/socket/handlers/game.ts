import {
  ChatMessageSchema,
  GameJoinSchema,
  GameMoveSchema,
  GameOfferDrawSchema,
  GameResignSchema,
  GameRespondDrawSchema,
  stateFromSans,
  tryMove,
  type GameEnded,
  type GameEndReason,
  type GameLastMove,
  type GameResult,
  type GameStateUpdate,
} from "@chessarena/shared";
import mongoose from "mongoose";
import { completeGame } from "../../lib/completeGame.js";
import { Game, type GameDocument } from "../../models/Game.js";
import { User } from "../../models/User.js";
import { emitSocketError } from "../errors.js";
import type { AppServer, AppSocket } from "../types.js";

const gameQueues = new Map<string, Promise<void>>();
const chatTimestamps = new Map<string, number[]>();
const CHAT_LIMIT = 5;
const CHAT_WINDOW_MS = 10_000;

function allowChat(userId: string, gameId: string, now: number): boolean {
  const key = `${userId}:${gameId}`;
  const recent = (chatTimestamps.get(key) ?? []).filter(
    (sentAt) => now - sentAt < CHAT_WINDOW_MS,
  );
  if (recent.length >= CHAT_LIMIT) {
    chatTimestamps.set(key, recent);
    return false;
  }
  recent.push(now);
  chatTimestamps.set(key, recent);
  return true;
}

function enqueueGame(gameId: string, task: () => Promise<void>): void {
  const previous = gameQueues.get(gameId) ?? Promise.resolve();
  const next = previous.then(task, task);
  gameQueues.set(
    gameId,
    next.finally(() => {
      if (gameQueues.get(gameId) === next) {
        gameQueues.delete(gameId);
      }
    }),
  );
}

function playerId(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toString" in value) {
    return String(value);
  }
  return "";
}

function sideFor(game: GameDocument, userId: string): "w" | "b" | null {
  if (playerId(game.whitePlayer) === userId) return "w";
  if (playerId(game.blackPlayer) === userId) return "b";
  return null;
}

function roomIdFor(game: GameDocument): string {
  if (typeof game.socketRoomId === "string" && game.socketRoomId.length > 0) {
    return game.socketRoomId;
  }
  return `game:${game._id.toString()}`;
}

function lastMoveFromHistory(
  uciHistory: string[] | undefined,
): GameLastMove | null {
  const uci = uciHistory?.[uciHistory.length - 1];
  if (!uci || uci.length < 4) return null;
  const promo = uci.slice(4, 5);
  const promotion =
    promo === "q" || promo === "r" || promo === "b" || promo === "n"
      ? promo
      : undefined;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    ...(promotion ? { promotion } : {}),
  };
}

function terminalReason(flags: {
  isCheckmate: boolean;
  isStalemate: boolean;
  drawReason?: string;
}): GameEndReason {
  if (flags.isCheckmate) return "checkmate";
  if (flags.isStalemate || flags.drawReason === "stalemate") return "stalemate";
  if (
    flags.drawReason === "insufficient_material" ||
    flags.drawReason === "threefold_repetition" ||
    flags.drawReason === "fifty_move"
  ) {
    return flags.drawReason;
  }
  return "draw";
}

function toStateUpdate(game: GameDocument): GameStateUpdate | null {
  const rebuilt = stateFromSans(game.moves);
  if (!rebuilt.ok) return null;
  const offered = game.drawOfferedBy ? playerId(game.drawOfferedBy) : "";
  return {
    gameId: game._id.toString(),
    fen: rebuilt.state.fen,
    lastMove: lastMoveFromHistory(rebuilt.state.uciHistory),
    turn: rebuilt.flags.turn,
    moves: [...game.moves],
    status: game.status as GameStateUpdate["status"],
    result: (game.result ?? null) as GameStateUpdate["result"],
    drawOfferedBy: offered || null,
  };
}

async function loadPvpGame(
  gameId: string,
  userId: string,
): Promise<{ ok: true; game: GameDocument } | { ok: false; message: string }> {
  if (!mongoose.isValidObjectId(gameId)) {
    return { ok: false, message: "Game not found" };
  }

  const game = await Game.findById(gameId);
  if (!game) {
    return { ok: false, message: "Game not found" };
  }
  if (sideFor(game, userId) === null) {
    return { ok: false, message: "You are not a participant in this game" };
  }
  if (game.gameType !== "pvp") {
    return { ok: false, message: "This game does not use live sync" };
  }
  return { ok: true, game };
}

function broadcastState(
  io: AppServer,
  game: GameDocument,
  ended: GameEnded | null,
): boolean {
  const snapshot = toStateUpdate(game);
  if (!snapshot) return false;
  const roomId = roomIdFor(game);
  io.to(roomId).emit("game:stateUpdate", snapshot);
  if (ended) {
    io.to(roomId).emit("game:ended", ended);
  }
  return true;
}

async function handleJoin(socket: AppSocket, payload: unknown): Promise<void> {
  const parsed = GameJoinSchema.safeParse(payload);
  if (!parsed.success) {
    emitSocketError(socket, "Invalid game");
    return;
  }

  const loaded = await loadPvpGame(parsed.data.gameId, socket.data.userId);
  if (!loaded.ok) {
    emitSocketError(socket, loaded.message);
    return;
  }

  const game = loaded.game;
  const roomId = roomIdFor(game);
  if (game.socketRoomId !== roomId) {
    game.socketRoomId = roomId;
    await game.save();
  }

  await socket.join(roomId);
  const snapshot = toStateUpdate(game);
  if (!snapshot) {
    emitSocketError(socket, "Stored game moves are invalid");
    return;
  }
  socket.emit("game:stateUpdate", snapshot);
}

async function applyMove(
  io: AppServer,
  socket: AppSocket,
  gameId: string,
  move: string,
): Promise<void> {
  const loaded = await loadPvpGame(gameId, socket.data.userId);
  if (!loaded.ok) {
    emitSocketError(socket, loaded.message);
    return;
  }

  const game = loaded.game;
  if (game.status !== "in_progress") {
    emitSocketError(socket, "Game is already finished");
    return;
  }

  const rebuilt = stateFromSans(game.moves);
  if (!rebuilt.ok) {
    emitSocketError(socket, "Stored game moves are invalid");
    return;
  }

  const side = sideFor(game, socket.data.userId);
  if (side !== rebuilt.flags.turn) {
    emitSocketError(socket, "It is not your turn");
    return;
  }

  const moveResult = tryMove(rebuilt.state, move);
  if (!moveResult.ok) {
    emitSocketError(
      socket,
      moveResult.reason === "game_over"
        ? "Game is already finished"
        : "Illegal move",
    );
    return;
  }

  game.moves = [...game.moves, moveResult.san];
  game.fen = moveResult.fen;
  game.drawOfferedBy = null;
  const roomId = roomIdFor(game);
  game.socketRoomId = roomId;

  let ended: GameEnded | null = null;
  if (moveResult.flags.isCheckmate) {
    const result: Exclude<GameResult, null> =
      moveResult.flags.turn === "b" ? "white" : "black";
    await game.save();
    await completeGame(game, result);
    ended = { gameId: game._id.toString(), result, reason: "checkmate" };
  } else if (moveResult.flags.isDraw || moveResult.flags.isStalemate) {
    await game.save();
    await completeGame(game, "draw");
    ended = {
      gameId: game._id.toString(),
      result: "draw",
      reason: terminalReason(moveResult.flags),
    };
  } else {
    await game.save();
  }

  if (!broadcastState(io, game, ended)) {
    emitSocketError(socket, "Stored game moves are invalid");
  }
}

function handleMove(io: AppServer, socket: AppSocket, payload: unknown): void {
  const parsed = GameMoveSchema.safeParse(payload);
  if (!parsed.success) {
    emitSocketError(socket, "Illegal move");
    return;
  }

  const { gameId, move } = parsed.data;
  enqueueGame(gameId, () => applyMove(io, socket, gameId, move));
}

async function applyResign(
  io: AppServer,
  socket: AppSocket,
  gameId: string,
): Promise<void> {
  const loaded = await loadPvpGame(gameId, socket.data.userId);
  if (!loaded.ok) {
    emitSocketError(socket, loaded.message);
    return;
  }

  const game = loaded.game;
  if (game.status !== "in_progress") {
    emitSocketError(socket, "Game is already finished");
    return;
  }

  const side = sideFor(game, socket.data.userId);
  if (!side) {
    emitSocketError(socket, "You are not a participant in this game");
    return;
  }

  const result: Exclude<GameResult, null> = side === "w" ? "black" : "white";
  game.drawOfferedBy = null;
  game.socketRoomId = roomIdFor(game);
  await game.save();
  await completeGame(game, result);
  const ended: GameEnded = {
    gameId: game._id.toString(),
    result,
    reason: "resign",
  };
  if (!broadcastState(io, game, ended)) {
    emitSocketError(socket, "Stored game moves are invalid");
  }
}

async function applyOfferDraw(
  io: AppServer,
  socket: AppSocket,
  gameId: string,
): Promise<void> {
  const loaded = await loadPvpGame(gameId, socket.data.userId);
  if (!loaded.ok) {
    emitSocketError(socket, loaded.message);
    return;
  }

  const game = loaded.game;
  if (game.status !== "in_progress") {
    emitSocketError(socket, "Game is already finished");
    return;
  }

  const existing = game.drawOfferedBy ? playerId(game.drawOfferedBy) : "";
  if (existing === socket.data.userId) {
    emitSocketError(socket, "You already offered a draw");
    return;
  }
  if (existing) {
    emitSocketError(socket, "Respond to the current draw offer");
    return;
  }

  game.drawOfferedBy = new mongoose.Types.ObjectId(socket.data.userId);
  game.socketRoomId = roomIdFor(game);
  await game.save();
  if (!broadcastState(io, game, null)) {
    emitSocketError(socket, "Stored game moves are invalid");
  }
}

async function applyRespondDraw(
  io: AppServer,
  socket: AppSocket,
  gameId: string,
  accept: boolean,
): Promise<void> {
  const loaded = await loadPvpGame(gameId, socket.data.userId);
  if (!loaded.ok) {
    emitSocketError(socket, loaded.message);
    return;
  }

  const game = loaded.game;
  if (game.status !== "in_progress") {
    emitSocketError(socket, "Game is already finished");
    return;
  }

  const existing = game.drawOfferedBy ? playerId(game.drawOfferedBy) : "";
  if (!existing) {
    emitSocketError(socket, "No draw offer is pending");
    return;
  }
  if (existing === socket.data.userId) {
    emitSocketError(socket, "You cannot respond to your own draw offer");
    return;
  }

  game.socketRoomId = roomIdFor(game);
  if (!accept) {
    game.drawOfferedBy = null;
    await game.save();
    if (!broadcastState(io, game, null)) {
      emitSocketError(socket, "Stored game moves are invalid");
    }
    return;
  }

  game.drawOfferedBy = null;
  await game.save();
  await completeGame(game, "draw");
  const ended: GameEnded = {
    gameId: game._id.toString(),
    result: "draw",
    reason: "agreement",
  };
  if (!broadcastState(io, game, ended)) {
    emitSocketError(socket, "Stored game moves are invalid");
  }
}

function handleResign(io: AppServer, socket: AppSocket, payload: unknown): void {
  const parsed = GameResignSchema.safeParse(payload);
  if (!parsed.success) {
    emitSocketError(socket, "Invalid game");
    return;
  }
  enqueueGame(parsed.data.gameId, () =>
    applyResign(io, socket, parsed.data.gameId),
  );
}

function handleOfferDraw(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): void {
  const parsed = GameOfferDrawSchema.safeParse(payload);
  if (!parsed.success) {
    emitSocketError(socket, "Invalid game");
    return;
  }
  enqueueGame(parsed.data.gameId, () =>
    applyOfferDraw(io, socket, parsed.data.gameId),
  );
}

async function handleChatMessage(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): Promise<void> {
  const raw =
    typeof payload === "object" && payload !== null
      ? (payload as { gameId?: unknown; text?: unknown })
      : {};
  if (typeof raw.gameId !== "string" || typeof raw.text !== "string") {
    emitSocketError(socket, "Invalid message");
    return;
  }

  const text = raw.text.trim();
  if (!text) {
    emitSocketError(socket, "Message is empty");
    return;
  }
  if (text.length > 200) {
    emitSocketError(socket, "Message is too long");
    return;
  }

  const parsed = ChatMessageSchema.safeParse({ gameId: raw.gameId, text });
  if (!parsed.success) {
    emitSocketError(socket, "Invalid message");
    return;
  }

  const loaded = await loadPvpGame(parsed.data.gameId, socket.data.userId);
  if (!loaded.ok) {
    emitSocketError(socket, loaded.message);
    return;
  }

  const now = Date.now();
  if (!allowChat(socket.data.userId, parsed.data.gameId, now)) {
    emitSocketError(socket, "Slow down");
    return;
  }

  const user = await User.findById(socket.data.userId).select("username").lean();
  if (!user?.username) {
    emitSocketError(socket, "User not found");
    return;
  }

  const game = loaded.game;
  const roomId = roomIdFor(game);
  await socket.join(roomId);
  io.to(roomId).emit("chat:newMessage", {
    gameId: game._id.toString(),
    from: user.username,
    text: parsed.data.text,
    sentAt: new Date(now).toISOString(),
  });
}

function handleRespondDraw(
  io: AppServer,
  socket: AppSocket,
  payload: unknown,
): void {
  const parsed = GameRespondDrawSchema.safeParse(payload);
  if (!parsed.success) {
    emitSocketError(socket, "Invalid draw response");
    return;
  }
  enqueueGame(parsed.data.gameId, () =>
    applyRespondDraw(io, socket, parsed.data.gameId, parsed.data.accept),
  );
}

export function registerGameHandlers(io: AppServer): void {
  io.on("connection", (socket) => {
    socket.on("game:join", (payload) => {
      void handleJoin(socket, payload);
    });
    socket.on("game:move", (payload) => {
      handleMove(io, socket, payload);
    });
    socket.on("game:resign", (payload) => {
      handleResign(io, socket, payload);
    });
    socket.on("game:offerDraw", (payload) => {
      handleOfferDraw(io, socket, payload);
    });
    socket.on("game:respondDraw", (payload) => {
      handleRespondDraw(io, socket, payload);
    });
    socket.on("chat:message", (payload) => {
      void handleChatMessage(io, socket, payload);
    });
  });
}
