import type { ApiErrorCode } from "@chessarena/shared";
import type { NextFunction, Request, RequestHandler, Response } from "express";

export function sendError(
  res: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
): void {
  res.status(status).json({
    error: { code, message },
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
