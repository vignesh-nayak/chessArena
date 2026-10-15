import {
  getLegalMoves,
  getPieceColor,
  stateFromSans,
  toUci,
  type AiDifficulty,
  type GameView,
  type LegalMoveTarget,
  type Side,
} from "@chessarena/shared";
import { create } from "zustand";
import { ApiRequestError, apiFetch } from "../lib/api";

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
  aiDifficulty: AiDifficulty | null;
  loadStatus: LoadStatus;
  loadError: string | null;
  moving: boolean;
  aiThinking: boolean;
  aiError: string | null;
  applyGameView: (view: GameView) => void;
  loadGame: (gameId: string) => Promise<void>;
  selectSquare: (square: string | null) => void;
  attemptMove: (from: string, to: string, promotion?: string) => Promise<boolean>;
  completePromotion: (piece: "q" | "r" | "b" | "n") => Promise<boolean>;
  cancelPromotion: () => void;
  resign: () => Promise<boolean>;
  createGame: (aiDifficulty: AiDifficulty) => Promise<GameView | null>;
  submitUci: (move: string) => Promise<boolean>;
  setAiThinking: (thinking: boolean) => void;
  setAiError: (error: string | null) => void;
};

function clearSelection() {
  return {
    selectedSquare: null as string | null,
    legalTargets: [] as LegalMoveTarget[],
  };
}

function flagsFromView(view: GameView) {
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
  aiDifficulty: null,
  loadStatus: "idle",
  loadError: null,
  moving: false,
  aiThinking: false,
  aiError: null,

  applyGameView: (view) => {
    set({
      gameId: view.id,
      moves: view.moves,
      lastMove: view.lastMove,
      status: view.status,
      result: view.result,
      aiDifficulty: view.aiDifficulty,
      pendingPromotion: null,
      loadStatus: "ready",
      loadError: null,
      aiError: null,
      ...clearSelection(),
      ...flagsFromView(view),
    });
  },

  loadGame: async (gameId) => {
    set({
      loadStatus: "loading",
      loadError: null,
      gameId,
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
      state.turn !== "w" ||
      state.status !== "in_progress" ||
      state.moving
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
    if (color !== "w") {
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
      state.turn !== "w" ||
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

    set({ moving: true, ...clearSelection(), pendingPromotion: null });
    try {
      const view = await apiFetch<GameView>(`/api/games/${state.gameId}/move`, {
        method: "PATCH",
        body: { move: toUci(from, to, promotion) },
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
    try {
      const view = await apiFetch<GameView>(
        `/api/games/${state.gameId}/resign`,
        { method: "PATCH" },
      );
      get().applyGameView(view);
      return true;
    } catch {
      return false;
    }
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
