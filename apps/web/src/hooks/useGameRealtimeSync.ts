import { useEffect } from "react";
import {
  GameClockUpdateSchema,
  GameEndedSchema,
  GameStateUpdateSchema,
  GameTimeoutSchema,
  SocketErrorPayloadSchema,
  SpectateStateUpdateSchema,
} from "@chessarena/shared";
import { refreshViewerRating } from "../lib/api";
import { getRealtimeSocket } from "../lib/socket";
import { useGameStore } from "../store/gameStore";
import { useRealtimeStore } from "../store/realtimeStore";
import { CHAT_ERROR_MESSAGES } from "./useGameChat";

export function useGameRealtimeSync(
  gameId: string | undefined,
  mode: "wait" | "play" | "spectate" | "readonly" = "play",
): void {
  const status = useRealtimeStore((s) => s.status);
  const gameType = useGameStore((s) => s.gameType);
  const loadedId = useGameStore((s) => s.gameId);

  useEffect(() => {
    if (mode === "wait" || mode === "readonly") return;
    if (!gameId || loadedId !== gameId || gameType !== "pvp") return;
    if (status !== "connected") return;

    const client = getRealtimeSocket();
    if (!client) return;

    const onState = (payload: unknown) => {
      const parsed = GameStateUpdateSchema.safeParse(payload);
      if (!parsed.success || parsed.data.gameId !== gameId) return;
      useGameStore.getState().applyRealtimeState(parsed.data);
    };

    const onClock = (payload: unknown) => {
      const parsed = GameClockUpdateSchema.safeParse(payload);
      if (!parsed.success || parsed.data.gameId !== gameId) return;
      useGameStore.getState().applyClockUpdate(parsed.data);
    };

    const onTimeout = (payload: unknown) => {
      const parsed = GameTimeoutSchema.safeParse(payload);
      if (!parsed.success || parsed.data.gameId !== gameId) return;
      const state = useGameStore.getState();
      state.applyClockUpdate({
        gameId,
        whiteTime: parsed.data.winner === "black" ? 0 : (state.whiteTime ?? 0),
        blackTime: parsed.data.winner === "white" ? 0 : (state.blackTime ?? 0),
      });
      state.applyGameEnded({
        gameId,
        result: parsed.data.winner,
        reason: "timeout",
      });
    };

    const onSpectate = (payload: unknown) => {
      const parsed = SpectateStateUpdateSchema.safeParse(payload);
      if (!parsed.success || parsed.data.gameId !== gameId) return;
      if (parsed.data.whiteTime == null || parsed.data.blackTime == null) return;
      useGameStore.getState().applyClockUpdate({
        gameId,
        whiteTime: parsed.data.whiteTime,
        blackTime: parsed.data.blackTime,
      });
    };

    const onEnded = (payload: unknown) => {
      const parsed = GameEndedSchema.safeParse(payload);
      if (!parsed.success || parsed.data.gameId !== gameId) return;
      useGameStore.getState().applyGameEnded(parsed.data);
      void useGameStore.getState().refreshPlayerRatings();
      void refreshViewerRating().catch(() => {
        // The profile page refetches the same rating.
      });
    };

    const onError = (payload: unknown) => {
      const parsed = SocketErrorPayloadSchema.safeParse(payload);
      if (!parsed.success || CHAT_ERROR_MESSAGES.has(parsed.data.message)) {
        return;
      }
      useGameStore.getState().rejectPendingMove(parsed.data.message);
    };

    client.on("game:stateUpdate", onState);
    client.on("game:clockUpdate", onClock);
    client.on("game:timeout", onTimeout);
    client.on("game:ended", onEnded);
    client.on("error", onError);
    if (mode === "spectate") {
      client.on("spectate:stateUpdate", onSpectate);
      client.emit("spectate:join", { gameId });
    } else {
      client.emit("game:join", { gameId });
    }

    return () => {
      client.off("game:stateUpdate", onState);
      client.off("game:clockUpdate", onClock);
      client.off("game:timeout", onTimeout);
      client.off("game:ended", onEnded);
      client.off("error", onError);
      if (mode === "spectate") {
        client.off("spectate:stateUpdate", onSpectate);
        client.emit("spectate:leave", { gameId });
      }
    };
  }, [gameId, gameType, loadedId, mode, status]);
}
