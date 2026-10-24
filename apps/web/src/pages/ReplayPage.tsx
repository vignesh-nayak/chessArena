import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { START_FEN, stateFromSans, type GameReplay } from "@chessarena/shared";
import { ChessBoard } from "../components/ChessBoard";
import { MoveList } from "../components/MoveList";
import { PlayerBar } from "../components/PlayerBar";
import { BoardLoading } from "../components/LoadingState";
import { TopBar } from "../components/TopBar";
import { apiFetch, ApiRequestError } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import "./ReplayPage.css";

function ratingLabel(rating: number | null): string {
  return rating == null ? "—" : String(rating);
}

function resultText(replay: GameReplay): string {
  if (replay.result === "white") return "White wins";
  if (replay.result === "black") return "Black wins";
  if (replay.result === "draw") return "Draw";
  return "Abandoned";
}

export function ReplayPage() {
  const { id } = useParams<{ id: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const [replay, setReplay] = useState<GameReplay | null>(null);
  const [ply, setPly] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setReplay(null);
    setPly(0);
    async function load() {
      try {
        const data = await apiFetch<GameReplay>(`/api/games/${id}/replay`);
        if (!cancelled) setReplay(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiRequestError
              ? err.message
              : "Could not load replay",
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
  }, [id]);

  const position = useMemo(() => {
    if (!replay) return null;
    const rebuilt = stateFromSans(replay.moves.slice(0, ply));
    if (!rebuilt.ok) return null;
    const uci = rebuilt.state.uciHistory?.at(-1);
    const lastMove =
      uci && uci.length >= 4
        ? { from: uci.slice(0, 2), to: uci.slice(2, 4) }
        : undefined;
    return {
      fen: rebuilt.state.fen || START_FEN,
      turn: rebuilt.flags.turn,
      lastMove,
    };
  }, [ply, replay]);

  if (loading) {
    return <BoardLoading />;
  }

  if (loadError || !replay || !position) {
    return (
      <div className="replay-page">
        <TopBar />
        <main className="replay-error">
          <p className="replay-error-text">{loadError ?? "Could not load replay"}</p>
          <Link className="replay-link" to="/history">
            Back to history
          </Link>
        </main>
      </div>
    );
  }

  const viewerIsBlack = userId === replay.blackPlayer.id;
  const orientation = viewerIsBlack ? "black" : "white";
  const top = viewerIsBlack ? replay.whitePlayer : replay.blackPlayer;
  const bottom = viewerIsBlack ? replay.blackPlayer : replay.whitePlayer;
  const atStart = ply === 0;
  const atEnd = ply === replay.moves.length;

  return (
    <div className="replay-page">
      <TopBar />
      <div className="replay-layout">
        <section className="replay-board-column">
          <div className="replay-player-slot">
            <PlayerBar
              username={top.username}
              ratingLabel={ratingLabel(top.rating)}
              sideLabel={viewerIsBlack ? "W" : "B"}
            />
          </div>
          <ChessBoard
            fen={position.fen}
            orientation={orientation}
            lastMove={position.lastMove}
            arePiecesDraggable={false}
            onMove={() => false}
            turn={position.turn}
          />
          <div className="replay-player-slot">
            <PlayerBar
              username={bottom.username}
              ratingLabel={ratingLabel(bottom.rating)}
              sideLabel={viewerIsBlack ? "B" : "W"}
            />
          </div>
        </section>

        <aside className="replay-side">
          <p className="replay-status">Replay · {resultText(replay)}</p>
          <div className="replay-controls">
            <button
              type="button"
              aria-label="Start"
              className="replay-control"
              disabled={atStart}
              onClick={() => setPly(0)}
            >
              |&lt;
            </button>
            <button
              type="button"
              aria-label="Previous"
              className="replay-control"
              disabled={atStart}
              onClick={() => setPly((current) => Math.max(0, current - 1))}
            >
              &lt;
            </button>
            <button
              type="button"
              aria-label="Next"
              className="replay-control"
              disabled={atEnd}
              onClick={() =>
                setPly((current) => Math.min(replay.moves.length, current + 1))
              }
            >
              &gt;
            </button>
            <button
              type="button"
              aria-label="End"
              className="replay-control"
              disabled={atEnd}
              onClick={() => setPly(replay.moves.length)}
            >
              &gt;|
            </button>
          </div>
          <MoveList
            moves={replay.moves}
            currentPly={ply}
            onSelectPly={setPly}
          />
          <Link className="replay-back" to="/history">
            Back to history
          </Link>
        </aside>
      </div>
    </div>
  );
}
