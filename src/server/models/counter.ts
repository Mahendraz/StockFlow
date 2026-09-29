import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// One document per (user, year); `seq` is the last invoice number handed out.
// Incremented with an atomic $inc, so two concurrent creates never get the same number.
const counterSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  year: { type: Number, required: true },
  seq: { type: Number, required: true, default: 0 },
});

counterSchema.index({ userId: 1, year: 1 }, { unique: true });

export type CounterFields = InferSchemaType<typeof counterSchema>;

export const Counter = (models.Counter as Model<CounterFields>) || model("Counter", counterSchema);
