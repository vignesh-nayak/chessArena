import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { resetUserRateLimit } from "../middleware/userRateLimit.js";

export async function startMemoryMongo(): Promise<MongoMemoryServer> {
  const server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  return server;
}

export async function stopMemoryMongo(server: MongoMemoryServer): Promise<void> {
  await mongoose.disconnect();
  await server.stop();
}

/** Clears the per-user rate limit so one test cannot block the next. */
export function resetAuthRateLimit(): void {
  resetUserRateLimit();
}
