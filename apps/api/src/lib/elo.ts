export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

/** K is 32 until 30 rated games are recorded, then 16. */
export function kFactor(ratingHistoryLength: number): number {
  return ratingHistoryLength < 30 ? 32 : 16;
}

export function nextRating(
  rating: number,
  opponentRating: number,
  score: number,
  ratingHistoryLength: number,
): number {
  const updated =
    rating +
    kFactor(ratingHistoryLength) *
      (score - expectedScore(rating, opponentRating));
  return Math.max(0, Math.round(updated));
}
