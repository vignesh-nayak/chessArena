import type { MeResponse, UserSummary } from "@chessarena/shared";
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const userStatsSchema = new Schema(
  {
    wins: { type: Number, default: 0, min: 0 },
    losses: { type: Number, default: 0, min: 0 },
    draws: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    stats: {
      type: userStatsSchema,
      default: () => ({ wins: 0, losses: 0, draws: 0 }),
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type UserModel = Model<UserDocument>;

export const User: UserModel =
  (mongoose.models.User as UserModel | undefined) ??
  mongoose.model<UserDocument>("User", userSchema);

export function toUserSummary(user: {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
}): UserSummary {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
  };
}

export function toMeResponse(user: {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  stats: { wins: number; losses: number; draws: number };
  createdAt: Date;
}): MeResponse {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    stats: {
      wins: user.stats.wins,
      losses: user.stats.losses,
      draws: user.stats.draws,
    },
    createdAt: user.createdAt.toISOString(),
  };
}
