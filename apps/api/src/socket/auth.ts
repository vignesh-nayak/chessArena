import { verifyAccessToken } from "../lib/tokens.js";
import type { AppSocket } from "./types.js";

export function socketAuthMiddleware(
  socket: AppSocket,
  next: (err?: Error) => void,
): void {
  const token = socket.handshake.auth?.token;
  if (typeof token !== "string" || token.length === 0) {
    next(new Error("Authentication required"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    socket.data.userId = payload.sub;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
}
