import type { NextFunction, Request, Response } from "express";
import { sendError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";

export const USER_RATE_LIMIT_MESSAGE =
  "too many request from this user, blocked for 1hour";

export const TEST_ACCOUNT_EMAIL = "testchess@gmail.com";
export const DEFAULT_USER_RATE_LIMIT = 20;
export const TEST_ACCOUNT_RATE_LIMIT = 50;
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_BLOCK_MS = 60 * 60 * 1000;

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();
const blockedUntil = new Map<string, number>();

let nowFn: () => number = () => Date.now();
let testAccountUserId: string | null = null;

export function registerTestAccountUserId(userId: string): void {
  testAccountUserId = userId;
}

/** `null` restores the real clock. */
export function setUserRateLimitNow(fn: (() => number) | null): void {
  nowFn = fn ?? (() => Date.now());
}

export function resetUserRateLimit(): void {
  buckets.clear();
  blockedUntil.clear();
  testAccountUserId = null;
  nowFn = () => Date.now();
}

/**
 * Counts one HTTP request. A valid user id wins over an auth email, which
 * wins over the IP. The test account shares one bucket for its email and id.
 */
export function consumeRateLimit(input: {
  userId?: string | null;
  email?: string | null;
  ip: string;
}): { ok: boolean } {
  const now = nowFn();
  const ipKey = `ip:${normalizeIp(input.ip)}`;
  const subject = subjectFor(input);

  if (isBlocked(subject.key, now) || isBlocked(ipKey, now)) {
    return { ok: false };
  }

  const bucket = buckets.get(subject.key) ?? { timestamps: [] };
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  bucket.timestamps = bucket.timestamps.filter((stamp) => stamp > cutoff);

  if (bucket.timestamps.length >= subject.limit) {
    const until = now + RATE_LIMIT_BLOCK_MS;
    blockedUntil.set(subject.key, until);
    blockedUntil.set(ipKey, until);
    buckets.set(subject.key, bucket);
    return { ok: false };
  }

  bucket.timestamps.push(now);
  buckets.set(subject.key, bucket);
  return { ok: true };
}

function subjectFor(input: {
  userId?: string | null;
  email?: string | null;
  ip: string;
}): { key: string; limit: number } {
  const userId = input.userId?.trim() || null;
  if (userId) {
    if (userId === testAccountUserId) {
      return {
        key: `account:${TEST_ACCOUNT_EMAIL}`,
        limit: TEST_ACCOUNT_RATE_LIMIT,
      };
    }
    return { key: `user:${userId}`, limit: DEFAULT_USER_RATE_LIMIT };
  }

  const email = input.email?.trim().toLowerCase() || null;
  if (email) {
    if (email === TEST_ACCOUNT_EMAIL) {
      return {
        key: `account:${TEST_ACCOUNT_EMAIL}`,
        limit: TEST_ACCOUNT_RATE_LIMIT,
      };
    }
    return { key: `email:${email}`, limit: DEFAULT_USER_RATE_LIMIT };
  }

  return { key: `ip:${normalizeIp(input.ip)}`, limit: DEFAULT_USER_RATE_LIMIT };
}

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  return trimmed.length > 0 ? trimmed : "unknown";
}

function isBlocked(key: string, now: number): boolean {
  const until = blockedUntil.get(key);
  if (until === undefined) return false;
  if (until <= now) {
    blockedUntil.delete(key);
    return false;
  }
  return true;
}

function isExemptPath(path: string): boolean {
  return (
    path === "/api/games" ||
    path.startsWith("/api/games/") ||
    path === "/api/puzzles" ||
    path.startsWith("/api/puzzles/")
  );
}

function isAuthCredentialPath(req: Request): boolean {
  return (
    req.method === "POST" &&
    (req.path === "/api/auth/login" || req.path === "/api/auth/signup")
  );
}

function emailFromBody(req: Request): string | null {
  const body: unknown = req.body;
  if (typeof body !== "object" || body === null) return null;
  const email = (body as { email?: unknown }).email;
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function userIdFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    return verifyAccessToken(token).sub;
  } catch {
    return null;
  }
}

export function userRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isExemptPath(req.path)) {
    next();
    return;
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const userId = userIdFromRequest(req);
  const email = userId || !isAuthCredentialPath(req) ? null : emailFromBody(req);
  const decision = consumeRateLimit({ userId, email, ip });
  if (!decision.ok) {
    sendError(res, 429, "RATE_LIMITED", USER_RATE_LIMIT_MESSAGE);
    return;
  }
  next();
}
