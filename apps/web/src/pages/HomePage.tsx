import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  AiDifficulty,
  GameHistoryResponse,
  GameView,
} from "@chessarena/shared";
import { FindMatchButton } from "../components/FindMatchButton";
import { TopBar } from "../components/TopBar";
import { apiFetch } from "../lib/api";
import {
  historyHref,
  historyKind,
  historyOpponent,
  historyResultLabel,
} from "../lib/gameHistory";
import { useAuthStore } from "../store/authStore";

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
    <div className="flex min-h-full flex-col">
      <TopBar />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-10">
        <div className="text-center">
          <h1 className="text-2xl font-medium text-text">
            Signed in as {user?.username}
          </h1>
          <p className="mt-2 text-sm text-muted">{user?.email}</p>
        </div>

        <section className="mt-10 space-y-4">
          <p className="text-sm tracking-wide text-muted uppercase">
            Play online
          </p>
          <FindMatchButton />
          <Link
            className="inline-block text-sm text-accent hover:underline"
            to="/lobby"
          >
            Open lobby
          </Link>
        </section>

        <section className="mt-10 space-y-4">
          <p className="text-sm tracking-wide text-muted uppercase">
            Play vs AI
          </p>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDifficulty(d.value)}
                className={
                  difficulty === d.value
                    ? "bg-accent px-3 py-1.5 text-sm font-medium text-bg"
                    : "border border-muted/40 px-3 py-1.5 text-sm text-muted"
                }
              >
                {d.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="w-full bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-60"
            disabled={starting}
            onClick={() => void onPlay()}
          >
            {starting ? "Starting…" : "Play vs AI"}
          </button>
          {startError ? (
            <p className="text-sm text-red-400" role="alert">
              {startError}
            </p>
          ) : null}
        </section>

        <section className="mt-10 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm tracking-wide text-muted uppercase">
              Recent games
            </p>
            <Link className="text-sm text-muted hover:text-accent" to="/history">
              History
            </Link>
          </div>
          {historyError ? (
            <p className="text-sm text-muted">{historyError}</p>
          ) : null}
          {!history ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : history.items.length === 0 ? (
            <p className="text-sm text-muted">No games yet — play vs AI</p>
          ) : (
            <ul className="space-y-2 text-left text-sm">
              {history.items.slice(0, 10).map((g) => (
                <li key={g.id}>
                  <Link
                    className="text-accent hover:underline"
                    to={historyHref(g)}
                  >
                    vs {historyOpponent(g, user?.id)} · {historyKind(g)} ·{" "}
                    {historyResultLabel(g, user?.id)} ·{" "}
                    {new Date(g.createdAt).toLocaleString()}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => void onLogout()}
            disabled={loggingOut}
            className="border border-muted/40 px-4 py-2 text-sm text-muted disabled:opacity-60"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
          {/* <Link className="text-sm text-muted hover:underline" to="/">
            API status
          </Link> */}
        </div>
      </main>
    </div>
  );
}
