import {
  PuzzleAttemptBodySchema,
  type PuzzleAttemptResponse,
} from "@chessarena/shared";
import { Router } from "express";
import mongoose from "mongoose";
import { nextRating } from "../lib/elo.js";
import { asyncHandler, sendError } from "../lib/errors.js";
import {
  dailyPuzzleIndex,
  fetchLichessDailyPuzzle,
  gradePuzzle,
  lichessTrainingUrl,
  sideToMove,
  utcDateKey,
} from "../lib/puzzles.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/requireAuth.js";
import { Puzzle } from "../models/Puzzle.js";
import { PuzzleAttempt } from "../models/PuzzleAttempt.js";
import { User } from "../models/User.js";

export const puzzlesRouter = Router();

puzzlesRouter.use(requireAuth);

function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === 11000
  );
}

function puzzleStats(user: {
  puzzleRating?: number | null;
  puzzlesSolved?: number | null;
}): { puzzleRating: number; puzzlesSolved: number } {
  return {
    puzzleRating: user.puzzleRating ?? 1200,
    puzzlesSolved: user.puzzlesSolved ?? 0,
  };
}

function attemptResponse(
  partial: Pick<PuzzleAttemptResponse, "status" | "puzzleRating" | "puzzlesSolved"> &
    Partial<PuzzleAttemptResponse>,
): PuzzleAttemptResponse {
  return {
    correct: partial.status === "solved",
    status: partial.status,
    reply: partial.reply ?? null,
    fen: partial.fen ?? null,
    alreadySolved: partial.alreadySolved ?? false,
    puzzleRating: partial.puzzleRating,
    puzzlesSolved: partial.puzzlesSolved,
  };
}

type DailyRow = {
  _id: mongoose.Types.ObjectId;
  fen: string;
  rating: number;
  theme: string;
  sourceId?: string | null;
};

async function hashedSeedPuzzle(dateKey: string): Promise<DailyRow | null> {
  const puzzles = await Puzzle.find({ source: { $exists: false } })
    .sort({ fen: 1 })
    .select("fen rating theme sourceId")
    .lean();
  if (puzzles.length === 0) return null;
  return puzzles[dailyPuzzleIndex(dateKey, puzzles.length)] ?? null;
}

async function saveLichessDaily(
  dateKey: string,
  fetched: {
    fen: string;
    solution: string[];
    rating: number;
    theme: string;
    sourceId: string;
  },
): Promise<DailyRow | null> {
  try {
    return await Puzzle.findOneAndUpdate(
      { sourceId: fetched.sourceId },
      {
        $set: {
          fen: fetched.fen,
          solution: fetched.solution,
          rating: fetched.rating,
          theme: fetched.theme,
          source: "lichess",
          sourceId: fetched.sourceId,
          dateKey,
        },
      },
      { upsert: true, new: true },
    )
      .select("fen rating theme sourceId")
      .lean();
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    return Puzzle.findOne({ dateKey }).select("fen rating theme sourceId").lean();
  }
}

async function resolveDailyPuzzle(dateKey: string): Promise<DailyRow | null> {
  const today = await Puzzle.findOne({ dateKey })
    .select("fen rating theme sourceId")
    .lean();
  if (today) return today;

  const fetched = await fetchLichessDailyPuzzle();
  if (fetched) {
    const saved = await saveLichessDaily(dateKey, fetched);
    if (saved) return saved;
  }

  const recent = await Puzzle.findOne({ source: "lichess" })
    .sort({ dateKey: -1 })
    .select("fen rating theme sourceId")
    .lean();
  if (recent) return recent;

  return hashedSeedPuzzle(dateKey);
}

puzzlesRouter.get("/daily", asyncHandler(async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const user = await User.findById(userId).select("puzzleRating puzzlesSolved").lean();

  if (!user) {
    sendError(res, 401, "UNAUTHORIZED", "User not found");
    return;
  }

  const puzzle = await resolveDailyPuzzle(utcDateKey(new Date()));
  if (!puzzle) {
    sendError(res, 404, "NOT_FOUND", "No puzzles are seeded");
    return;
  }

  const turn = sideToMove(puzzle.fen);
  if (!turn) {
    sendError(res, 500, "INTERNAL", "Daily puzzle FEN is invalid");
    return;
  }

  const solved = await PuzzleAttempt.exists({
    userId,
    puzzleId: puzzle._id,
  });
  const stats = puzzleStats(user);

  res.status(200).json({
    id: puzzle._id.toString(),
    fen: puzzle.fen,
    rating: puzzle.rating,
    theme: puzzle.theme,
    sideToMove: turn,
    alreadySolved: Boolean(solved),
    puzzleRating: stats.puzzleRating,
    puzzlesSolved: stats.puzzlesSolved,
    sourceUrl: puzzle.sourceId ? lichessTrainingUrl(puzzle.sourceId) : null,
  });
}));

puzzlesRouter.get("/history", asyncHandler(async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const attempts = await PuzzleAttempt.find({ userId })
    .sort({ solvedAt: -1 })
    .lean();

  const puzzles = await Puzzle.find({
    _id: { $in: attempts.map((attempt) => attempt.puzzleId) },
  })
    .select("theme rating")
    .lean();

  const byId = new Map(
    puzzles.map((puzzle) => [puzzle._id.toString(), puzzle]),
  );

  const items = attempts.flatMap((attempt) => {
    const puzzle = byId.get(attempt.puzzleId.toString());
    if (!puzzle) return [];
    return [
      {
        puzzleId: attempt.puzzleId.toString(),
        theme: puzzle.theme,
        rating: puzzle.rating,
        solvedAt: attempt.solvedAt.toISOString(),
        puzzleRating: attempt.puzzleRating,
      },
    ];
  });

  res.status(200).json({ items, total: items.length });
}));

puzzlesRouter.post("/:id/attempt", asyncHandler(async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const id = req.params.id ?? "";
  if (!mongoose.isValidObjectId(id)) {
    sendError(res, 404, "NOT_FOUND", "Puzzle not found");
    return;
  }

  const parsed = PuzzleAttemptBodySchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(
      res,
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid attempt",
    );
    return;
  }

  const [puzzle, user] = await Promise.all([
    Puzzle.findById(id).lean(),
    User.findById(userId).select("puzzleRating puzzlesSolved").lean(),
  ]);
  if (!user) {
    sendError(res, 401, "UNAUTHORIZED", "User not found");
    return;
  }
  if (!puzzle) {
    sendError(res, 404, "NOT_FOUND", "Puzzle not found");
    return;
  }

  const stats = puzzleStats(user);
  const existing = await PuzzleAttempt.findOne({
    userId,
    puzzleId: puzzle._id,
  }).lean();
  if (existing) {
    res.status(200).json(
      attemptResponse({
        status: "solved",
        alreadySolved: true,
        puzzleRating: stats.puzzleRating,
        puzzlesSolved: stats.puzzlesSolved,
      }),
    );
    return;
  }

  const grade = gradePuzzle(puzzle.fen, puzzle.solution, parsed.data.moves);
  if (grade.status !== "solved") {
    res.status(200).json(
      attemptResponse({
        status: grade.status,
        reply: grade.status === "continue" ? grade.reply : null,
        fen: grade.status === "continue" ? grade.fen : null,
        puzzleRating: stats.puzzleRating,
        puzzlesSolved: stats.puzzlesSolved,
      }),
    );
    return;
  }

  const next = nextRating(stats.puzzleRating, puzzle.rating, 1, stats.puzzlesSolved);
  try {
    await PuzzleAttempt.create({
      userId,
      puzzleId: puzzle._id,
      solvedAt: new Date(),
      puzzleRating: next,
    });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    const current = await User.findById(userId)
      .select("puzzleRating puzzlesSolved")
      .lean();
    const currentStats = puzzleStats(current ?? user);
    res.status(200).json(
      attemptResponse({
        status: "solved",
        alreadySolved: true,
        fen: grade.fen,
        puzzleRating: currentStats.puzzleRating,
        puzzlesSolved: currentStats.puzzlesSolved,
      }),
    );
    return;
  }

  await User.updateOne(
    { _id: userId },
    { $set: { puzzleRating: next }, $inc: { puzzlesSolved: 1 } },
  );

  res.status(200).json(
    attemptResponse({
      status: "solved",
      fen: grade.fen,
      alreadySolved: false,
      puzzleRating: next,
      puzzlesSolved: stats.puzzlesSolved + 1,
    }),
  );
}));
