import dotenv from "dotenv";
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mongoDatabaseName } from "../src/lib/mongoDatabase.js";
import { Puzzle } from "../src/models/Puzzle.js";
import { validatePuzzleSeed, type PuzzleSeed } from "../src/lib/puzzles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error("[seed] Missing MONGODB_URI");
  process.exit(1);
}

const raw = readFileSync(
  new URL("../src/data/puzzles.json", import.meta.url),
  "utf8",
);
const puzzles = JSON.parse(raw) as PuzzleSeed[];

if (!Array.isArray(puzzles) || puzzles.length < 50) {
  console.error("[seed] puzzles.json must contain at least 50 puzzles");
  process.exit(1);
}

const errors: string[] = [];
for (const [index, puzzle] of puzzles.entries()) {
  const problem = validatePuzzleSeed(puzzle);
  if (problem) errors.push(`${index + 1}: ${problem}`);
}
if (errors.length > 0) {
  console.error("[seed] Refusing to write. Invalid puzzles:");
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

const dbName = mongoDatabaseName(process.env.NODE_ENV);
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, dbName });
console.log(`[seed] MongoDB database ${mongoose.connection.name}`);

let upserts = 0;
for (const puzzle of puzzles) {
  await Puzzle.updateOne(
    { fen: puzzle.fen },
    {
      $set: {
        fen: puzzle.fen,
        solution: puzzle.solution,
        rating: puzzle.rating,
        theme: puzzle.theme,
      },
    },
    { upsert: true },
  );
  upserts += 1;
}

const removed = await Puzzle.deleteMany({
  fen: { $nin: puzzles.map((puzzle) => puzzle.fen) },
  source: { $ne: "lichess" },
});

console.log(`[seed] Upserted ${upserts} puzzles`);
console.log(`[seed] Removed ${removed.deletedCount} stale puzzles`);
await mongoose.disconnect();
