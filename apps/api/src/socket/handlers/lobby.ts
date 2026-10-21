import { User } from "../../models/User.js";
import { emitSocketError } from "../errors.js";
import {
  addLobbySocket,
  isSocketInLobby,
  listLobbyUsers,
  removeLobbySocket,
} from "../lobbyPresence.js";
import type { AppServer, AppSocket } from "../types.js";

const LOBBY_ROOM = "lobby";

function broadcastLobby(io: AppServer): void {
  io.to(LOBBY_ROOM).emit("lobby:onlineUsers", listLobbyUsers());
}

async function handleJoin(io: AppServer, socket: AppSocket): Promise<void> {
  if (isSocketInLobby(socket.id)) {
    await socket.join(LOBBY_ROOM);
    socket.emit("lobby:onlineUsers", listLobbyUsers());
    return;
  }

  const user = await User.findById(socket.data.userId)
    .select("username rating")
    .lean();
  if (!socket.connected) return;

  if (!user) {
    emitSocketError(socket, "User not found");
    return;
  }

  addLobbySocket(
    user._id.toString(),
    user.username,
    user.rating ?? 1200,
    socket.id,
  );
  await socket.join(LOBBY_ROOM);
  broadcastLobby(io);
}

function handleLeave(io: AppServer, socket: AppSocket): void {
  const removed = removeLobbySocket(socket.id);
  void socket.leave(LOBBY_ROOM);
  if (removed) broadcastLobby(io);
}

export function registerLobbyHandlers(io: AppServer): void {
  io.on("connection", (socket) => {
    socket.on("lobby:join", () => {
      void handleJoin(io, socket);
    });

    socket.on("lobby:leave", () => {
      handleLeave(io, socket);
    });

    socket.on("disconnect", () => {
      if (!removeLobbySocket(socket.id)) return;
      broadcastLobby(io);
    });
  });
}
