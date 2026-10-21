import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GameStartedSchema } from "@chessarena/shared";
import { getRealtimeSocket } from "../lib/socket";
import { useLobbyStore } from "../store/lobbyStore";
import { useRealtimeStore } from "../store/realtimeStore";

export function useGameStartedNavigation(): void {
  const navigate = useNavigate();
  const status = useRealtimeStore((s) => s.status);

  useEffect(() => {
    const client = getRealtimeSocket();
    if (!client || status !== "connected") return;

    const onStarted = (payload: unknown) => {
      const parsed = GameStartedSchema.safeParse(payload);
      if (!parsed.success) return;
      useLobbyStore.getState().clearChallenges();
      navigate(`/game/${parsed.data.gameId}`);
    };

    client.on("game:started", onStarted);
    return () => {
      client.off("game:started", onStarted);
    };
  }, [navigate, status]);
}
