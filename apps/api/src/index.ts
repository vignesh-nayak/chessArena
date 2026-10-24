import { createServer } from "node:http";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { env } from "./env.js";
import { createGame } from "./lib/chessRules.js";
import { ensureTestAccount } from "./lib/ensureTestAccount.js";
import { startKeepAlive } from "./lib/keepAlive.js";
import "./models/Game.js";
import "./models/Puzzle.js";
import "./models/PuzzleAttempt.js";
import "./models/User.js";
import { armPersistedClocks } from "./socket/clocks.js";
import { initSocket } from "./socket/index.js";

async function connectMongo(uri: string): Promise<void> {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      dbName: env.mongodbDbName,
    });
    console.log(`[api] MongoDB connected to ${mongoose.connection.name}`);
    try {
      await mongoose.connection.syncIndexes();
      console.log("[api] MongoDB indexes synced");
    } catch (indexErr) {
      const indexMessage =
        indexErr instanceof Error ? indexErr.message : String(indexErr);
      console.error(`[api] MongoDB index sync failed: ${indexMessage}`);
    }
    await armPersistedClocks();
    await ensureTestAccount();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[api] MongoDB connection failed (retrying in 5s): ${message}`,
    );
    setTimeout(() => void connectMongo(uri), 5000);
  }
}

async function main(): Promise<void> {
  const startPosition = createGame();
  if (!startPosition.ok) {
    console.error("[api] Chess rules engine failed to load start position");
    process.exit(1);
  }

  await connectMongo(env.mongodbUri);

  const app = createApp();
  if (env.isProduction) {
    app.set("trust proxy", 1);
  }

  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(env.port, "0.0.0.0", () => {
    console.log(`[api] Listening on http://0.0.0.0:${env.port}`);
    console.log(`[api] CORS origins: ${env.corsOrigin}`);
    if (env.isProduction) {
      startKeepAlive({ origin: process.env.RENDER_EXTERNAL_URL });
    }
  });
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[api] Fatal startup error: ${message}`);
  process.exit(1);
});
