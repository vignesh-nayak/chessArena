import type { HealthResponse } from "@chessarena/shared";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { env } from "./env.js";
import { createGame } from "./lib/chessRules.js";
import { authRouter } from "./routes/auth.js";
import { gamesRouter } from "./routes/games.js";
import { usersRouter } from "./routes/users.js";

async function connectMongo(uri: string): Promise<void> {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("[api] MongoDB connected");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[api] MongoDB connection failed (retrying in 5s): ${message}`,
    );
    setTimeout(() => void connectMongo(uri), 5000);
  }
}

function mongoStatus(): HealthResponse["mongo"] {
  return mongoose.connection.readyState === 1 ? "up" : "down";
}

async function main(): Promise<void> {
  const startPosition = createGame();
  if (!startPosition.ok) {
    console.error("[api] Chess rules engine failed to load start position");
    process.exit(1);
  }

  await connectMongo(env.mongodbUri);

  const app = express();
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
      mongo: mongoStatus(),
    };
    res.status(200).json(body);
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/games", gamesRouter);

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

  app.listen(env.port, "0.0.0.0", () => {
    console.log(`[api] Listening on http://0.0.0.0:${env.port}`);
    console.log(`[api] CORS origins: ${env.corsOrigin}`);
  });
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[api] Fatal startup error: ${message}`);
  process.exit(1);
});
