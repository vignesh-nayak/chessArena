import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[api] Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

const PORT = Number(process.env.PORT ?? "4000");
if (!Number.isFinite(PORT) || PORT <= 0) {
  console.error("[api] PORT must be a positive number");
  process.exit(1);
}

const corsOrigins = requireEnv("CORS_ORIGIN")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (corsOrigins.length === 0) {
  console.error("[api] CORS_ORIGIN must include at least one origin");
  process.exit(1);
}

if (corsOrigins.some((origin) => origin === "*")) {
  console.error("[api] CORS_ORIGIN must not be *");
  process.exit(1);
}

export const env = {
  mongodbUri: requireEnv("MONGODB_URI"),
  corsOrigin: corsOrigins.join(","),
  corsOrigins,
  port: PORT,
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: requireEnv("JWT_REFRESH_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  accessTokenTtl: "15m",
  refreshTokenTtlSeconds: 60 * 60 * 24 * 7,
} as const;
