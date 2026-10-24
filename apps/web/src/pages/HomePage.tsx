import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  AiDifficulty,
  GameHistoryResponse,
  GameView,
} from "@chessarena/shared";
import { EmptyState } from "../components/EmptyState";
import { FindMatchButton } from "../components/FindMatchButton";
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
import "./HomePage.css";

const DIFFICULTIES: { value: AiDifficulty; label: string }[] = [
  { value: 1, label: "Easy" },
  { value: 2, label: "Medium" },
  { value: 3, label: "Hard" },
];

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [difficulty, setDifficulty] = useState<AiDifficulty>(2);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [history, setHistory] = useState<GameHistoryResponse | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      try {
        const data = await apiFetch<GameHistoryResponse>("/api/games/history");
        if (!cancelled) {
          setHistory(data);
          setHistoryError(null);
        }
      } catch {
        if (!cancelled) {
          setHistoryError("Could not load recent games");
        }
      }
    }
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onLogout() {
    setLoggingOut(true);
    try {
      await apiFetch<void>("/api/auth/logout", {
        method: "POST",
        retryOnUnauthorized: false,
      });
    } catch {
      // Clear local session even if the network call fails.
    } finally {
      clearSession();
      setLoggingOut(false);
      navigate("/login", { replace: true });
    }
  }

  async function onPlay() {
    setStarting(true);
    setStartError(null);
    try {
      const game = await apiFetch<GameView>("/api/games", {
        method: "POST",
        body: { gameType: "ai", aiDifficulty: difficulty },
      });
      navigate(`/game/${game.id}`);
    } catch {
      setStartError("Could not start game");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="home-page">
      <TopBar />

      <main className="home-main">
        <div className="home-intro">
          <h1 className="home-title">Signed in as {user?.username}</h1>
          <p className="home-email">{user?.email}</p>
        </div>

        <section className="home-section">
          <p className="home-kicker">Play online</p>
          <FindMatchButton />
          <Link className="home-link" to="/lobby">
            Open lobby
          </Link>
        </section>

        <section className="home-section">
          <p className="home-kicker">Daily puzzle</p>
          <Link className="home-link" to="/puzzles">
            Solve today's puzzle
          </Link>
        </section>

        <section className="home-section">
          <p className="home-kicker">Play vs AI</p>
          <div className="home-difficulties">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDifficulty(d.value)}
                className={
                  difficulty === d.value ? "home-difficulty--active" : "home-difficulty"
                }
              >
                {d.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="home-play"
            disabled={starting}
            onClick={() => void onPlay()}
          >
            {starting ? "Starting…" : "Play vs AI"}
          </button>
          {startError ? (
            <p className="home-error" role="alert">
              {startError}
            </p>
          ) : null}
        </section>

        <section className="home-section home-section--tight">
          <div className="home-section-head">
            <p className="home-kicker">Recent games</p>
            <Link className="home-quiet-link" to="/history">
              History
            </Link>
          </div>
          {historyError ? <p className="home-note">{historyError}</p> : null}
          {!history && !historyError ? (
            <LoadingPulse lines={4} />
          ) : history && history.items.length === 0 ? (
            <EmptyState>No games yet — play vs AI</EmptyState>
          ) : history ? (
            <ul className="home-list">
              {history.items.slice(0, 10).map((g) => (
                <li key={g.id}>
                  <Link className="home-link" to={historyHref(g)}>
                    vs {historyOpponent(g, user?.id)} · {historyKind(g)} ·{" "}
                    {historyResultLabel(g, user?.id)} ·{" "}
                    {new Date(g.createdAt).toLocaleString()}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <div className="home-footer">
          <button
            type="button"
            onClick={() => void onLogout()}
            disabled={loggingOut}
            className="home-logout"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </main>
    </div>
  );
}
