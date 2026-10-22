import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { GameHistoryResponse } from "@chessarena/shared";
import { EmptyState } from "../components/EmptyState";
import { LoadingPulse } from "../components/LoadingState";
import { TopBar } from "../components/TopBar";
import { apiFetch, ApiRequestError } from "../lib/api";
import {
  historyHref,
  historyKind,
  historyOpponent,
  historyResultLabel,
} from "../lib/gameHistory";
import { useAuthStore } from "../store/authStore";

export function HistoryPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const [history, setHistory] = useState<GameHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await apiFetch<GameHistoryResponse>("/api/games/history");
        if (!cancelled) setHistory(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiRequestError
              ? err.message
              : "Could not load history",
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
        <h1 className="text-2xl font-medium text-text">History</h1>
        <p className="mt-2 text-sm text-muted">Your games, newest first.</p>

        {loading ? (
          <LoadingPulse lines={5} className="mt-10 space-y-3" />
        ) : loadError ? (
          <p className="mt-10 text-sm text-red-400" role="alert">
            {loadError}
          </p>
        ) : !history || history.items.length === 0 ? (
          <div className="mt-10">
            <EmptyState>
              No games yet —{" "}
              <Link className="text-accent hover:underline" to="/home">
                play vs AI
              </Link>
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-10 space-y-2 text-left text-sm">
            {history.items.map((game) => (
              <li key={game.id}>
                <Link
                  className="text-accent hover:underline"
                  to={historyHref(game)}
                >
                  vs {historyOpponent(game, userId)} · {historyKind(game)} ·{" "}
                  {historyResultLabel(game, userId)} ·{" "}
                  {new Date(game.createdAt).toLocaleString()}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
