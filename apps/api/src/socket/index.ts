import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../env.js";
import { socketAuthMiddleware } from "./auth.js";
import { emitSocketError } from "./errors.js";
import { registerChallengeHandlers } from "./handlers/challenge.js";
import { registerGameHandlers } from "./handlers/game.js";
import { registerLobbyHandlers } from "./handlers/lobby.js";
import { registerMatchmakingHandlers } from "./handlers/matchmaking.js";
import type { AppServer } from "./types.js";

export { emitSocketError };

export function initSocket(httpServer: HttpServer): AppServer {
  const io: AppServer = new Server(httpServer, {
    cors: {
      origin: [...env.corsOrigins],
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);
  registerLobbyHandlers(io);
  registerChallengeHandlers(io);
  registerMatchmakingHandlers(io);
  registerGameHandlers(io);

  io.on("connection", (socket) => {
    console.log(
      `[socket] connected userId=${socket.data.userId} socketId=${socket.id}`,
    );
    socket.on("disconnect", (reason) => {
      console.log(
        `[socket] disconnected userId=${socket.data.userId} socketId=${socket.id} reason=${reason}`,
      );
    });
  });

  return io;
}
