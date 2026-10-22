import type { HealthResponse } from "@chessarena/shared";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { gamesRouter } from "./routes/games.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { puzzlesRouter } from "./routes/puzzles.js";
import { usersRouter } from "./routes/users.js";

export function createApp(): Express {
  const app = express();
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    const body: HealthResponse = {
      ok: true,
      mongo: mongoose.connection.readyState === 1 ? "up" : "down",
    };
    res.status(200).json(body);
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/games", gamesRouter);
  app.use("/api/leaderboard", leaderboardRouter);
  app.use("/api/puzzles", puzzlesRouter);

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[api] Unhandled route error: ${message}`);
      if (!res.headersSent) {
        res.status(500).json({
          error: { code: "INTERNAL", message: "Internal server error" },
        });
      }
    },
  );

  return app;
}
