import type { PoolConnection } from "mysql2/promise";
import { WorkforceComplianceRepository } from '@/modules/workforce-compliance/repositories/workforce-compliance.repository.js';
import { formatOpsDate } from '@/modules/workforce-compliance/services/jobs/shared/job-date.js';

export async function applyImmediateMovementEligibilityCutoff(
  asOf: Date = new Date(),
  conn?: PoolConnection,
): Promise<{ candidates: number; cut: number }> {
  const due = await WorkforceComplianceRepository.getMovementOutCandidates(asOf, conn);
  let cut = 0;

  for (const row of due) {
    const cutoffDate = formatOpsDate(row.effective_date);
    const affected = await WorkforceComplianceRepository.setEligibilityExpiry(
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
