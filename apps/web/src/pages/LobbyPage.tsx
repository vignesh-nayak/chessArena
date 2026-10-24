import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { LiveGame } from "@chessarena/shared";
import { EmptyState } from "../components/EmptyState";
import { FindMatchButton } from "../components/FindMatchButton";
import { LoadingPulse } from "../components/LoadingState";
import { TopBar } from "../components/TopBar";
import { useLobbyChallenges } from "../hooks/useLobbyChallenges";
import { useLobbyPresence } from "../hooks/useLobbyPresence";
import { apiFetch } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { useLobbyStore } from "../store/lobbyStore";
import { useRealtimeStore } from "../store/realtimeStore";
import "./LobbyPage.css";

export function LobbyPage() {
  useLobbyPresence();
  const { sendChallenge, acceptChallenge, declineChallenge } =
    useLobbyChallenges();
  const selfId = useAuthStore((s) => s.user?.id);
  const onlineUsers = useLobbyStore((s) => s.onlineUsers);
  const outgoing = useLobbyStore((s) => s.outgoing);
  const incoming = useLobbyStore((s) => s.incoming);
  const status = useRealtimeStore((s) => s.status);
  const lastErrorMessage = useRealtimeStore((s) => s.lastErrorMessage);
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadLive() {
      try {
        const data = await apiFetch<{ items: LiveGame[] }>("/api/games/live");
        if (!cancelled) setLiveGames(data.items);
      } catch {
        if (!cancelled) setLiveGames([]);
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    }
    void loadLive();
    const timer = setInterval(() => void loadLive(), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const connectionCopy =
    status === "connected"
      ? null
      : status === "disconnected"
        ? (lastErrorMessage ?? "Realtime disconnected")
        : "Connecting…";

  return (
    <div className="lobby-page">
      <TopBar />
      <main className="lobby-main">
        <h1 className="lobby-title">Lobby</h1>
        <p className="lobby-lead">Players currently in the lobby.</p>
        <div className="lobby-match">
          <FindMatchButton />
        </div>

        {incoming ? (
          <section className="lobby-challenge">
            <p className="lobby-challenge-text">{incoming.fromUsername} challenged you</p>
            <div className="lobby-actions">
              <button
                type="button"
                className="lobby-accept"
                onClick={() => acceptChallenge(incoming.challengeId)}
              >
                Accept
              </button>
              <button
                type="button"
                className="lobby-ghost"
                onClick={() => declineChallenge(incoming.challengeId)}
              >
                Decline
              </button>
            </div>
          </section>
        ) : null}

        <section className="lobby-section">
          <p className="lobby-kicker">Live games</p>
          {liveLoading ? (
            <LoadingPulse lines={3} />
          ) : liveGames.length === 0 ? (
            <EmptyState>No live games</EmptyState>
          ) : (
            <ul className="lobby-list">
              {liveGames.map((game) => {
                const mine =
                  game.white.id === selfId || game.black.id === selfId;
                return (
                  <li key={game.id} className="lobby-row">
                    <span className="lobby-name">
                      {game.white.username} vs {game.black.username}
                    </span>
                    <Link
                      className="lobby-ghost"
                      to={mine ? `/game/${game.id}` : `/game/${game.id}?spectate=1`}
                    >
                      {mine ? "Your game" : "Watch"}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="lobby-section">
          <p className="lobby-kicker">Online now</p>
          {connectionCopy ? (
            <p className="lobby-status" role="status">
              {connectionCopy}
            </p>
          ) : null}
          {onlineUsers.length === 0 ? (
            <EmptyState>No players online</EmptyState>
          ) : (
            <ul className="lobby-list">
              {onlineUsers.map((user) => {
                const isSelf = user.userId === selfId;
                const isPending = outgoing?.toUserId === user.userId;
                return (
                  <li key={user.userId} className="lobby-row">
                    <span className="lobby-name">
                      {user.username} <span className="lobby-rating">{user.rating}</span>
                    </span>
                    {isSelf ? (
                      <span className="lobby-you">You</span>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          status !== "connected" ||
                          Boolean(outgoing) ||
                          Boolean(incoming) ||
                          isPending
                        }
                        className="lobby-ghost"
                        onClick={() => sendChallenge(user.userId, user.username)}
                      >
                        {isPending ? "Pending…" : "Challenge"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
