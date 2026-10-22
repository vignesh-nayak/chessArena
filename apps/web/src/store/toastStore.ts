import { create } from "zustand";

type Toast = {
  id: number;
  message: string;
};

type ToastState = {
  current: Toast | null;
  push: (message: string) => void;
  dismiss: () => void;
};

let nextId = 1;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  current: null,
  push: (message) => {
    if (hideTimer) clearTimeout(hideTimer);
    const toast = { id: nextId, message };
    nextId += 1;
    set({ current: toast });
    hideTimer = setTimeout(() => {
      set((state) => (state.current?.id === toast.id ? { current: null } : state));
    }, 4000);
  },
  dismiss: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ current: null });
  },
}));
