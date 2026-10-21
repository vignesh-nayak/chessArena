import type { GameHistoryResponse } from "@chessarena/shared";

type HistoryGame = GameHistoryResponse["items"][number];

export function historyOpponent(
  game: HistoryGame,
  userId: string | undefined,
): string {
  if (userId && game.black.id === userId) return game.white.username;
  return game.black.username;
}

export function historyResultLabel(
  game: HistoryGame,
  userId: string | undefined,
): string {
  if (game.status === "in_progress") return "In progress";
  if (game.result === "draw") return "Draw";
  if (game.result !== "white" && game.result !== "black") return "Abandoned";
  const viewerIsBlack = Boolean(userId) && game.black.id === userId;
  const viewerWon = viewerIsBlack
    ? game.result === "black"
    : game.result === "white";
  return viewerWon ? "Win" : "Loss";
}

export function historyKind(game: HistoryGame): string {
  return game.gameType === "ai" ? "AI" : "PvP";
}

export function historyHref(game: HistoryGame): string {
  return game.status === "in_progress"
    ? `/game/${game.id}`
    : `/game/${game.id}/replay`;
}
