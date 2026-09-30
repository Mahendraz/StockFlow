import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

// Types the value handed from this global setup to the test files (provide → inject).
declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

// Starts a throwaway single-node replica set (transactions need one), so tests
// never touch the development database and do not need Docker.
export default async function setup(project: TestProject) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  project.provide("mongoUri", replSet.getUri("stockflow-test"));
  // Teardown: runs once after all test files have finished.
  return async () => {
    await replSet.stop();
  };
}
