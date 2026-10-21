import { create } from "zustand";

export type RealtimeConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

type RealtimeState = {
  status: RealtimeConnectionStatus;
  lastErrorMessage: string | null;
  setStatus: (status: RealtimeConnectionStatus) => void;
  setError: (message: string | null) => void;
  setHardFailure: (message: string) => void;
  clearLastError: () => void;
};

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: "idle",
  lastErrorMessage: null,
  setStatus: (status) => set({ status }),
  setError: (message) => set({ lastErrorMessage: message }),
  setHardFailure: (message) =>
    set({ status: "disconnected", lastErrorMessage: message }),
  clearLastError: () => set({ lastErrorMessage: null }),
}));
