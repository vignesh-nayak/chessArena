import { z } from "zod";

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  mongo: z.enum(["up", "down"]),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ApiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "ILLEGAL_MOVE",
  "OUT_OF_TURN",
  "INTERNAL",
]);

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const SignupBodySchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(24, "Username must be at most 24 characters")
    .regex(
      /^[A-Za-z0-9_]+$/,
      "Username may only contain letters, numbers, and underscores",
    ),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
});

export type SignupBody = z.infer<typeof SignupBodySchema>;

export const LoginBodySchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginBody = z.infer<typeof LoginBodySchema>;

export const UserSummarySchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email(),
});

export type UserSummary = z.infer<typeof UserSummarySchema>;

export const AuthSessionResponseSchema = z.object({
  user: UserSummarySchema,
  accessToken: z.string().min(1),
});

export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;

export const AccessTokenResponseSchema = z.object({
  accessToken: z.string().min(1),
});

export type AccessTokenResponse = z.infer<typeof AccessTokenResponseSchema>;

export const UserStatsSchema = z.object({
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  draws: z.number().int().nonnegative(),
});

export type UserStats = z.infer<typeof UserStatsSchema>;

export const MeResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email(),
  stats: UserStatsSchema,
  createdAt: z.string(),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;

export const AiDifficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export type AiDifficulty = z.infer<typeof AiDifficultySchema>;

export const CreateGameBodySchema = z.object({
  gameType: z.literal("ai"),
  aiDifficulty: AiDifficultySchema,
});

export type CreateGameBody = z.infer<typeof CreateGameBodySchema>;

export const MoveBodySchema = z.object({
  move: z
    .string()
    .regex(
      /^[a-h][1-8][a-h][1-8][qrbn]?$/,
      "Move must be UCI like e2e4 or e7e8q",
    ),
});

export type MoveBody = z.infer<typeof MoveBodySchema>;

export const GameStatusSchema = z.enum([
  "in_progress",
  "completed",
  "abandoned",
]);

export type GameStatus = z.infer<typeof GameStatusSchema>;

export const GameResultSchema = z.enum(["white", "black", "draw"]).nullable();

export type GameResult = z.infer<typeof GameResultSchema>;

export const GamePlayerSchema = z.object({
  id: z.string(),
  username: z.string(),
});

export type GamePlayer = z.infer<typeof GamePlayerSchema>;

export const LastMoveSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export type LastMove = z.infer<typeof LastMoveSchema>;

export const GameViewSchema = z.object({
  id: z.string(),
  fen: z.string(),
  moves: z.array(z.string()),
  status: GameStatusSchema,
  result: GameResultSchema,
  gameType: z.literal("ai"),
  aiDifficulty: AiDifficultySchema,
  turn: z.enum(["w", "b"]),
  lastMove: LastMoveSchema.nullable(),
  white: GamePlayerSchema,
  black: GamePlayerSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GameView = z.infer<typeof GameViewSchema>;

export const GameSummarySchema = z.object({
  id: z.string(),
  status: GameStatusSchema,
  result: GameResultSchema,
  gameType: z.literal("ai"),
  aiDifficulty: AiDifficultySchema,
  moveCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GameSummary = z.infer<typeof GameSummarySchema>;

export const GameHistoryResponseSchema = z.object({
  items: z.array(GameSummarySchema),
  total: z.number().int().nonnegative(),
});

export type GameHistoryResponse = z.infer<typeof GameHistoryResponseSchema>;

export {
  START_FEN,
  createGame,
  getFlags,
  getLegalMoves,
  getPieceColor,
  stateFromSans,
  tryMove,
  toUci,
  type CreateGameResult,
  type DrawReason,
  type GameFlags,
  type GameState,
  type LegalMoveTarget,
  type Side,
  type StateFromSansResult,
  type TryMoveResult,
} from "./chess.js";
