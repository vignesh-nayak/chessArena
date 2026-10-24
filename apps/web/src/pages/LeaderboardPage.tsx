import { useEffect, useState } from "react";
import type { LeaderboardResponse } from "@chessarena/shared";
import { EmptyState } from "../components/EmptyState";
import { LoadingPulse } from "../components/LoadingState";
import { TopBar } from "../components/TopBar";
import { apiFetch, ApiRequestError } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import "./LeaderboardPage.css";

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
    <div className="leaderboard-page">
      <TopBar />
      <main className="leaderboard-main">
        <h1 className="leaderboard-title">Leaderboard</h1>
        <p className="leaderboard-lead">Top players by rating.</p>

        {loading ? (
          <LoadingPulse lines={6} className="loading-pulse--offset" />
        ) : loadError ? (
          <p className="leaderboard-error" role="alert">
            {loadError}
          </p>
        ) : !board || board.items.length === 0 ? (
          <div className="leaderboard-empty">
            <EmptyState>No players yet</EmptyState>
          </div>
        ) : (
          <ol className="leaderboard-list">
            {board.items.map((player, index) => {
              const isSelf = player.userId === selfId;
              return (
                <li
                  key={player.userId}
                  className={isSelf ? "leaderboard-row leaderboard-row--self" : "leaderboard-row"}
                >
                  <span className="leaderboard-name">
                    {index + 1}. {player.username}
                    {isSelf ? " (You)" : ""}
                  </span>
                  <span className="leaderboard-meta">
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
