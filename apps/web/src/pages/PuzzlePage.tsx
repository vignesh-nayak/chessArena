import { useEffect, useMemo, useState } from "react";
import {
  getFlags,
  getLegalMoves,
  getPieceColor,
  solverBoardOrientation,
  toUci,
  tryMove,
  type DailyPuzzle,
  type PuzzleAttemptResponse,
  type PuzzleHistoryResponse,
  type Side,
} from "@chessarena/shared";
import { ChessBoard } from "../components/ChessBoard";
import { PlayerBar } from "../components/PlayerBar";
import { EmptyState } from "../components/EmptyState";
import { BoardLoading } from "../components/LoadingState";
import { TopBar } from "../components/TopBar";
import { apiFetch, ApiRequestError } from "../lib/api";
import "./PuzzlePage.css";

const PROMOTION_CHOICES = [
  ["q", "Queen"],
  ["r", "Rook"],
  ["b", "Bishop"],
  ["n", "Knight"],
] as const;

function formatLine(moves: string[], side: Side): string {
  const parts: string[] = [];
  let index = 0;
  let number = 1;
  if (side === "b" && moves[0]) {
    parts.push(`1... ${moves[0]}`);
    index = 1;
    number = 2;
  }
  while (index < moves.length) {
    const white = moves[index];
    const black = moves[index + 1];
    if (white && black) parts.push(`${number}. ${white} ${black}`);
    else if (white) parts.push(`${number}. ${white}`);
    index += 2;
    number += 1;
  }
  return parts.join("  ");
}

export function PuzzlePage() {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [fen, setFen] = useState("");
  const [moves, setMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerTone, setBannerTone] = useState<"ok" | "bad" | "muted">("muted");
  const [puzzleRating, setPuzzleRating] = useState(1200);
  const [puzzlesSolved, setPuzzlesSolved] = useState(0);
  const [history, setHistory] = useState<PuzzleHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [daily, past] = await Promise.all([
          apiFetch<DailyPuzzle>("/api/puzzles/daily"),
          apiFetch<PuzzleHistoryResponse>("/api/puzzles/history"),
        ]);
        if (cancelled) return;
        setPuzzle(daily);
        setFen(daily.fen);
        setMoves([]);
        setLastMove(null);
        setLocked(daily.alreadySolved);
        setPuzzleRating(daily.puzzleRating);
        setPuzzlesSolved(daily.puzzlesSolved);
        setHistory(past);
        if (daily.alreadySolved) {
          setBanner("Already solved today.");
          setBannerTone("muted");
        } else {
          setBanner(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiRequestError
              ? err.message
              : "Could not load the daily puzzle",
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

  const flags = useMemo(() => (fen ? getFlags({ fen }) : null), [fen]);
  const legalTargets = useMemo(() => {
    if (!selectedSquare || !fen) return [];
    return getLegalMoves({ fen }, selectedSquare);
  }, [fen, selectedSquare]);

  function clearSelection() {
    setSelectedSquare(null);
  }

  async function submitLine(
    nextMoves: string[],
    highlight: { from: string; to: string },
  ) {
    if (!puzzle) return;
    setSubmitting(true);
    setBanner(null);
    clearSelection();
    setPendingPromotion(null);
    try {
      const response = await apiFetch<PuzzleAttemptResponse>(
        `/api/puzzles/${puzzle.id}/attempt`,
        {
          method: "POST",
          body: { moves: nextMoves },
        },
      );

      if (response.status === "incorrect") {
        setBanner("Not the move. Try again.");
        setBannerTone("bad");
        return;
      }

      const reply = response.reply;
      const line = reply ? [...nextMoves, reply.san] : nextMoves;
      setMoves(line);
      if (response.fen) setFen(response.fen);
      setLastMove(reply ? { from: reply.from, to: reply.to } : highlight);
      setPuzzleRating(response.puzzleRating);
      setPuzzlesSolved(response.puzzlesSolved);

      if (response.status === "solved") {
        setLocked(true);
        setBanner(
          response.alreadySolved
            ? "Already solved. No extra credit."
            : `Solved. Puzzle rating ${response.puzzleRating}.`,
        );
        setBannerTone(response.alreadySolved ? "muted" : "ok");
        const past = await apiFetch<PuzzleHistoryResponse>(
          "/api/puzzles/history",
        );
        setHistory(past);
      }
    } catch (err) {
      setBanner(
        err instanceof ApiRequestError ? err.message : "Could not submit move",
      );
      setBannerTone("bad");
    } finally {
      setSubmitting(false);
    }
  }

  function play(from: string, to: string, promotion?: string) {
    if (!puzzle || !fen || locked || submitting) return;
    if (
      !promotion &&
      getLegalMoves({ fen }, from).some(
        (target) => target.to === to && target.promotion,
      )
    ) {
      setPendingPromotion({ from, to });
      clearSelection();
      return;
    }

    const result = tryMove({ fen }, toUci(from, to, promotion));
    if (!result.ok) return;
    void submitLine([...moves, result.san], {
      from: result.from,
      to: result.to,
    });
  }

  function onMove(from: string, to: string) {
    play(from, to);
    return false;
  }

  function onSelectSquare(square: string | null) {
    if (!puzzle || !fen || locked || submitting || pendingPromotion) {
      clearSelection();
      return;
    }
    if (!square) {
      clearSelection();
      return;
    }
    if (selectedSquare && legalTargets.some((target) => target.to === square)) {
      play(selectedSquare, square);
      return;
    }
    if (getPieceColor({ fen }, square) !== puzzle.sideToMove) {
      clearSelection();
      return;
    }
    if (flags?.turn !== puzzle.sideToMove) {
      clearSelection();
      return;
    }
    setSelectedSquare(square);
  }

  if (loading) {
    return <BoardLoading />;
  }

  if (loadError || !puzzle || !flags) {
    return (
      <div className="puzzle-page">
        <TopBar />
        <main className="puzzle-error">
          <p className="puzzle-error-text">
            {loadError ?? "Could not load the daily puzzle"}
          </p>
        </main>
      </div>
    );
  }

  const solverIsBlack = puzzle.sideToMove === "b";
  const orientation = solverBoardOrientation(puzzle.fen, puzzle.sideToMove);
  const canMove =
    !locked &&
    !submitting &&
    !pendingPromotion &&
    flags.turn === puzzle.sideToMove;

  return (
    <div className="puzzle-page">
      <TopBar />
      <div className="puzzle-layout">
        <section className="puzzle-board-column">
          <div className="puzzle-player-slot">
            <PlayerBar
              username="Puzzle"
              ratingLabel={String(puzzle.rating)}
              sideLabel={solverIsBlack ? "W" : "B"}
            />
          </div>
          <ChessBoard
            fen={fen}
            orientation={orientation}
            lastMove={lastMove ?? undefined}
            arePiecesDraggable={canMove}
            onMove={onMove}
            selectedSquare={selectedSquare}
            legalTargets={legalTargets}
            checkSquare={flags.checkSquare}
            turn={flags.turn}
            onSelectSquare={onSelectSquare}
          />
          <div className="puzzle-player-slot">
            <PlayerBar
              username="You"
              ratingLabel={String(puzzleRating)}
              sideLabel={solverIsBlack ? "B" : "W"}
            />
          </div>
        </section>

        <aside className="puzzle-side">
          <p className="puzzle-theme">{puzzle.theme}</p>
          {puzzle.sourceUrl ? (
            <a
              href={puzzle.sourceUrl}
              className="puzzle-source"
              target="_blank"
              rel="noreferrer"
            >
              Daily puzzle from Lichess
            </a>
          ) : null}
          <p className="puzzle-muted">
            Puzzle {puzzle.rating} · your rating {puzzleRating}
          </p>
          {banner ? (
            <p
              className={`puzzle-banner puzzle-banner--${bannerTone}`}
              role="status"
            >
              {banner}
            </p>
          ) : null}
          {submitting ? <p className="puzzle-muted">Checking…</p> : null}

          {pendingPromotion ? (
            <div className="puzzle-promote">
              <p className="puzzle-text">Promote to</p>
              <div className="puzzle-choices">
                {PROMOTION_CHOICES.map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    className="puzzle-btn-accent"
                    onClick={() => {
                      const pending = pendingPromotion;
                      setPendingPromotion(null);
                      play(pending.from, pending.to, code);
                    }}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  className="puzzle-btn-quiet"
                  onClick={() => setPendingPromotion(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {moves.length > 0 ? (
            <p className="puzzle-line">
              {formatLine(moves, puzzle.sideToMove)}
            </p>
          ) : null}

          <div className="puzzle-history">
            <div className="puzzle-history-heading">
              <p className="puzzle-kicker">Puzzle Solved History</p>
              <p className="puzzle-muted">({puzzlesSolved} solved)</p>
            </div>
            {!history || history.items.length === 0 ? (
              <EmptyState>None yet</EmptyState>
            ) : (
              history.items.slice(0, 8).map((item) => (
                <p
                  key={`${item.puzzleId}-${item.solvedAt}`}
                  className="puzzle-history-item"
                >
                  {item.theme} · {item.rating} · rating {item.puzzleRating}
                </p>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
