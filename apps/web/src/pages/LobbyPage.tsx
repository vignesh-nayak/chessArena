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
    <div className="flex min-h-full flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-10">
        <h1 className="text-2xl font-medium text-text">Lobby</h1>
        <p className="mt-2 text-sm text-muted">
          Players currently in the lobby.
        </p>
        <div className="mt-6">
          <FindMatchButton />
        </div>

        {incoming ? (
          <section className="mt-8 space-y-3 border border-muted/40 px-4 py-3">
            <p className="text-sm text-text">
              {incoming.fromUsername} challenged you
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="bg-accent px-3 py-1.5 text-sm font-medium text-on-accent"
                onClick={() => acceptChallenge(incoming.challengeId)}
              >
                Accept
              </button>
              <button
                type="button"
                className="border border-muted/40 px-3 py-1.5 text-sm text-muted"
                onClick={() => declineChallenge(incoming.challengeId)}
              >
                Decline
              </button>
            </div>
          </section>
        ) : null}

        <section className="mt-10 space-y-3">
          <p className="text-sm tracking-wide text-muted uppercase">
            Live games
          </p>
          {liveLoading ? (
            <LoadingPulse lines={3} />
          ) : liveGames.length === 0 ? (
            <EmptyState>No live games</EmptyState>
          ) : (
            <ul className="space-y-2 text-left text-sm">
              {liveGames.map((game) => {
                const mine =
                  game.white.id === selfId || game.black.id === selfId;
                return (
                  <li
                    key={game.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-text">
                      {game.white.username} vs {game.black.username}
                    </span>
                    <Link
                      className="border border-muted/40 px-3 py-1.5 text-sm text-muted"
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

        <section className="mt-10 space-y-3">
          <p className="text-sm tracking-wide text-muted uppercase">
            Online now
          </p>
          {connectionCopy ? (
            <p className="text-sm text-muted" role="status">
              {connectionCopy}
            </p>
          ) : null}
          {onlineUsers.length === 0 ? (
            <EmptyState>No players online</EmptyState>
          ) : (
            <ul className="space-y-2 text-left text-sm">
              {onlineUsers.map((user) => {
                const isSelf = user.userId === selfId;
                const isPending = outgoing?.toUserId === user.userId;
                return (
                  <li
                    key={user.userId}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-text">
                      {user.username}{" "}
                      <span className="text-muted">{user.rating}</span>
                    </span>
                    {isSelf ? (
                      <span className="text-sm text-muted">You</span>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          status !== "connected" ||
                          Boolean(outgoing) ||
                          Boolean(incoming) ||
                          isPending
                        }
                        className="border border-muted/40 px-3 py-1.5 text-sm text-muted disabled:opacity-40"
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
