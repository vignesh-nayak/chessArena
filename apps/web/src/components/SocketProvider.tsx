import { useEffect, type ReactNode } from "react";
import { connectRealtime, disconnectRealtime } from "../lib/socket";
import { useAuthStore } from "../store/authStore";

export function SocketProvider({ children }: { children: ReactNode }) {
  const bootstrapping = useAuthStore((s) => s.bootstrapping);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (bootstrapping) return;
    if (!accessToken) {
      disconnectRealtime();
      return;
    }

    connectRealtime(accessToken);
    const tokenAtStart = accessToken;
    return () => {
      const current = useAuthStore.getState().accessToken;
      if (!current || current === tokenAtStart) {
        disconnectRealtime();
      }
    };
  }, [accessToken, bootstrapping]);

  return children;
}
