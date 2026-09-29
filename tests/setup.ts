import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";

process.env.MONGODB_URI = inject("mongoUri");
process.env.TAX_RATE = "0.11";
process.env.BCRYPT_COST = "4"; // fast hashing in tests; production default is 12

beforeAll(async () => {
  const { connectDb } = await import("@/server/db");
  await connectDb();
});

// Every test starts from empty collections (deleteMany keeps the indexes).
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});
