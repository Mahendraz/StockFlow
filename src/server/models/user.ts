import { Schema, model, models, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // bcrypt hash; the salt is embedded in the hash string (per-user salt).
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

export type UserFields = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserFields>;

// `models.User ||` keeps Next.js hot reload from re-registering the model.
export const User = (models.User as Model<UserFields>) || model("User", userSchema);
