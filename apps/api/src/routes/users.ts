import { Router } from "express";
import { asyncHandler, sendError } from "../lib/errors.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/requireAuth.js";
import { User, toMeResponse } from "../models/User.js";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const user = await User.findById(userId).lean();
  if (!user) {
    sendError(res, 401, "UNAUTHORIZED", "User not found");
    return;
  }

  res.status(200).json(toMeResponse(user));
}));
