import { SocketHandshakeAuthSchema } from "@chessarena/shared";
import { verifyAccessToken } from "../lib/tokens.js";
import type { AppSocket } from "./types.js";

export function socketAuthMiddleware(
  socket: AppSocket,
  next: (err?: Error) => void,
): void {
  const parsed = SocketHandshakeAuthSchema.safeParse(socket.handshake.auth);
  if (!parsed.success) {
    next(new Error("Authentication required"));
    return;
  }

  try {
    const payload = verifyAccessToken(parsed.data.token);
    socket.data.userId = payload.sub;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
}
