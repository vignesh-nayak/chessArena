import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { GameHistoryResponse, MeResponse } from "@chessarena/shared";
import { EmptyState } from "../components/EmptyState";
import { LoadingPulse } from "../components/LoadingState";
import { TopBar } from "../components/TopBar";
import { apiFetch } from "../lib/api";
import {
  historyHref,
  historyKind,
  historyOpponent,
  historyResultLabel,
} from "../lib/gameHistory";
import { useAuthStore } from "../store/authStore";
import "./ProfilePage.css";

export function ProfilePage() {
  const userId = useAuthStore((s) => s.user?.id);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [history, setHistory] = useState<GameHistoryResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [meData, historyData] = await Promise.all([
          apiFetch<MeResponse>("/api/users/me"),
          apiFetch<GameHistoryResponse>("/api/games/history"),
        ]);
        if (!cancelled) {
          setMe(meData);
          setHistory(historyData);
          useAuthStore.getState().setRating(meData.rating);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Could not load profile");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="profile-page">
      <TopBar />

      <main className="profile-main">
        {loading ? (
          <LoadingPulse lines={5} />
        ) : loadError ? (
          <p className="profile-error" role="alert">
            {loadError}
          </p>
        ) : me ? (
          <>
            <div className="profile-intro">
              <p className="profile-kicker">Profile</p>
              <h1 className="profile-title">{me.username}</h1>
              <p className="profile-meta">Rating {me.rating}</p>
              <p className="profile-meta">
                Puzzle rating {me.puzzleRating} · {me.puzzlesSolved} solved
              </p>
              <p className="profile-meta">{me.email}</p>
            </div>

            <section className="profile-stats-section">
              <p className="profile-stats-heading">Stats</p>
              <div className="profile-stats">
                <div>
                  <p className="profile-stat-value">{me.stats.wins}</p>
                  <p className="profile-stat-label">Wins</p>
                </div>
                <div>
                  <p className="profile-stat-value">{me.stats.losses}</p>
                  <p className="profile-stat-label">Losses</p>
                </div>
                <div>
                  <p className="profile-stat-value">{me.stats.draws}</p>
                  <p className="profile-stat-label">Draws</p>
                </div>
              </div>
            </section>

            <section className="profile-recent">
              <div className="profile-section-head">
                <p className="profile-kicker">Recent games</p>
                <Link className="profile-quiet-link" to="/history">
                  History
                </Link>
              </div>
              {history && history.items.length === 0 ? (
                <EmptyState>
                  No games yet —{" "}
                  <Link className="profile-link" to="/home">
                    play vs AI
                  </Link>
                </EmptyState>
              ) : history ? (
                <ul className="profile-list">
                  {history.items.slice(0, 10).map((g) => (
                    <li key={g.id}>
                      <Link className="profile-link" to={historyHref(g)}>
                        vs {historyOpponent(g, userId)} · {historyKind(g)} ·{" "}
                        {historyResultLabel(g, userId)} ·{" "}
                        {new Date(g.createdAt).toLocaleString()}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <div className="profile-back">
              <Link className="profile-quiet-link" to="/home">
                Back to home
              </Link>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
