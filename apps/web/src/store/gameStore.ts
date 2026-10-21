import {
  getLegalMoves,
  getPieceColor,
  stateFromSans,
  toUci,
  type AiDifficulty,
  type GameEndReason,
  type GameEnded,
  type GameStateUpdate,
  type GameView,
  type LegalMoveTarget,
  type Side,
} from "@chessarena/shared";
import { create } from "zustand";
import { ApiRequestError, apiFetch } from "../lib/api";
import { getRealtimeSocket } from "../lib/socket";
import { useAuthStore } from "./authStore";

export type PendingPromotion = {
  from: string;
  to: string;
};

type LoadStatus = "idle" | "loading" | "ready" | "error";

type GameUiState = {
  gameId: string | null;
  fen: string;
  uciHistory: string[];
  moves: string[];
  lastMove: { from: string; to: string } | null;
  selectedSquare: string | null;
  legalTargets: LegalMoveTarget[];
  pendingPromotion: PendingPromotion | null;
  turn: Side;
  inCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  checkSquare: string | null;
  isGameOver: boolean;
  status: "in_progress" | "completed" | "abandoned" | null;
  result: "white" | "black" | "draw" | null;
  gameType: "ai" | "pvp" | null;
  myColor: Side;
  whiteName: string;
  blackName: string;
  aiDifficulty: AiDifficulty | null;
  loadStatus: LoadStatus;
  loadError: string | null;
  moving: boolean;
  aiThinking: boolean;
  aiError: string | null;
  drawOfferedBy: string | null;
  endReason: GameEndReason | null;
  moveError: string | null;
  applyGameView: (view: GameView) => void;
  applyRealtimeState: (update: GameStateUpdate) => void;
  applyGameEnded: (ended: GameEnded) => void;
  rejectPendingMove: (message: string) => void;
  loadGame: (gameId: string) => Promise<void>;
  selectSquare: (square: string | null) => void;
  attemptMove: (from: string, to: string, promotion?: string) => Promise<boolean>;
  completePromotion: (piece: "q" | "r" | "b" | "n") => Promise<boolean>;
  cancelPromotion: () => void;
  resign: () => Promise<boolean>;
  offerDraw: () => boolean;
  respondDraw: (accept: boolean) => boolean;
  createGame: (aiDifficulty: AiDifficulty) => Promise<GameView | null>;
  submitUci: (move: string) => Promise<boolean>;
  setAiThinking: (thinking: boolean) => void;
  setAiError: (error: string | null) => void;
};

function myColorFromView(view: GameView): Side {
  if (view.gameType !== "pvp") return "w";
  const userId = useAuthStore.getState().user?.id;
  if (userId && view.black.id === userId) return "b";
  return "w";
}

function clearSelection() {
  return {
    selectedSquare: null as string | null,
    legalTargets: [] as LegalMoveTarget[],
  };
}

type PositionSource = {
  moves: string[];
  fen: string;
  turn: Side;
  status: "in_progress" | "completed" | "abandoned";
  result: "white" | "black" | "draw" | null;
};

type PendingMove = {
  gameId: string;
  resolve: (ok: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
};

let pendingMove: PendingMove | null = null;

function settlePendingMove(ok: boolean): void {
  const pending = pendingMove;
  if (!pending) return;
  pendingMove = null;
  clearTimeout(pending.timer);
  pending.resolve(ok);
}

function flagsFromPosition(view: PositionSource) {
  const rebuilt = stateFromSans(view.moves);
  if (!rebuilt.ok) {
    return {
      fen: view.fen,
      uciHistory: [] as string[],
      turn: view.turn,
      inCheck: false,
      isCheckmate: view.status === "completed" && view.result !== "draw",
      isStalemate: false,
      isDraw: view.result === "draw",
      checkSquare: null as string | null,
      isGameOver: view.status !== "in_progress",
    };
  }
  return {
    fen: rebuilt.state.fen,
    uciHistory: rebuilt.state.uciHistory ?? [],
    turn: rebuilt.flags.turn,
    inCheck: rebuilt.flags.inCheck,
    isCheckmate: rebuilt.flags.isCheckmate,
    isStalemate: rebuilt.flags.isStalemate,
    isDraw: rebuilt.flags.isDraw,
    checkSquare: rebuilt.flags.checkSquare,
    isGameOver: view.status !== "in_progress" || rebuilt.flags.isGameOver,
  };
}

function moveNeedsPromotion(
  fen: string,
  uciHistory: string[],
  from: string,
  to: string,
): boolean {
  const targets = getLegalMoves({ fen, uciHistory }, from);
  return targets.some((t) => t.to === to && t.promotion);
}

export const useGameStore = create<GameUiState>((set, get) => ({
  gameId: null,
  fen: "",
  uciHistory: [],
  moves: [],
  lastMove: null,
  selectedSquare: null,
  legalTargets: [],
  pendingPromotion: null,
  turn: "w",
  inCheck: false,
  isCheckmate: false,
  isStalemate: false,
  isDraw: false,
  checkSquare: null,
  isGameOver: false,
  status: null,
  result: null,
  gameType: null,
  myColor: "w",
  whiteName: "White",
  blackName: "Black",
  aiDifficulty: null,
  loadStatus: "idle",
  loadError: null,
  moving: false,
  aiThinking: false,
  aiError: null,
  drawOfferedBy: null,
  endReason: null,
  moveError: null,

  applyGameView: (view) => {
    set({
      gameId: view.id,
      moves: view.moves,
      lastMove: view.lastMove,
      status: view.status,
      result: view.result,
      gameType: view.gameType,
      myColor: myColorFromView(view),
      whiteName: view.white.username,
      blackName: view.black.username,
      aiDifficulty: view.aiDifficulty,
      pendingPromotion: null,
      loadStatus: "ready",
      loadError: null,
      aiError: null,
      drawOfferedBy: null,
      endReason: null,
      moveError: null,
      ...clearSelection(),
      ...flagsFromPosition(view),
    });
  },

  applyRealtimeState: (update) => {
    const state = get();
    if (state.gameId && state.gameId !== update.gameId) return;
    if (pendingMove?.gameId === update.gameId) {
      settlePendingMove(true);
    }
    set({
      gameId: update.gameId,
      moves: update.moves,
      lastMove: update.lastMove,
      status: update.status,
      result: update.result,
      gameType: "pvp",
      drawOfferedBy: update.drawOfferedBy,
      pendingPromotion: null,
      loadStatus: "ready",
      loadError: null,
      moving: false,
      moveError: null,
      endReason: update.status === "in_progress" ? null : state.endReason,
      ...clearSelection(),
      ...flagsFromPosition(update),
    });
  },

  applyGameEnded: (ended) => {
    const state = get();
    if (state.gameId && state.gameId !== ended.gameId) return;
    if (pendingMove?.gameId === ended.gameId) {
      settlePendingMove(true);
    }
    set({
      status: "completed",
      result: ended.result,
      endReason: ended.reason,
      isGameOver: true,
      moving: false,
      moveError: null,
      pendingPromotion: null,
      ...clearSelection(),
    });
  },

  rejectPendingMove: (message) => {
    if (pendingMove || get().moving) {
      settlePendingMove(false);
      set({
        moving: false,
        moveError: message,
        ...clearSelection(),
      });
      return;
    }
    set({ moveError: message });
  },

  loadGame: async (gameId) => {
    settlePendingMove(false);
    set({
      loadStatus: "loading",
      loadError: null,
      gameId,
      moving: false,
      moveError: null,
      pendingPromotion: null,
      ...clearSelection(),
    });
    try {
      const view = await apiFetch<GameView>(`/api/games/${gameId}`);
      get().applyGameView(view);
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : "Could not load game";
      set({ loadStatus: "error", loadError: message });
    }
  },

  selectSquare: (square) => {
    const state = get();
    if (
      state.pendingPromotion ||
      state.isGameOver ||
      state.turn !== state.myColor ||
      state.status !== "in_progress" ||
      state.moving ||
      (state.gameType === "pvp" && !getRealtimeSocket()?.connected)
    ) {
      set(clearSelection());
      return;
    }

    if (!square) {
      set(clearSelection());
      return;
    }

    if (state.selectedSquare) {
      const isTarget = state.legalTargets.some((t) => t.to === square);
      if (isTarget) {
        void get().attemptMove(state.selectedSquare, square);
        return;
      }
    }

    const color = getPieceColor(
      { fen: state.fen, uciHistory: state.uciHistory },
      square,
    );
    if (color !== state.myColor) {
      set(clearSelection());
      return;
    }

    set({
      selectedSquare: square,
      legalTargets: getLegalMoves(
        { fen: state.fen, uciHistory: state.uciHistory },
        square,
      ),
    });
  },

  attemptMove: async (from, to, promotion) => {
    const state = get();
    if (
      state.isGameOver ||
      state.status !== "in_progress" ||
      state.turn !== state.myColor ||
      !state.gameId ||
      state.moving
    ) {
      set(clearSelection());
      return false;
    }

    if (!promotion && moveNeedsPromotion(state.fen, state.uciHistory, from, to)) {
      set({
        pendingPromotion: { from, to },
        ...clearSelection(),
      });
      return false;
    }

    const uci = toUci(from, to, promotion);
    if (state.gameType === "pvp") {
      const client = getRealtimeSocket();
      if (!client?.connected) {
        set({
          moving: false,
          moveError: "Realtime disconnected",
          ...clearSelection(),
        });
        return false;
      }

      set({
        moving: true,
        moveError: null,
        ...clearSelection(),
        pendingPromotion: null,
      });
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          if (pendingMove?.resolve !== resolve) return;
          pendingMove = null;
          set({
            moving: false,
            moveError: "Move was not confirmed",
            ...clearSelection(),
          });
          resolve(false);
        }, 8000);
        pendingMove = { gameId: state.gameId!, resolve, timer };
        client.emit("game:move", { gameId: state.gameId!, move: uci });
      });
    }

    set({ moving: true, ...clearSelection(), pendingPromotion: null });
    try {
      const view = await apiFetch<GameView>(`/api/games/${state.gameId}/move`, {
        method: "PATCH",
        body: { move: uci },
      });
      get().applyGameView(view);
      set({ moving: false });
      return true;
    } catch {
      set({ moving: false, ...clearSelection() });
      return false;
    }
  },

  completePromotion: async (piece) => {
    const pending = get().pendingPromotion;
    if (!pending) return false;
    return get().attemptMove(pending.from, pending.to, piece);
  },

  cancelPromotion: () => {
    set({ pendingPromotion: null, ...clearSelection() });
  },

  resign: async () => {
    const state = get();
    if (!state.gameId || state.status !== "in_progress") return false;
    if (state.gameType === "pvp") {
      const client = getRealtimeSocket();
      if (!client?.connected) {
        set({ moveError: "Realtime disconnected" });
        return false;
      }
      set({ moveError: null });
      client.emit("game:resign", { gameId: state.gameId });
      return true;
    }
    try {
      const view = await apiFetch<GameView>(
        `/api/games/${state.gameId}/resign`,
        { method: "PATCH" },
      );
      get().applyGameView(view);
      return true;
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Could not resign";
      set({ moveError: message });
      return false;
    }
  },

  offerDraw: () => {
    const state = get();
    if (!state.gameId || state.gameType !== "pvp" || state.status !== "in_progress") {
      return false;
    }
    const client = getRealtimeSocket();
    if (!client?.connected) {
      set({ moveError: "Realtime disconnected" });
      return false;
    }
    set({ moveError: null });
    client.emit("game:offerDraw", { gameId: state.gameId });
    return true;
  },

  respondDraw: (accept) => {
    const state = get();
    if (!state.gameId || state.gameType !== "pvp" || state.status !== "in_progress") {
      return false;
    }
    const client = getRealtimeSocket();
    if (!client?.connected) {
      set({ moveError: "Realtime disconnected" });
      return false;
    }
    set({ moveError: null });
    client.emit("game:respondDraw", { gameId: state.gameId, accept });
    return true;
  },

  createGame: async (aiDifficulty) => {
    try {
      const view = await apiFetch<GameView>("/api/games", {
        method: "POST",
        body: { gameType: "ai", aiDifficulty },
      });
      get().applyGameView(view);
      return view;
    } catch {
      return null;
    }
  },

  submitUci: async (move) => {
    const state = get();
    if (
      !state.gameId ||
      state.status !== "in_progress" ||
      state.isGameOver ||
      state.moving
    ) {
      return false;
    }

    set({ moving: true, aiError: null, ...clearSelection() });
    try {
      const view = await apiFetch<GameView>(`/api/games/${state.gameId}/move`, {
        method: "PATCH",
        body: { move },
      });
      get().applyGameView(view);
      set({ moving: false });
      return true;
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : "AI move was rejected";
      set({ moving: false, aiError: message });
      return false;
    }
  },

  setAiThinking: (thinking) => {
    set({ aiThinking: thinking });
  },

  setAiError: (error) => {
    set({ aiError: error });
  },
}));
