import { processSnapshotOutboxBatch } from "@/modules/snapshot/services/snapshot.service.js";

async function main(): Promise<void> {
  const result = await processSnapshotOutboxBatch(100);
  console.log("[snapshot-outbox]", result);
}

main().catch((error) => {
  console.error("Snapshot outbox processor failed:", error);
  process.exit(1);
});
