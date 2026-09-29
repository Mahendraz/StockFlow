import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const sessionSchema = new Schema({
  // SHA-256 of the cookie token. The raw token only ever lives in the browser cookie,
  // so a leaked database dump cannot be replayed as a login.
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  expiresAt: { type: Date, required: true },
});

// TTL index: MongoDB deletes expired sessions in the background (roughly once a minute).
// Lookups still check `expiresAt` explicitly because that cleanup is not instant.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionFields = InferSchemaType<typeof sessionSchema>;

export const Session = (models.Session as Model<SessionFields>) || model("Session", sessionSchema);
