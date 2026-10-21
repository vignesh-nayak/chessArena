import { z } from "zod";

export const SocketHandshakeAuthSchema = z.object({
  token: z.string().min(1),
});

export type SocketHandshakeAuth = z.infer<typeof SocketHandshakeAuthSchema>;

export const SocketErrorPayloadSchema = z.object({
  message: z.string().min(1),
});

export type SocketErrorPayload = z.infer<typeof SocketErrorPayloadSchema>;

export const LobbyOnlineUserSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
});

export type LobbyOnlineUser = z.infer<typeof LobbyOnlineUserSchema>;

export const LobbyOnlineUsersSchema = z.array(LobbyOnlineUserSchema);

export type LobbyOnlineUsers = z.infer<typeof LobbyOnlineUsersSchema>;

export const ChallengeSendSchema = z.object({
  toUserId: z.string().min(1),
});

export type ChallengeSend = z.infer<typeof ChallengeSendSchema>;

export const ChallengeActionSchema = z.object({
  challengeId: z.string().min(1),
});

export type ChallengeAction = z.infer<typeof ChallengeActionSchema>;

export const ChallengeReceivedSchema = z.object({
  fromUserId: z.string().min(1),
  fromUsername: z.string().min(1),
  challengeId: z.string().min(1),
});

export type ChallengeReceived = z.infer<typeof ChallengeReceivedSchema>;

export const ChallengeDeclinedSchema = z.object({
  challengeId: z.string().min(1),
});

export type ChallengeDeclined = z.infer<typeof ChallengeDeclinedSchema>;

export const GameStartedOpponentSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
});

export const GameStartedSchema = z.object({
  gameId: z.string().min(1),
  color: z.enum(["white", "black"]),
  opponent: GameStartedOpponentSchema,
});

export type GameStarted = z.infer<typeof GameStartedSchema>;

const uciMove = z
  .string()
  .regex(
    /^[a-h][1-8][a-h][1-8][qrbn]?$/,
    "Move must be UCI like e2e4 or e7e8q",
  );

export const GameJoinSchema = z.object({
  gameId: z.string().min(1),
});

export type GameJoin = z.infer<typeof GameJoinSchema>;

export const GameMoveSchema = z.object({
  gameId: z.string().min(1),
  move: uciMove,
});

export type GameMove = z.infer<typeof GameMoveSchema>;

export const GameResignSchema = z.object({
  gameId: z.string().min(1),
});

export type GameResign = z.infer<typeof GameResignSchema>;

export const GameOfferDrawSchema = z.object({
  gameId: z.string().min(1),
});

export type GameOfferDraw = z.infer<typeof GameOfferDrawSchema>;

export const GameRespondDrawSchema = z.object({
  gameId: z.string().min(1),
  accept: z.boolean(),
});

export type GameRespondDraw = z.infer<typeof GameRespondDrawSchema>;

export const GameLastMoveSchema = z.object({
  from: z.string().regex(/^[a-h][1-8]$/),
  to: z.string().regex(/^[a-h][1-8]$/),
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
});

export type GameLastMove = z.infer<typeof GameLastMoveSchema>;

export const GameEndReasonSchema = z.enum([
  "checkmate",
  "stalemate",
  "insufficient_material",
  "threefold_repetition",
  "fifty_move",
  "resign",
  "agreement",
  "draw",
]);

export type GameEndReason = z.infer<typeof GameEndReasonSchema>;

export const GameStateUpdateSchema = z.object({
  gameId: z.string().min(1),
  fen: z.string().min(1),
  lastMove: GameLastMoveSchema.nullable(),
  turn: z.enum(["w", "b"]),
  moves: z.array(z.string()),
  status: z.enum(["in_progress", "completed", "abandoned"]),
  result: z.enum(["white", "black", "draw"]).nullable(),
  drawOfferedBy: z.string().min(1).nullable(),
});

export type GameStateUpdate = z.infer<typeof GameStateUpdateSchema>;

export const GameEndedSchema = z.object({
  gameId: z.string().min(1),
  result: z.enum(["white", "black", "draw"]),
  reason: GameEndReasonSchema,
});

export type GameEnded = z.infer<typeof GameEndedSchema>;

export const ChatMessageSchema = z.object({
  gameId: z.string().min(1),
  text: z.string().trim().min(1).max(200),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatNewMessageSchema = z.object({
  gameId: z.string().min(1),
  from: z.string().min(1),
  text: z.string().min(1).max(200),
  sentAt: z.string().datetime(),
});

export type ChatNewMessage = z.infer<typeof ChatNewMessageSchema>;

export interface ClientToServerEvents {
  "lobby:join": () => void;
  "lobby:leave": () => void;
  "challenge:send": (payload: ChallengeSend) => void;
  "challenge:accept": (payload: ChallengeAction) => void;
  "challenge:decline": (payload: ChallengeAction) => void;
  "game:join": (payload: GameJoin) => void;
  "game:move": (payload: GameMove) => void;
  "game:resign": (payload: GameResign) => void;
  "game:offerDraw": (payload: GameOfferDraw) => void;
  "game:respondDraw": (payload: GameRespondDraw) => void;
  "chat:message": (payload: ChatMessage) => void;
}

export interface ServerToClientEvents {
  error: (payload: SocketErrorPayload) => void;
  "lobby:onlineUsers": (users: LobbyOnlineUser[]) => void;
  "challenge:received": (payload: ChallengeReceived) => void;
  "challenge:declined": (payload: ChallengeDeclined) => void;
  "game:started": (payload: GameStarted) => void;
  "game:stateUpdate": (payload: GameStateUpdate) => void;
  "game:ended": (payload: GameEnded) => void;
  "chat:newMessage": (payload: ChatNewMessage) => void;
}
