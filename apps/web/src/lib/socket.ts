import {
  SocketErrorPayloadSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketHandshakeAuth,
} from "@chessarena/shared";
import { io, type Socket } from "socket.io-client";
import { useRealtimeStore } from "../store/realtimeStore";
import { useAuthStore } from "../store/authStore";
import { getApiBase, refreshAccessToken } from "./api";

export type AppClientSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

const AUTH_FAILURES = new Set([
  "Authentication required",
  "Invalid or expired token",
]);

let socket: AppClientSocket | null = null;
let authRetryInFlight = false;
let authRetried = false;

function isAuthFailure(message: string): boolean {
  return AUTH_FAILURES.has(message);
}

function currentAuthToken(): string {
  const auth = socket?.auth;
  if (
    typeof auth === "object" &&
    auth !== null &&
    "token" in auth &&
    typeof (auth as SocketHandshakeAuth).token === "string"
  ) {
    return (auth as SocketHandshakeAuth).token;
  }
  return "";
}

async function onConnectError(err: Error): Promise<void> {
  if (!isAuthFailure(err.message)) {
    useRealtimeStore.getState().setStatus("reconnecting");
    return;
  }

  if (authRetryInFlight || !socket) return;

  if (authRetried) {
    authRetried = false;
    socket.disconnect();
    useRealtimeStore.getState().setHardFailure("Realtime disconnected");
    return;
  }

  authRetryInFlight = true;
  authRetried = true;
  const failedToken = currentAuthToken();
  socket.disconnect();

  try {
    const nextToken = await refreshAccessToken();
    if (!socket) return;

    const sessionToken = useAuthStore.getState().accessToken;
    if (!nextToken || nextToken === failedToken || sessionToken !== nextToken) {
      authRetried = false;
      useRealtimeStore.getState().setHardFailure("Realtime disconnected");
      return;
    }

    socket.auth = { token: nextToken } satisfies SocketHandshakeAuth;
    useRealtimeStore.getState().setStatus("connecting");
    socket.connect();
  } finally {
    authRetryInFlight = false;
  }
}

function ensureSocket(): AppClientSocket {
  if (socket) return socket;

  socket = io(getApiBase(), {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });

  socket.on("connect", () => {
    authRetried = false;
    useRealtimeStore.getState().setStatus("connected");
    useRealtimeStore.getState().setError(null);
  });

  socket.on("disconnect", (reason) => {
    if (reason === "io client disconnect") {
      if (useRealtimeStore.getState().status !== "disconnected") {
        useRealtimeStore.getState().setStatus("idle");
      }
      return;
    }
    useRealtimeStore.getState().setStatus("reconnecting");
  });

  socket.on("connect_error", (err) => {
    void onConnectError(err);
  });

  socket.on("error", (payload) => {
    const parsed = SocketErrorPayloadSchema.safeParse(payload);
    if (!parsed.success) return;
    useRealtimeStore.getState().setError(parsed.data.message);
  });

  return socket;
}

export function connectRealtime(token: string): AppClientSocket {
  const client = ensureSocket();
  client.auth = { token } satisfies SocketHandshakeAuth;
  if (!client.connected) {
    useRealtimeStore.getState().setStatus("connecting");
    client.connect();
  }
  return client;
}

export function disconnectRealtime(): void {
  if (!socket) return;
  socket.disconnect();
  if (useRealtimeStore.getState().status !== "disconnected") {
    useRealtimeStore.getState().setStatus("idle");
  }
}

export function getRealtimeSocket(): AppClientSocket | null {
  return socket;
}
