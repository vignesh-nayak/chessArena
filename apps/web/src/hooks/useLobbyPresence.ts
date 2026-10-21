import { useEffect } from "react";
import { getRealtimeSocket } from "../lib/socket";
import { useLobbyStore } from "../store/lobbyStore";
import { useRealtimeStore } from "../store/realtimeStore";

export function useLobbyPresence(): void {
  const status = useRealtimeStore((s) => s.status);
  const setOnlineUsers = useLobbyStore((s) => s.setOnlineUsers);
  const clear = useLobbyStore((s) => s.clear);

  useEffect(() => {
    const client = getRealtimeSocket();
    if (!client || status !== "connected") return;

    const onOnlineUsers = (users: unknown) => {
      if (!Array.isArray(users)) return;
      setOnlineUsers(users);
    };

    client.on("lobby:onlineUsers", onOnlineUsers);
    client.emit("lobby:join");

    return () => {
      client.off("lobby:onlineUsers", onOnlineUsers);
      if (client.connected) {
        client.emit("lobby:leave");
      }
      clear();
    };
  }, [clear, setOnlineUsers, status]);
}
