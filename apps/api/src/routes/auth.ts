import {
  LoginBodySchema,
  SignupBodySchema,
  type AuthSessionResponse,
} from "@chessarena/shared";
import bcrypt from "bcryptjs";
import { Router, type Request, type Response } from "express";
import { asyncHandler, sendError } from "../lib/errors.js";
import { authRateLimit } from "../middleware/authRateLimit.js";
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  setRefreshCookie,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/tokens.js";
import { User, toUserSummary } from "../models/User.js";

const BCRYPT_ROUNDS = 12;

export const authRouter = Router();

authRouter.post("/signup", authRateLimit, asyncHandler(async (req: Request, res: Response) => {
  const parsed = SignupBodySchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(
      res,
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid request body",
    );
    return;
  }

  const { username, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await User.findOne({
    $or: [{ email: normalizedEmail }, { username }],
  }).lean();

  if (existing) {
    const field =
      existing.email === normalizedEmail ? "Email" : "Username";
    sendError(res, 409, "CONFLICT", `${field} already in use`);
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      username,
      email: normalizedEmail,
      passwordHash,
    });

    const accessToken = signAccessToken(user._id.toString());
    const refreshToken = signRefreshToken(user._id.toString());
    setRefreshCookie(res, refreshToken);

    const body: AuthSessionResponse = {
      user: toUserSummary(user),
      accessToken,
    };
    res.status(201).json(body);
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      sendError(res, 409, "CONFLICT", "Username or email already in use");
      return;
    }
    throw err;
  }
}));

authRouter.post("/login", authRateLimit, asyncHandler(async (req: Request, res: Response) => {
  const parsed = LoginBodySchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(
      res,
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid request body",
    );
    return;
  }

  const { email, password } = parsed.data;
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash",
  );

  if (!user) {
    sendError(res, 401, "UNAUTHORIZED", "Invalid credentials");
    return;
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    sendError(res, 401, "UNAUTHORIZED", "Invalid credentials");
    return;
  }

  const accessToken = signAccessToken(user._id.toString());
  const refreshToken = signRefreshToken(user._id.toString());
  setRefreshCookie(res, refreshToken);

  const body: AuthSessionResponse = {
    user: toUserSummary(user),
    accessToken,
  };
  res.status(200).json(body);
}));

authRouter.post("/refresh", asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (typeof token !== "string" || !token) {
    sendError(res, 401, "UNAUTHORIZED", "Refresh token required");
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.sub).lean();
    if (!user) {
      clearRefreshCookie(res);
      sendError(res, 401, "UNAUTHORIZED", "Invalid refresh token");
      return;
    }

    const accessToken = signAccessToken(user._id.toString());
    res.status(200).json({ accessToken });
  } catch {
    clearRefreshCookie(res);
    sendError(res, 401, "UNAUTHORIZED", "Invalid or expired refresh token");
  }
}));

authRouter.post("/logout", (_req: Request, res: Response) => {
  clearRefreshCookie(res);
  res.status(204).send();
});
