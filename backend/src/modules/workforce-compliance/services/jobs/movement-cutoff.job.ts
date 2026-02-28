import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { WorkforceComplianceRepository } from '@/modules/workforce-compliance/repositories/workforce-compliance.repository.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { shouldSendAlert, logAlert } from '@/modules/workforce-compliance/services/jobs/shared/job-alert-helpers.js';
import { formatOpsDate } from '@/modules/workforce-compliance/services/jobs/shared/job-date.js';

export async function runMovementOutCutoff(): Promise<number> {
  const asOf = new Date();
  const due = await WorkforceComplianceRepository.getMovementOutCandidates(asOf);
  let cut = 0;

  for (const row of due) {
    const dateStr = formatOpsDate(row.effective_date);
    const referenceId = `${row.citizen_id}:${dateStr}`;
    if (!(await shouldSendAlert('MOVEMENT_OUT', 'citizen', referenceId, asOf))) continue;

    await WorkforceComplianceRepository.setEligibilityExpiry(row.citizen_id, dateStr);
    await emitAuditEvent({
      eventType: AuditEventType.OTHER,
      entityType: 'eligibility',
      entityId: null,
      actorId: null,
      actorRole: null,
      actionDetail: {
        reason: 'MOVEMENT_OUT',
        citizen_id: row.citizen_id,
        movement_type: row.movement_type,
        effective_date: dateStr,
      },
    });

    await NotificationService.notifyRoleByTemplate(
      'PTS_OFFICER',
      'WORKFORCE_MOVEMENT_OUT_CUTOFF_OFFICER',
      {
        effectiveDate: dateStr,
        citizenId: row.citizen_id,
      },
    );

    await logAlert({
      alertType: 'MOVEMENT_OUT',
      referenceType: 'citizen',
      referenceId,
    });
    cut += 1;
  }

  return cut;
}
