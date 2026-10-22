import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const puzzleSchema = new Schema(
  {
    fen: {
      type: String,
      required: true,
      unique: true,
    },
    solution: {
      type: [String],
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 0,
    },
    theme: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ["lichess"],
      required: false,
    },
    sourceId: {
      type: String,
      required: false,
    },
    dateKey: {
      type: String,
      required: false,
    },
  },
  { timestamps: false },
);

puzzleSchema.index({ rating: 1 });
puzzleSchema.index({ sourceId: 1 }, { unique: true, sparse: true });
puzzleSchema.index({ dateKey: 1 }, { unique: true, sparse: true });

export type PuzzleDocument = InferSchemaType<typeof puzzleSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type PuzzleModel = Model<PuzzleDocument>;

export const Puzzle: PuzzleModel =
  (mongoose.models.Puzzle as PuzzleModel | undefined) ??
  mongoose.model<PuzzleDocument>("Puzzle", puzzleSchema);
