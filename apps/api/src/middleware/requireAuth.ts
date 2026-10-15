import type { NextFunction, Request, Response } from "express";
import { sendError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";

export type AuthenticatedRequest = Request & {
  userId: string;
};

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    sendError(res, 401, "UNAUTHORIZED", "Authentication required");
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    sendError(res, 401, "UNAUTHORIZED", "Authentication required");
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).userId = payload.sub;
    next();
  } catch {
    sendError(res, 401, "UNAUTHORIZED", "Invalid or expired token");
  }
}
