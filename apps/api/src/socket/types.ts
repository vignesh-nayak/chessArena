import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@chessarena/shared";
import type { Server, Socket } from "socket.io";

export type SocketData = {
  userId: string;
};

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
