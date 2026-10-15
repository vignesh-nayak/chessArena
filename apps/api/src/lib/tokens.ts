import jwt from "jsonwebtoken";
import type { CookieOptions, Response } from "express";
import { env } from "../env.js";

export type AccessTokenPayload = {
  sub: string;
  typ: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  typ: "refresh";
};

export function signAccessToken(userId: string): string {
  const payload: AccessTokenPayload = { sub: userId, typ: "access" };
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtl,
  });
}

export function signRefreshToken(userId: string): string {
  const payload: RefreshTokenPayload = { sub: userId, typ: "refresh" };
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.refreshTokenTtlSeconds,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtAccessSecret);
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.sub !== "string" ||
    decoded.typ !== "access"
  ) {
    throw new Error("Invalid access token");
  }
  return { sub: decoded.sub, typ: "access" };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.jwtRefreshSecret);
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.sub !== "string" ||
    decoded.typ !== "refresh"
  ) {
    throw new Error("Invalid refresh token");
  }
  return { sub: decoded.sub, typ: "refresh" };
}

export const REFRESH_COOKIE_NAME = "refreshToken";

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    path: "/",
    maxAge: env.refreshTokenTtlSeconds * 1000,
    sameSite: env.isProduction ? "none" : "lax",
    secure: env.isProduction,
    partitioned: env.isProduction,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...refreshCookieOptions(),
    maxAge: undefined,
  });
}
