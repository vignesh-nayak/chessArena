import { useEffect, useState } from "react";
import {
  ChatNewMessageSchema,
  SocketErrorPayloadSchema,
  type ChatNewMessage,
} from "@chessarena/shared";
import { getRealtimeSocket } from "../lib/socket";
import { useGameStore } from "../store/gameStore";
import { useRealtimeStore } from "../store/realtimeStore";

export const CHAT_ERROR_MESSAGES = new Set([
  "Invalid message",
  "Message is empty",
  "Message is too long",
  "Slow down",
]);

export function useGameChat(gameId: string | undefined) {
  const status = useRealtimeStore((s) => s.status);
  const gameType = useGameStore((s) => s.gameType);
  const loadedId = useGameStore((s) => s.gameId);
  const [messages, setMessages] = useState<ChatNewMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [gameId]);

  useEffect(() => {
    if (!gameId || loadedId !== gameId || gameType !== "pvp") return;
    if (status !== "connected") return;

    const client = getRealtimeSocket();
    if (!client) return;

    const onMessage = (payload: unknown) => {
      const parsed = ChatNewMessageSchema.safeParse(payload);
      if (!parsed.success || parsed.data.gameId !== gameId) return;
      setMessages((current) => [...current, parsed.data]);
      setError(null);
    };

    const onError = (payload: unknown) => {
      const parsed = SocketErrorPayloadSchema.safeParse(payload);
      if (!parsed.success || !CHAT_ERROR_MESSAGES.has(parsed.data.message)) {
        return;
      }
      setError(parsed.data.message);
    };

    client.on("chat:newMessage", onMessage);
    client.on("error", onError);

    return () => {
      client.off("chat:newMessage", onMessage);
      client.off("error", onError);
    };
  }, [gameId, gameType, loadedId, status]);

  function send(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Message is empty");
      return false;
    }
    if (trimmed.length > 200) {
      setError("Message is too long");
      return false;
    }

    const client = getRealtimeSocket();
    if (!gameId || !client?.connected) {
      setError("Realtime disconnected");
      return false;
    }

    setError(null);
    client.emit("chat:message", { gameId, text: trimmed });
    return true;
  }

  return { messages, error, send };
}
