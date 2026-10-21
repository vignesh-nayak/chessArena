import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MatchmakingMatchedSchema,
  SocketErrorPayloadSchema,
} from "@chessarena/shared";
import { getRealtimeSocket } from "../lib/socket";
import { useMatchmakingStore } from "../store/matchmakingStore";
import { useRealtimeStore } from "../store/realtimeStore";

const SEARCH_FAILURES = new Set([
  "You are already in a game",
  "Unsupported time control",
  "User not found",
]);

export function useMatchmaking(): void {
  const navigate = useNavigate();
  const status = useRealtimeStore((s) => s.status);

  useEffect(() => {
    const client = getRealtimeSocket();
    if (!client || status !== "connected") return;

    const onMatched = (payload: unknown) => {
      const parsed = MatchmakingMatchedSchema.safeParse(payload);
      if (!parsed.success) return;
      useMatchmakingStore.getState().stopSearch();
      navigate(`/game/${parsed.data.gameId}`);
    };

    const onError = (payload: unknown) => {
      const parsed = SocketErrorPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      const message = parsed.data.message;
      if (message === "You are already searching") return;
      if (!SEARCH_FAILURES.has(message)) return;
      useMatchmakingStore.getState().fail(message);
    };

    const onDisconnect = () => {
      useMatchmakingStore.getState().stopSearch();
    };

    client.on("matchmaking:matched", onMatched);
    client.on("error", onError);
    client.on("disconnect", onDisconnect);
    return () => {
      client.off("matchmaking:matched", onMatched);
      client.off("error", onError);
      client.off("disconnect", onDisconnect);
    };
  }, [navigate, status]);
}
