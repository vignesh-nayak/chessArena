import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const puzzleAttemptSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    puzzleId: {
      type: Schema.Types.ObjectId,
      ref: "Puzzle",
      required: true,
    },
    solvedAt: {
      type: Date,
      required: true,
    },
    puzzleRating: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: false },
);

puzzleAttemptSchema.index({ userId: 1, puzzleId: 1 }, { unique: true });

export type PuzzleAttemptDocument = InferSchemaType<typeof puzzleAttemptSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type PuzzleAttemptModel = Model<PuzzleAttemptDocument>;

export const PuzzleAttempt: PuzzleAttemptModel =
  (mongoose.models.PuzzleAttempt as PuzzleAttemptModel | undefined) ??
  mongoose.model<PuzzleAttemptDocument>("PuzzleAttempt", puzzleAttemptSchema);
