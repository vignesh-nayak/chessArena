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
import "./HistoryPage.css";

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
    <div className="history-page">
      <TopBar />
      <main className="history-main">
        <h1 className="history-title">History</h1>
        <p className="history-lead">Your games, newest first.</p>

        {loading ? (
          <LoadingPulse lines={5} className="loading-pulse--offset" />
        ) : loadError ? (
          <p className="history-error" role="alert">
            {loadError}
          </p>
        ) : !history || history.items.length === 0 ? (
          <div className="history-empty">
            <EmptyState>
              No games yet —{" "}
              <Link className="history-link" to="/home">
                play vs AI
              </Link>
            </EmptyState>
          </div>
        ) : (
          <ul className="history-list">
            {history.items.map((game) => (
              <li key={game.id}>
                <Link className="history-link" to={historyHref(game)}>
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
