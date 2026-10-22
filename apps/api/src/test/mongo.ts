import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { authRateLimit } from "../middleware/authRateLimit.js";

export async function startMemoryMongo(): Promise<MongoMemoryServer> {
  const server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  return server;
}

export async function stopMemoryMongo(server: MongoMemoryServer): Promise<void> {
  await mongoose.disconnect();
  await server.stop();
}

/** Clears the shared login/signup budget so one file cannot starve the next. */
export function resetAuthRateLimit(): void {
  authRateLimit.resetKey("127.0.0.1");
  authRateLimit.resetKey("::ffff:127.0.0.1");
}
