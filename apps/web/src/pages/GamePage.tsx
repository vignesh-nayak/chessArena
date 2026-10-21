import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { AiDifficulty } from "@chessarena/shared";
import { ChessBoard } from "../components/ChessBoard";
import { GameChatPanel } from "../components/GameChatPanel";
import { MoveList } from "../components/MoveList";
import { PlayerBar } from "../components/PlayerBar";
import { TopBar } from "../components/TopBar";
import { useGameRealtimeSync } from "../hooks/useGameRealtimeSync";
import { levelFor } from "../lib/aiLevels";
import { StockfishEngine } from "../lib/stockfishEngine";
import { useAuthStore } from "../store/authStore";
import { useGameStore } from "../store/gameStore";
import { useRealtimeStore } from "../store/realtimeStore";

function ratingLabel(rating: number | null): string {
  return rating == null ? "—" : String(rating);
}

function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function useLiveClock(
  ms: number | null,
  active: boolean,
  updatedAt: number | null,
  running: boolean,
): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running || !active || updatedAt == null || ms == null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [running, active, updatedAt, ms]);

  if (ms == null) return null;
  if (!running || !active || updatedAt == null) return ms;
  return Math.max(0, ms - (now - updatedAt));
}

export function GamePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const fen = useGameStore((s) => s.fen);
  const moves = useGameStore((s) => s.moves);
  const lastMove = useGameStore((s) => s.lastMove);
  const selectedSquare = useGameStore((s) => s.selectedSquare);
  const legalTargets = useGameStore((s) => s.legalTargets);
  const pendingPromotion = useGameStore((s) => s.pendingPromotion);
  const turn = useGameStore((s) => s.turn);
  const inCheck = useGameStore((s) => s.inCheck);
  const isCheckmate = useGameStore((s) => s.isCheckmate);
  const isStalemate = useGameStore((s) => s.isStalemate);
  const isDraw = useGameStore((s) => s.isDraw);
  const checkSquare = useGameStore((s) => s.checkSquare);
  const isGameOver = useGameStore((s) => s.isGameOver);
  const status = useGameStore((s) => s.status);
  const result = useGameStore((s) => s.result);
  const aiDifficulty = useGameStore((s) => s.aiDifficulty);
  const gameType = useGameStore((s) => s.gameType);
  const myColor = useGameStore((s) => s.myColor);
  const whiteName = useGameStore((s) => s.whiteName);
  const blackName = useGameStore((s) => s.blackName);
  const whiteId = useGameStore((s) => s.whiteId);
  const blackId = useGameStore((s) => s.blackId);
  const whiteRating = useGameStore((s) => s.whiteRating);
  const blackRating = useGameStore((s) => s.blackRating);
  const whiteTime = useGameStore((s) => s.whiteTime);
  const blackTime = useGameStore((s) => s.blackTime);
  const clockUpdatedAt = useGameStore((s) => s.clockUpdatedAt);
  const loadStatus = useGameStore((s) => s.loadStatus);
  const loadError = useGameStore((s) => s.loadError);
  const moving = useGameStore((s) => s.moving);
  const aiThinking = useGameStore((s) => s.aiThinking);
  const aiError = useGameStore((s) => s.aiError);
  const endReason = useGameStore((s) => s.endReason);
  const moveError = useGameStore((s) => s.moveError);
  const drawOfferedBy = useGameStore((s) => s.drawOfferedBy);
  const loadGame = useGameStore((s) => s.loadGame);
  const selectSquare = useGameStore((s) => s.selectSquare);
  const attemptMove = useGameStore((s) => s.attemptMove);
  const completePromotion = useGameStore((s) => s.completePromotion);
  const cancelPromotion = useGameStore((s) => s.cancelPromotion);
  const resign = useGameStore((s) => s.resign);
  const offerDraw = useGameStore((s) => s.offerDraw);
  const respondDraw = useGameStore((s) => s.respondDraw);
  const createGame = useGameStore((s) => s.createGame);
  const submitUci = useGameStore((s) => s.submitUci);
  const setAiThinking = useGameStore((s) => s.setAiThinking);
  const setAiError = useGameStore((s) => s.setAiError);

  const [resigning, setResigning] = useState(false);
  const [creating, setCreating] = useState(false);
  const realtimeStatus = useRealtimeStore((s) => s.status);
  const realtimeError = useRealtimeStore((s) => s.lastErrorMessage);

  const wantsSpectate = searchParams.get("spectate") === "1";
  const isParticipant = Boolean(
    user?.id && (user.id === whiteId || user.id === blackId),
  );
  const syncMode =
    !id || (wantsSpectate && loadStatus !== "ready")
      ? "wait"
      : wantsSpectate && isParticipant
        ? "play"
        : wantsSpectate && status === "in_progress"
          ? "spectate"
          : wantsSpectate
            ? "readonly"
            : "play";
  const watching = syncMode === "spectate" || syncMode === "readonly";

  useGameRealtimeSync(id, syncMode);
  const whiteShown = useLiveClock(
    whiteTime,
    turn === "w",
    clockUpdatedAt,
    status === "in_progress",
  );
  const blackShown = useLiveClock(
    blackTime,
    turn === "b",
    clockUpdatedAt,
    status === "in_progress",
  );

  const engineRef = useRef<StockfishEngine | null>(null);
  const searchGenRef = useRef(0);
  const searchedFenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) {
      navigate("/home", { replace: true });
      return;
    }
    searchedFenRef.current = null;
    void loadGame(id);
  }, [id, loadGame, navigate]);

  useEffect(() => {
    if (!id || loadStatus !== "ready" || !wantsSpectate || !isParticipant) return;
    navigate(`/game/${id}`, { replace: true });
  }, [id, isParticipant, loadStatus, navigate, wantsSpectate]);

  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;
    return () => {
      searchGenRef.current += 1;
      engine.terminate();
      engineRef.current = null;
      setAiThinking(false);
    };
  }, [setAiThinking]);

  useEffect(() => {
    if (
      loadStatus !== "ready" ||
      status !== "in_progress" ||
      turn !== "b" ||
      isGameOver ||
      !fen ||
      !aiDifficulty
    ) {
      return;
    }

    // One search per position — refresh re-triggers because id effect clears the ref.
    if (searchedFenRef.current === fen) {
      return;
    }

    const engine = engineRef.current;
    if (!engine) return;

    searchedFenRef.current = fen;
    const gen = ++searchGenRef.current;
    const level = levelFor(aiDifficulty);
    const positionFen = fen;

    let cancelled = false;

    async function runAi() {
      setAiError(null);
      setAiThinking(true);
      try {
        await engine!.init();
        if (cancelled || gen !== searchGenRef.current) return;

        const bestMove = await engine!.go({
          fen: positionFen,
          skill: level.skill,
          depth: level.depth,
          movetime: level.movetime,
        });

        if (cancelled || gen !== searchGenRef.current) return;

        const ok = await submitUci(bestMove);
        if (!ok && gen === searchGenRef.current) {
          // Allow a fresh attempt after a failed submit (e.g. user refreshes).
          // Do not auto-loop: leave searchedFenRef set until fen/id changes.
        }
      } catch (err) {
        if (cancelled || gen !== searchGenRef.current) return;
        const message =
          err instanceof Error ? err.message : "AI failed to move";
        if (message === "Stockfish search aborted") return;
        setAiError(
          message.includes("worker") || message.includes("Stockfish")
            ? "AI engine failed to load. You can resign or start a new game."
            : message,
        );
      } finally {
        if (gen === searchGenRef.current) {
          setAiThinking(false);
        }
      }
    }

    void runAi();

    return () => {
      cancelled = true;
      searchGenRef.current += 1;
      engine.stop();
      setAiThinking(false);
      // Allow retry after abort (React Strict Mode remount, navigate away, etc.).
      if (searchedFenRef.current === positionFen) {
        searchedFenRef.current = null;
      }
    };
  }, [
    loadStatus,
    status,
    turn,
    isGameOver,
    fen,
    aiDifficulty,
    submitUci,
    setAiThinking,
    setAiError,
  ]);

  const onMove = useCallback(
    (from: string, to: string, promotion?: string) =>
      attemptMove(from, to, promotion),
    [attemptMove],
  );

  const statusText = (() => {
    if (gameType === "pvp" && realtimeStatus !== "connected") {
      return realtimeStatus === "disconnected"
        ? (realtimeError ?? "Realtime disconnected")
        : "Reconnecting…";
    }
    if (endReason === "resign") {
      return result === "black"
        ? "White resigned — Black wins"
        : "Black resigned — White wins";
    }
    if (endReason === "agreement") return "Draw by agreement";
    if (endReason === "timeout") {
      return result === "black"
        ? "White ran out of time — Black wins"
        : "Black ran out of time — White wins";
    }
    if (
      gameType !== "pvp" &&
      status === "completed" &&
      result === "black" &&
      !isCheckmate
    ) {
      return "You resigned — AI wins";
    }
    if (endReason === "checkmate" || isCheckmate) {
      return turn === "w" ? "Checkmate — Black wins" : "Checkmate — White wins";
    }
    if (endReason === "stalemate" || isStalemate) return "Stalemate";
    if (endReason === "insufficient_material") return "Draw — insufficient material";
    if (endReason === "threefold_repetition") return "Draw — threefold repetition";
    if (endReason === "fifty_move") return "Draw — fifty-move rule";
    if (isDraw || result === "draw" || endReason === "draw") return "Draw";
    if (syncMode === "spectate") return "Spectating";
    if (aiThinking) return "AI thinking…";
    if (inCheck) return "Check";
    if (turn === "b") return "Black to move";
    return "White to move";
  })();

  async function onResign() {
    if (!window.confirm("Resign this game?")) return;
    setResigning(true);
    searchGenRef.current += 1;
    engineRef.current?.stop();
    setAiThinking(false);
    await resign();
    setResigning(false);
  }

  async function onNewGame() {
    setCreating(true);
    searchGenRef.current += 1;
    engineRef.current?.stop();
    setAiThinking(false);
    const difficulty = (aiDifficulty ?? 2) as AiDifficulty;
    const view = await createGame(difficulty);
    setCreating(false);
    if (view) {
      navigate(`/game/${view.id}`);
    }
  }

  if (loadStatus === "loading" || loadStatus === "idle") {
    return (
      <main className="flex min-h-full items-center justify-center px-6">
        <p className="text-muted">Loading game…</p>
      </main>
    );
  }

  if (loadStatus === "error") {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-4 px-6">
        <p className="text-text">{loadError ?? "Could not load game"}</p>
        <Link className="text-accent hover:underline" to="/home">
          Back to home
        </Link>
      </main>
    );
  }

  const realtimeReady = gameType !== "pvp" || realtimeStatus === "connected";
  const canMove =
    !watching &&
    realtimeReady &&
    status === "in_progress" &&
    turn === myColor &&
    !pendingPromotion &&
    !moving &&
    !aiThinking &&
    !isGameOver;

  const opponentName = watching
    ? blackName
    : myColor === "b"
      ? whiteName
      : blackName;
  const selfName = watching
    ? whiteName
    : myColor === "b"
      ? blackName
      : (user?.username ?? whiteName);
  const opponentClock = myColor === "b" ? whiteShown : blackShown;
  const selfClock = myColor === "b" ? blackShown : whiteShown;
  const incomingDraw =
    gameType === "pvp" &&
    status === "in_progress" &&
    Boolean(drawOfferedBy) &&
    drawOfferedBy !== user?.id;
  const ownDrawOffer = Boolean(user?.id) && drawOfferedBy === user?.id;

  return (
    <div className="flex min-h-full flex-col">
      <TopBar />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-8 lg:flex-row lg:items-start lg:justify-center lg:gap-8">
        <section className="flex w-full flex-col items-center lg:w-auto">
          <div className="w-full max-w-[min(70vh,100%)]">
            <PlayerBar
              username={opponentName}
              ratingLabel={ratingLabel(
                myColor === "b" ? whiteRating : blackRating,
              )}
              sideLabel={myColor === "b" ? "W" : "B"}
              clockLabel={opponentClock == null ? null : formatClock(opponentClock)}
              clockLow={opponentClock != null && opponentClock < 20_000}
            />
          </div>
          <ChessBoard
            fen={fen}
            orientation={myColor === "b" ? "black" : "white"}
            lastMove={lastMove ?? undefined}
            arePiecesDraggable={canMove}
            onMove={onMove}
            selectedSquare={selectedSquare}
            legalTargets={legalTargets}
            checkSquare={checkSquare}
            turn={turn}
            onSelectSquare={watching ? undefined : selectSquare}
          />
          <div className="w-full max-w-[min(70vh,100%)]">
            <PlayerBar
              username={selfName}
              ratingLabel={ratingLabel(
                myColor === "b" ? blackRating : whiteRating,
              )}
              sideLabel={myColor === "b" ? "B" : "W"}
              clockLabel={selfClock == null ? null : formatClock(selfClock)}
              clockLow={selfClock != null && selfClock < 20_000}
            />
          </div>
        </section>

        <aside className="flex w-full flex-col gap-4 lg:w-64 lg:shrink-0 lg:self-stretch">
          <p className="text-sm text-muted">{statusText}</p>
          {moving && !aiThinking ? (
            <p className="text-sm text-muted">Saving move…</p>
          ) : null}
          {aiThinking ? (
            <p className="text-sm text-muted" aria-live="polite">
              AI thinking…
            </p>
          ) : null}
          {aiError ? (
            <p className="text-sm text-red-400" role="alert">
              {aiError}
            </p>
          ) : null}
          {moveError ? (
            <p className="text-sm text-red-400" role="alert">
              {moveError}
            </p>
          ) : null}

          {pendingPromotion && !watching ? (
            <div className="space-y-2">
              <p className="text-sm text-text">Promote to</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["q", "Queen"],
                    ["r", "Rook"],
                    ["b", "Bishop"],
                    ["n", "Knight"],
                  ] as const
                ).map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    className="bg-accent px-3 py-1.5 text-sm font-medium text-bg"
                    onClick={() => void completePromotion(code)}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm text-muted hover:text-text"
                  onClick={cancelPromotion}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <MoveList moves={moves} />

          {gameType === "pvp" && id && !watching ? (
            <GameChatPanel gameId={id} canSend={realtimeReady} />
          ) : null}

          {incomingDraw && !watching ? (
            <div className="space-y-2 border border-muted/40 px-3 py-3">
              <p className="text-sm text-text">{opponentName} offered a draw</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="bg-accent px-3 py-1.5 text-sm font-medium text-bg"
                  onClick={() => respondDraw(true)}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="border border-muted/40 px-3 py-1.5 text-sm text-muted"
                  onClick={() => respondDraw(false)}
                >
                  Decline
                </button>
              </div>
            </div>
          ) : null}

          {watching ? null : (
          <div className="mt-auto flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              className="border border-muted/40 px-3 py-1.5 text-sm text-muted disabled:opacity-40"
              disabled={
                !realtimeReady || status !== "in_progress" || resigning
              }
              onClick={() => void onResign()}
            >
              {resigning ? "Resigning…" : "Resign"}
            </button>
            {gameType === "pvp" ? (
              <button
                type="button"
                className="border border-muted/40 px-3 py-1.5 text-sm text-muted disabled:opacity-40"
                disabled={
                  !realtimeReady ||
                  status !== "in_progress" ||
                  ownDrawOffer ||
                  incomingDraw
                }
                onClick={() => offerDraw()}
              >
                {ownDrawOffer ? "Draw offered" : "Offer draw"}
              </button>
            ) : (
              <button
                type="button"
                className="bg-accent px-3 py-1.5 text-sm font-medium text-bg disabled:opacity-60"
                disabled={creating}
                onClick={() => void onNewGame()}
              >
                {creating ? "Starting…" : "New game"}
              </button>
            )}
          </div>
          )}
        </aside>
      </div>
    </div>
  );
}
