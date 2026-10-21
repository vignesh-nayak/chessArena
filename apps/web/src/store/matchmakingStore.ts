import { create } from "zustand";

type MatchmakingState = {
  searching: boolean;
  joinedAt: number | null;
  error: string | null;
  startSearch: () => void;
  stopSearch: () => void;
  fail: (message: string) => void;
};

export const useMatchmakingStore = create<MatchmakingState>((set) => ({
  searching: false,
  joinedAt: null,
  error: null,
  startSearch: () =>
    set({ searching: true, joinedAt: Date.now(), error: null }),
  stopSearch: () => set({ searching: false, joinedAt: null, error: null }),
  fail: (message) =>
    set({ searching: false, joinedAt: null, error: message }),
}));
