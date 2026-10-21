import { useEffect } from "react";
import {
  ChallengeDeclinedSchema,
  ChallengeReceivedSchema,
} from "@chessarena/shared";
import { getRealtimeSocket } from "../lib/socket";
import { useLobbyStore } from "../store/lobbyStore";
import { useRealtimeStore } from "../store/realtimeStore";

const OUTGOING_CLEAR_MESSAGES = new Set([
  "You cannot challenge yourself",
  "That player is not in the lobby",
  "You are already in a game",
  "That player is already in a game",
  "You already have a pending challenge",
  "That player already has a pending challenge",
  "Invalid challenge",
  "Challenge expired",
  "Challenge cancelled",
]);

export function useLobbyChallenges() {
  const status = useRealtimeStore((s) => s.status);
  const setIncoming = useLobbyStore((s) => s.setIncoming);
  const setOutgoing = useLobbyStore((s) => s.setOutgoing);
  const clearChallenges = useLobbyStore((s) => s.clearChallenges);

  useEffect(() => {
    const client = getRealtimeSocket();
    if (!client || status !== "connected") return;

    const onReceived = (payload: unknown) => {
      const parsed = ChallengeReceivedSchema.safeParse(payload);
      if (!parsed.success) return;
      setIncoming(parsed.data);
    };

    const onDeclined = (payload: unknown) => {
      const parsed = ChallengeDeclinedSchema.safeParse(payload);
      if (!parsed.success) return;
      const outgoing = useLobbyStore.getState().outgoing;
      if (outgoing) setOutgoing(null);
      if (useLobbyStore.getState().incoming?.challengeId === parsed.data.challengeId) {
        setIncoming(null);
      }
    };

    const onError = (payload: unknown) => {
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("message" in payload) ||
        typeof (payload as { message?: unknown }).message !== "string"
      ) {
        return;
      }
      const message = (payload as { message: string }).message;
      if (message === "Challenge expired" || message === "Challenge cancelled") {
        setIncoming(null);
      }
      if (OUTGOING_CLEAR_MESSAGES.has(message)) {
        setOutgoing(null);
      }
    };

    client.on("challenge:received", onReceived);
    client.on("challenge:declined", onDeclined);
    client.on("error", onError);

    return () => {
      client.off("challenge:received", onReceived);
      client.off("challenge:declined", onDeclined);
      client.off("error", onError);
    };
  }, [clearChallenges, setIncoming, setOutgoing, status]);

  function sendChallenge(toUserId: string, toUsername: string) {
    const client = getRealtimeSocket();
    if (!client?.connected) return;
    setOutgoing({ toUserId, toUsername });
    client.emit("challenge:send", { toUserId });
  }

  function acceptChallenge(challengeId: string) {
    const client = getRealtimeSocket();
    if (!client?.connected) return;
    client.emit("challenge:accept", { challengeId });
  }

  function declineChallenge(challengeId: string) {
    const client = getRealtimeSocket();
    if (!client?.connected) return;
    setIncoming(null);
    client.emit("challenge:decline", { challengeId });
  }

  return { sendChallenge, acceptChallenge, declineChallenge };
}
