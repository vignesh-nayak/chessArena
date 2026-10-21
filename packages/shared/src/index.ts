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
  rating: z.number().int(),
  createdAt: z.string(),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;

export const LeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;

export const LeaderboardItemSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  rating: z.number().int(),
  stats: UserStatsSchema,
});

export type LeaderboardItem = z.infer<typeof LeaderboardItemSchema>;

export const LeaderboardResponseSchema = z.object({
  items: z.array(LeaderboardItemSchema),
});

export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

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
  rating: z.number().int().nullable(),
});

export type GamePlayer = z.infer<typeof GamePlayerSchema>;

export const LastMoveSchema = z.object({
  from: z.string(),
  to: z.string(),
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
});

export type LastMove = z.infer<typeof LastMoveSchema>;

const gameViewFields = {
  id: z.string(),
  fen: z.string(),
  moves: z.array(z.string()),
  status: GameStatusSchema,
  result: GameResultSchema,
  turn: z.enum(["w", "b"]),
  lastMove: LastMoveSchema.nullable(),
  white: GamePlayerSchema,
  black: GamePlayerSchema,
  whiteTime: z.number().int().nullable(),
  blackTime: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

export const GameViewSchema = z.discriminatedUnion("gameType", [
  z.object({
    ...gameViewFields,
    gameType: z.literal("ai"),
    aiDifficulty: AiDifficultySchema,
  }),
  z.object({
    ...gameViewFields,
    gameType: z.literal("pvp"),
    aiDifficulty: z.null(),
  }),
]);

export type GameView = z.infer<typeof GameViewSchema>;

const gameSummaryFields = {
  id: z.string(),
  status: GameStatusSchema,
  result: GameResultSchema,
  moveCount: z.number().int().nonnegative(),
  white: GamePlayerSchema,
  black: GamePlayerSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
};

export const GameSummarySchema = z.discriminatedUnion("gameType", [
  z.object({
    ...gameSummaryFields,
    gameType: z.literal("ai"),
    aiDifficulty: AiDifficultySchema,
  }),
  z.object({
    ...gameSummaryFields,
    gameType: z.literal("pvp"),
    aiDifficulty: z.null(),
  }),
]);

export type GameSummary = z.infer<typeof GameSummarySchema>;

export const GameHistoryResponseSchema = z.object({
  items: z.array(GameSummarySchema),
  total: z.number().int().nonnegative(),
});

export type GameHistoryResponse = z.infer<typeof GameHistoryResponseSchema>;

export const GameReplaySchema = z.object({
  id: z.string(),
  whitePlayer: GamePlayerSchema,
  blackPlayer: GamePlayerSchema,
  moves: z.array(z.string()),
  result: GameResultSchema,
  status: GameStatusSchema,
  gameType: z.enum(["ai", "pvp"]),
  aiDifficulty: AiDifficultySchema.nullable(),
  createdAt: z.string(),
});

export type GameReplay = z.infer<typeof GameReplaySchema>;

export const LiveGameSchema = z.object({
  id: z.string(),
  white: GamePlayerSchema,
  black: GamePlayerSchema,
  moveCount: z.number().int().nonnegative(),
});

export type LiveGame = z.infer<typeof LiveGameSchema>;

export const LiveGamesResponseSchema = z.object({
  items: z.array(LiveGameSchema),
});

export type LiveGamesResponse = z.infer<typeof LiveGamesResponseSchema>;

export {
  ChallengeActionSchema,
  ChallengeDeclinedSchema,
  ChallengeReceivedSchema,
  ChallengeSendSchema,
  ChatMessageSchema,
  ChatNewMessageSchema,
  GameClockUpdateSchema,
  GameEndReasonSchema,
  GameEndedSchema,
  GameTimeoutSchema,
  GameJoinSchema,
  GameLastMoveSchema,
  GameMoveSchema,
  MatchmakingJoinSchema,
  MatchmakingMatchedSchema,
  GameOfferDrawSchema,
  GameResignSchema,
  GameRespondDrawSchema,
  GameStartedSchema,
  GameStateUpdateSchema,
  SpectateStateUpdateSchema,
  LobbyOnlineUserSchema,
  LobbyOnlineUsersSchema,
  TimeControlSchema,
  SocketErrorPayloadSchema,
  SocketHandshakeAuthSchema,
  type ChallengeAction,
  type ChallengeDeclined,
  type ChallengeReceived,
  type ChallengeSend,
  type ChatMessage,
  type ChatNewMessage,
  type ClientToServerEvents,
  type GameClockUpdate,
  type GameEndReason,
  type GameEnded,
  type GameTimeout,
  type GameJoin,
  type GameLastMove,
  type GameMove,
  type MatchmakingJoin,
  type MatchmakingMatched,
  type GameOfferDraw,
  type GameResign,
  type GameRespondDraw,
  type GameStarted,
  type GameStateUpdate,
  type SpectateStateUpdate,
  type LobbyOnlineUser,
  type LobbyOnlineUsers,
  type ServerToClientEvents,
  type SocketErrorPayload,
  type SocketHandshakeAuth,
  type TimeControl,
} from "./realtime.js";

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
