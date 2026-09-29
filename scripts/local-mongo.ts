/**
 * Docker-free alternative to `docker compose up`: runs a single-node MongoDB replica set
 * (named rs0, on port 27017) using the same mongod binary the tests download.
 * Data persists in .data/mongo between runs. Stop it with Ctrl+C.
 */
import { mkdirSync } from "node:fs";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const dbPath = ".data/mongo";
mkdirSync(dbPath, { recursive: true });

async function main() {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { name: "rs0", count: 1, storageEngine: "wiredTiger" },
    instanceOpts: [{ port: 27017, dbPath }],
  });

  console.log(`MongoDB replica set running: ${replSet.getUri("stockflow")}`);
  console.log("Press Ctrl+C to stop.");

  const shutdown = async () => {
    await replSet.stop({ doCleanup: false }); // keep the data directory
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
