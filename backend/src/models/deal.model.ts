import mongoose, {
  Schema,
  model,
  type HydratedDocument,
  type Model,
} from "mongoose";

export interface IDeal {
  deal_id: string;
  stage: string;
  amount: number;
  close_date: Date;
  health_score: number;
  health_reason: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DealDocument = HydratedDocument<IDeal>;

const dealSchema = new Schema<IDeal>(
  {
    deal_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    stage: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    close_date: {
      type: Date,
      required: true,
      index: true,
    },
    health_score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    health_reason: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "deals",
  },
);

dealSchema.index({ stage: 1, close_date: -1 });

export const Deal: Model<IDeal> =
  (mongoose.models.Deal as Model<IDeal> | undefined) ??
  model<IDeal>("Deal", dealSchema);
