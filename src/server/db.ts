// MongoDB connection (opened once per server process) and the transaction helper.

import mongoose, { type ClientSession } from "mongoose";
import { env } from "./env";
import { Counter } from "./models/counter";
import { Invoice } from "./models/invoice";
import { Product } from "./models/product";
import { Session } from "./models/session";
import { User } from "./models/user";

// Cached on globalThis so Next.js hot reload reuses one connection instead of opening a new one per edit.
const globalForDb = globalThis as unknown as { stockflowDb?: Promise<typeof mongoose> };

/** Opens the MongoDB connection on first use and reuses it after that. API handlers call it first (see http.ts). */
export function connectDb(): Promise<typeof mongoose> {
  if (!globalForDb.stockflowDb) {
    globalForDb.stockflowDb = mongoose
      .connect(env().MONGODB_URI)
      .then(async (conn) => {
        // Create collections and indexes up front: collections cannot be created
        // implicitly inside some transactions, and unique indexes must exist before the first write.
        await Promise.all([User, Session, Product, Invoice, Counter].map((m) => m.init()));
        return conn;
      })
      .catch((err) => {
        globalForDb.stockflowDb = undefined; // allow a retry on the next request
        throw err;
      });
  }
  return globalForDb.stockflowDb;
}

/**
 * Runs `fn` in a MongoDB transaction. Either every write inside commits or none does.
 * The driver retries `fn` automatically on transient errors such as write conflicts
 * with a concurrent transaction, so `fn` must be safe to re-run.
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
