import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { WorkforceComplianceRepository } from '@/modules/workforce-compliance/repositories/workforce-compliance.repository.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { shouldSendAlert, logAlert } from '@/modules/workforce-compliance/services/jobs/shared/job-alert-helpers.js';

export async function runRetirementCutoff(): Promise<number> {
  const asOf = new Date();
  const due = await WorkforceComplianceRepository.getRetirementsDue(asOf);
  let cut = 0;

  for (const row of due) {
    const referenceId = `${row.citizen_id}:${row.retire_date}`;
    if (!(await shouldSendAlert('RETIREMENT_CUTOFF', 'citizen', referenceId, asOf))) continue;

    await WorkforceComplianceRepository.setEligibilityExpiry(row.citizen_id, row.retire_date);
    await emitAuditEvent({
      eventType: AuditEventType.OTHER,
      entityType: 'eligibility',
      entityId: null,
      actorId: null,
      actorRole: null,
      actionDetail: {
        reason: 'RETIREMENT_CUTOFF',
        citizen_id: row.citizen_id,
        retire_date: row.retire_date,
      },
    });

    await NotificationService.notifyRoleByTemplate(
      'PTS_OFFICER',
      'WORKFORCE_RETIREMENT_CUTOFF_OFFICER',
      {
        retireDate: row.retire_date,
        citizenId: row.citizen_id,
      },
    );

    await logAlert({
      alertType: 'RETIREMENT_CUTOFF',
      referenceType: 'citizen',
      referenceId,
    });
    cut += 1;
  }

  return cut;
}
