import { useEffect, useState } from "react";
import type { LeaderboardResponse } from "@chessarena/shared";
import { EmptyState } from "../components/EmptyState";
import { LoadingPulse } from "../components/LoadingState";
import { TopBar } from "../components/TopBar";
import { apiFetch, ApiRequestError } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export function LeaderboardPage() {
  const selfId = useAuthStore((s) => s.user?.id);
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await apiFetch<LeaderboardResponse>(
          "/api/leaderboard?limit=50",
        );
        if (!cancelled) setBoard(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiRequestError
              ? err.message
              : "Could not load leaderboard",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-10">
        <h1 className="text-2xl font-medium text-text">Leaderboard</h1>
        <p className="mt-2 text-sm text-muted">Top players by rating.</p>

        {loading ? (
          <LoadingPulse lines={6} className="mt-10 space-y-3" />
        ) : loadError ? (
          <p className="mt-10 text-sm text-red-400" role="alert">
            {loadError}
          </p>
        ) : !board || board.items.length === 0 ? (
          <div className="mt-10">
            <EmptyState>No players yet</EmptyState>
          </div>
        ) : (
          <ol className="mt-10 space-y-2 text-sm">
            {board.items.map((player, index) => {
              const isSelf = player.userId === selfId;
              return (
                <li
                  key={player.userId}
                  className={
                    isSelf
                      ? "flex items-center justify-between gap-3 border border-accent/60 px-3 py-2"
                      : "flex items-center justify-between gap-3 px-3 py-2"
                  }
                >
                  <span className="text-text">
                    {index + 1}. {player.username}
                    {isSelf ? " (You)" : ""}
                  </span>
                  <span className="text-muted">
                    {player.rating} · {player.stats.wins}-{player.stats.losses}-
                    {player.stats.draws}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </div>
  );
}
