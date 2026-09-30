// Runs in every test file before its tests: points the app at the in-memory database and empties it per test.

import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";

// App settings for the tests. Set before any test runs, so env() reads these values.
process.env.MONGODB_URI = inject("mongoUri");
process.env.TAX_RATE = "0.11";
process.env.BCRYPT_COST = "4"; // fast hashing in tests; production default is 12

// Connect once per test file.
beforeAll(async () => {
  const { connectDb } = await import("@/server/db");
  await connectDb();
});

// Every test starts from empty collections (deleteMany keeps the indexes).
beforeEach(async () => {
  const { resetLoginRateLimits } = await import("@/server/auth/rate-limit");
  resetLoginRateLimits();
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

// Close the connection when the file's tests are done.
afterAll(async () => {
  await mongoose.disconnect();
});
