import { LeaderboardQuerySchema } from "@chessarena/shared";
import { Router } from "express";
import { asyncHandler, sendError } from "../lib/errors.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { User } from "../models/User.js";

export const leaderboardRouter = Router();

leaderboardRouter.use(requireAuth);

leaderboardRouter.get("/", asyncHandler(async (req, res) => {
  const rawLimit = req.query.limit;
  const parsed = LeaderboardQuerySchema.safeParse(
    rawLimit === undefined ? {} : { limit: rawLimit },
  );
  if (!parsed.success) {
    sendError(
      res,
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid limit",
    );
    return;
  }

  const users = await User.find({})
    .sort({ rating: -1, username: 1 })
    .limit(parsed.data.limit)
    .select("username rating stats")
    .lean();

  res.status(200).json({
    items: users.map((user) => ({
      userId: user._id.toString(),
      username: user.username,
      rating: user.rating ?? 1200,
      stats: {
        wins: user.stats?.wins ?? 0,
        losses: user.stats?.losses ?? 0,
        draws: user.stats?.draws ?? 0,
      },
    })),
  });
}));
