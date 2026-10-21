import type { AppSocket } from "./types.js";

export function emitSocketError(socket: AppSocket, message: string): void {
  socket.emit("error", { message });
}
