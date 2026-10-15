import { create } from "zustand";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
};

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  bootstrapping: boolean;
  setBootstrapping: (value: boolean) => void;
  setAccessToken: (token: string) => void;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  bootstrapping: true,
  setBootstrapping: (value) => set({ bootstrapping: value }),
  setAccessToken: (token) => set({ accessToken: token }),
  setSession: (accessToken, user) =>
    set({ accessToken, user, bootstrapping: false }),
  clearSession: () =>
    set({ accessToken: null, user: null, bootstrapping: false }),
}));
