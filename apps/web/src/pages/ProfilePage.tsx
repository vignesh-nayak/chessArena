import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { GameHistoryResponse, MeResponse } from "@chessarena/shared";
import { TopBar } from "../components/TopBar";
import { apiFetch } from "../lib/api";

function gameResultLabel(g: GameHistoryResponse["items"][number]): string {
  if (g.status === "in_progress") return "In progress";
  if (g.result === "white") return "Win";
  if (g.result === "black") return "Loss";
  return "Draw";
}

export function ProfilePage() {
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
    <div className="flex min-h-full flex-col">
      <TopBar />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-10">
        {loading ? (
          <p className="text-center text-sm text-muted">Loading profile…</p>
        ) : loadError ? (
          <p className="text-center text-sm text-red-400" role="alert">
            {loadError}
          </p>
        ) : me ? (
          <>
            <div className="text-center">
              <p className="mb-2 text-sm tracking-wide text-muted uppercase">
                Profile
              </p>
              <h1 className="text-2xl font-medium text-text">{me.username}</h1>
              <p className="mt-2 text-sm text-muted">{me.email}</p>
            </div>

            <section className="mt-10">
              <p className="mb-4 text-center text-sm tracking-wide text-muted uppercase">
                Stats
              </p>
              <div className="flex justify-center gap-10 text-center">
                <div>
                  <p className="text-2xl font-medium text-text">
                    {me.stats.wins}
                  </p>
                  <p className="mt-1 text-sm text-muted">Wins</p>
                </div>
                <div>
                  <p className="text-2xl font-medium text-text">
                    {me.stats.losses}
                  </p>
                  <p className="mt-1 text-sm text-muted">Losses</p>
                </div>
                <div>
                  <p className="text-2xl font-medium text-text">
                    {me.stats.draws}
                  </p>
                  <p className="mt-1 text-sm text-muted">Draws</p>
                </div>
              </div>
            </section>

            <section className="mt-10 space-y-3">
              <p className="text-sm tracking-wide text-muted uppercase">
                Recent games
              </p>
              {!history ? (
                <p className="text-sm text-muted">Loading…</p>
              ) : history.items.length === 0 ? (
                <p className="text-sm text-muted">
                  No games yet —{" "}
                  <Link className="text-accent hover:underline" to="/home">
                    play vs AI
                  </Link>
                </p>
              ) : (
                <ul className="space-y-2 text-left text-sm">
                  {history.items.slice(0, 10).map((g) => (
                    <li key={g.id}>
                      <Link
                        className="text-accent hover:underline"
                        to={`/game/${g.id}`}
                      >
                        {gameResultLabel(g)} · {g.moveCount} moves ·{" "}
                        {new Date(g.updatedAt).toLocaleString()}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="mt-10 text-center">
              <Link
                className="text-sm text-muted hover:text-accent"
                to="/home"
              >
                Back to home
              </Link>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
