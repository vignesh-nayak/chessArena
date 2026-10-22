import rateLimit from "express-rate-limit";
import { sendError } from "../lib/errors.js";

export const AUTH_RATE_LIMIT_MESSAGE =
  "Too many attempts — try again later.";

/** Shared budget for login and signup: 5 requests / 15 minutes per IP. */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 429, "RATE_LIMITED", AUTH_RATE_LIMIT_MESSAGE);
  },
});
