import { useEffect } from "react";
import {
  GameEndedSchema,
  GameStateUpdateSchema,
  SocketErrorPayloadSchema,
} from "@chessarena/shared";
import { getRealtimeSocket } from "../lib/socket";
import { useGameStore } from "../store/gameStore";
import { useRealtimeStore } from "../store/realtimeStore";
import { CHAT_ERROR_MESSAGES } from "./useGameChat";

export function useGameRealtimeSync(gameId: string | undefined): void {
  const status = useRealtimeStore((s) => s.status);
  const gameType = useGameStore((s) => s.gameType);
  const loadedId = useGameStore((s) => s.gameId);

  useEffect(() => {
    if (!gameId || loadedId !== gameId || gameType !== "pvp") return;
    if (status !== "connected") return;

    const client = getRealtimeSocket();
    if (!client) return;

    const onState = (payload: unknown) => {
      const parsed = GameStateUpdateSchema.safeParse(payload);
      if (!parsed.success || parsed.data.gameId !== gameId) return;
      useGameStore.getState().applyRealtimeState(parsed.data);
    };

    const onEnded = (payload: unknown) => {
      const parsed = GameEndedSchema.safeParse(payload);
      if (!parsed.success || parsed.data.gameId !== gameId) return;
      useGameStore.getState().applyGameEnded(parsed.data);
    };

    const onError = (payload: unknown) => {
      const parsed = SocketErrorPayloadSchema.safeParse(payload);
      if (!parsed.success || CHAT_ERROR_MESSAGES.has(parsed.data.message)) {
        return;
      }
      useGameStore.getState().rejectPendingMove(parsed.data.message);
    };

    client.on("game:stateUpdate", onState);
    client.on("game:ended", onEnded);
    client.on("error", onError);
    client.emit("game:join", { gameId });

    return () => {
      client.off("game:stateUpdate", onState);
      client.off("game:ended", onEnded);
      client.off("error", onError);
    };
  }, [gameId, gameType, loadedId, status]);
}
