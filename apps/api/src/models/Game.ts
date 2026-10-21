import mongoose, {
  Schema,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose";

const timeControlSchema = new Schema(
  {
    initial: { type: Number, required: true },
    increment: { type: Number, required: true },
  },
  { _id: false },
);

const gameSchema = new Schema(
  {
    whitePlayer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blackPlayer: {
      type: Schema.Types.Mixed,
      required: true,
      default: "AI",
    },
    moves: {
      type: [String],
      default: [],
    },
    fen: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["in_progress", "completed", "abandoned"],
      default: "in_progress",
      required: true,
    },
    result: {
      type: String,
      enum: ["white", "black", "draw"],
      default: null,
    },
    gameType: {
      type: String,
      enum: ["ai", "pvp"],
      required: true,
    },
    aiDifficulty: {
      type: Number,
      enum: [1, 2, 3],
      default: null,
    },
    socketRoomId: {
      type: String,
      default: null,
    },
    drawOfferedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    timeControl: {
      type: timeControlSchema,
      required: false,
    },
    whiteTimeRemaining: {
      type: Number,
      required: false,
    },
    blackTimeRemaining: {
      type: Number,
      required: false,
    },
  },
  { timestamps: true },
);

gameSchema.index({ whitePlayer: 1, createdAt: -1 });

export type GameDocument = HydratedDocument<
  InferSchemaType<typeof gameSchema> & {
    createdAt: Date;
    updatedAt: Date;
  }
>;

export type GameModel = Model<InferSchemaType<typeof gameSchema>>;

export const Game: GameModel =
  (mongoose.models.Game as GameModel | undefined) ??
  mongoose.model("Game", gameSchema);
