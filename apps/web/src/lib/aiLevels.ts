import type { AiDifficulty } from "@chessarena/shared";

export type AiLevelConfig = {
  skill: number;
  depth: number;
  movetime: number;
};

/** Final difficulty mapping — documented in DECISIONS.md (W1-F06). */
export const AI_LEVELS: Record<AiDifficulty, AiLevelConfig> = {
  1: { skill: 5, depth: 6, movetime: 400 },
  2: { skill: 10, depth: 12, movetime: 800 },
  3: { skill: 20, depth: 15, movetime: 1500 },
};

export function levelFor(difficulty: AiDifficulty): AiLevelConfig {
  return AI_LEVELS[difficulty];
}
