import {
  getFlags,
  replaySans,
  tryMove,
  type PuzzleReply,
  type Side,
} from "@chessarena/shared";

export type PuzzleGrade =
  | { status: "solved"; fen: string }
  | { status: "continue"; fen: string; reply: PuzzleReply | null }
  | { status: "incorrect" };

export type PuzzleSeed = {
  fen: string;
  solution: string[];
  rating: number;
  theme: string;
};

export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Stable index into a fen-sorted puzzle list. Same UTC date always hits the same slot. */
export function dailyPuzzleIndex(utcDate: string, count: number): number {
  if (count <= 0) return 0;
  let hash = 0;
  for (const char of utcDate) {
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  }
  return hash % count;
}

export function sideToMove(fen: string): Side | null {
  const start = replaySans(fen, []);
  return start.ok ? start.turn : null;
}

function toReply(move: {
  san: string;
  from: string;
  to: string;
  promotion?: string;
}): PuzzleReply {
  return move.promotion
    ? {
        san: move.san,
        from: move.from,
        to: move.to,
        promotion: move.promotion,
      }
    : { san: move.san, from: move.from, to: move.to };
}

/**
 * Grade a SAN prefix against the stored line.
 * Opponent replies are the odd plies. A matching prefix that still needs the
 * solver's move does not reveal that move.
 */
export function gradePuzzle(
  fen: string,
  solution: string[],
  moves: string[],
): PuzzleGrade {
  if (moves.length === 0 || solution.length === 0) {
    return { status: "incorrect" };
  }

  const line = replaySans(fen, solution);
  const attempt = replaySans(fen, moves);
  if (!line.ok || !attempt.ok) return { status: "incorrect" };
  if (attempt.moves.length > line.moves.length) return { status: "incorrect" };

  for (let i = 0; i < attempt.moves.length; i += 1) {
    if (attempt.moves[i]?.san !== line.moves[i]?.san) {
      return { status: "incorrect" };
    }
  }

  if (attempt.moves.length === line.moves.length) {
    return { status: "solved", fen: attempt.fen };
  }

  const nextIndex = attempt.moves.length;
  const next = line.moves[nextIndex];
  if (!next) return { status: "incorrect" };

  const nextIsOpponent = nextIndex % 2 === 1;
  if (!nextIsOpponent) {
    return { status: "continue", fen: attempt.fen, reply: null };
  }

  const throughReply = replaySans(fen, solution.slice(0, nextIndex + 1));
  if (!throughReply.ok) return { status: "incorrect" };

  return {
    status: "continue",
    fen: throughReply.fen,
    reply: toReply(next),
  };
}

function fenWithOpponentToMove(fen: string, sideToMove: Side): string | null {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2 || (parts[1] !== "w" && parts[1] !== "b")) return null;
  parts[1] = sideToMove === "w" ? "b" : "w";
  return parts.join(" ");
}

/** Returns an error string, or null when the puzzle can be seeded. */
export function validatePuzzleSeed(puzzle: PuzzleSeed): string | null {
  if (!puzzle.fen.trim()) return "FEN is empty";
  if (!puzzle.theme.trim()) return "Theme is empty";
  if (!Number.isInteger(puzzle.rating) || puzzle.rating < 0) {
    return "Rating must be a non-negative integer";
  }
  if (puzzle.solution.length === 0) return "Solution is empty";
  if (puzzle.solution.length % 2 === 0) {
    return "Solution must end on the solver's move";
  }

  const start = replaySans(puzzle.fen, []);
  if (!start.ok) return "FEN is invalid";

  const flipped = fenWithOpponentToMove(puzzle.fen, start.turn);
  const opponent = flipped ? replaySans(flipped, []) : null;
  if (!opponent?.ok) return "FEN is invalid";
  if (getFlags({ fen: opponent.fen }).inCheck) {
    return "Opponent is already in check at puzzle start";
  }

  const first = replaySans(puzzle.fen, [puzzle.solution[0] ?? ""]);
  if (!first.ok) return "First move is not legal for the side to move";

  const line = replaySans(puzzle.fen, puzzle.solution);
  if (!line.ok) return "Solution is illegal from this FEN";

  return null;
}

const GENERIC_LICHESS_THEMES = new Set([
  "opening",
  "middlegame",
  "endgame",
  "short",
  "long",
  "advantage",
]);

export const LICHESS_DAILY_URL = "https://lichess.org/api/puzzle/daily";
export const LICHESS_USER_AGENT = "ChessArena";

export type NormalizedLichessPuzzle = {
  fen: string;
  solution: string[];
  theme: string;
};

function lichessTheme(themes: string[]): string {
  const cleaned = themes.map((theme) => theme.trim()).filter(Boolean);
  return (
    cleaned.find((theme) => !GENERIC_LICHESS_THEMES.has(theme)) ??
    cleaned[0] ??
    "tactics"
  );
}

function replayUci(
  fen: string,
  uciMoves: string[],
): { sans: string[]; fenAfterFirst: string } | null {
  let current = fen;
  const sans: string[] = [];
  let fenAfterFirst = fen;
  for (const [index, uci] of uciMoves.entries()) {
    const result = tryMove({ fen: current }, uci);
    if (!result.ok) return null;
    sans.push(result.san);
    current = result.fen;
    if (index === 0) fenAfterFirst = result.fen;
  }
  return { sans, fenAfterFirst };
}

/**
 * Lichess `solution` is UCI from `fen`. An even-length list starts with the
 * opponent's setup move; the player sees the position after that move.
 */
export function normalizeLichessPuzzle(input: {
  fen: string;
  solution: string[];
  themes: string[];
}): NormalizedLichessPuzzle | null {
  if (!input.fen.trim() || input.solution.length === 0) return null;
  const played = replayUci(input.fen, input.solution);
  if (!played) return null;

  const setup = input.solution.length % 2 === 0;
  const fen = setup ? played.fenAfterFirst : input.fen;
  const solution = setup ? played.sans.slice(1) : played.sans;
  if (solution.length === 0) return null;

  const puzzle: NormalizedLichessPuzzle = {
    fen,
    solution,
    theme: lichessTheme(input.themes),
  };
  const problem = validatePuzzleSeed({ ...puzzle, rating: 1 });
  return problem ? null : puzzle;
}

export function lichessTrainingUrl(sourceId: string): string {
  return `https://lichess.org/training/${encodeURIComponent(sourceId)}`;
}

export function parseLichessDaily(body: unknown):
  | (NormalizedLichessPuzzle & { sourceId: string; rating: number })
  | null {
  if (typeof body !== "object" || body === null || !("puzzle" in body)) return null;
  const puzzle = body.puzzle;
  if (typeof puzzle !== "object" || puzzle === null) return null;
  const raw = puzzle as {
    id?: unknown;
    fen?: unknown;
    solution?: unknown;
    themes?: unknown;
    rating?: unknown;
  };
  if (typeof raw.id !== "string" || !raw.id.trim()) return null;
  if (typeof raw.fen !== "string") return null;
  if (!Array.isArray(raw.solution) || raw.solution.some((move) => typeof move !== "string")) {
    return null;
  }
  if (typeof raw.rating !== "number" || !Number.isInteger(raw.rating) || raw.rating < 0) {
    return null;
  }
  const themes = Array.isArray(raw.themes)
    ? raw.themes.filter((theme): theme is string => typeof theme === "string")
    : [];
  const normalized = normalizeLichessPuzzle({
    fen: raw.fen,
    solution: raw.solution,
    themes,
  });
  if (!normalized) return null;
  if (validatePuzzleSeed({ ...normalized, rating: raw.rating })) return null;
  return { sourceId: raw.id, rating: raw.rating, ...normalized };
}

export async function fetchLichessDailyPuzzle(
  fetchImpl: typeof fetch = fetch,
): Promise<(NormalizedLichessPuzzle & { sourceId: string; rating: number }) | null> {
  try {
    const response = await fetchImpl(LICHESS_DAILY_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": LICHESS_USER_AGENT,
      },
    });
    if (!response.ok) return null;
    return parseLichessDaily(await response.json());
  } catch {
    return null;
  }
}
