import type { PoolConnection } from "mysql2/promise";
import { AlertsRepository } from '@/modules/alerts/repositories/alerts.repository.js';

const toDateString = (value: Date | string) =>
  new Date(value).toISOString().slice(0, 10);

export async function applyImmediateMovementEligibilityCutoff(
  asOf: Date = new Date(),
  conn?: PoolConnection,
): Promise<{ candidates: number; cut: number }> {
  const due = await AlertsRepository.getMovementOutCandidates(asOf, conn);
  let cut = 0;

  for (const row of due) {
    const cutoffDate = toDateString(row.effective_date);
    const affected = await AlertsRepository.setEligibilityExpiry(
      row.citizen_id,
      cutoffDate,
      conn,
    );
    if (affected > 0) {
      cut += 1;
    }
  }

  return {
    candidates: due.length,
    cut,
  };
}
