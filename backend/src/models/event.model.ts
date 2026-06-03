import mongoose, {
  Schema,
  model,
  type HydratedDocument,
  type Model,
} from "mongoose";

export interface IEvent {
  event_id: string;
  deal_id: string;
  type: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type EventDocument = HydratedDocument<IEvent>;

const eventSchema = new Schema<IEvent>(
  {
    event_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    deal_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    occurred_at: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "events",
  },
);

eventSchema.index({ deal_id: 1, occurred_at: -1 });
eventSchema.index({ type: 1, occurred_at: -1 });

export const Event: Model<IEvent> =
  (mongoose.models.Event as Model<IEvent> | undefined) ??
  model<IEvent>("Event", eventSchema);
