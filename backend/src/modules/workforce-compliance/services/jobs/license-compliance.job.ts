import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { LicenseComplianceRepository } from '@/modules/workforce-compliance/repositories/license-compliance.repository.js';
import { WorkforceComplianceRepository } from '@/modules/workforce-compliance/repositories/workforce-compliance.repository.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { shouldSendAlert, logAlert } from '@/modules/workforce-compliance/services/jobs/shared/job-alert-helpers.js';
import { formatOpsDate } from '@/modules/workforce-compliance/services/jobs/shared/job-date.js';

async function handleLicenseExpired(
  citizenId: string,
  expiryDate: string,
  asOf: Date,
): Promise<boolean> {
  const referenceId = `${citizenId}:${expiryDate}`;
  if (!(await shouldSendAlert('LICENSE_EXPIRED', 'citizen', referenceId, asOf))) {
    return false;
  }
  await WorkforceComplianceRepository.setEligibilityExpiry(citizenId, expiryDate);
  await emitAuditEvent({
    eventType: AuditEventType.OTHER,
    entityType: 'eligibility',
    entityId: null,
    actorId: null,
    actorRole: null,
    actionDetail: {
      reason: 'LICENSE_EXPIRED',
      citizen_id: citizenId,
      expiry_date: expiryDate,
    },
  });
  const userId = await WorkforceComplianceRepository.findUserIdByCitizenId(citizenId);
  if (userId) {
    await NotificationService.notifyUserByTemplate(userId, 'WORKFORCE_LICENSE_EXPIRED_USER', {
      expiryDate,
    });
  }
  await logAlert({
    alertType: 'LICENSE_EXPIRED',
    referenceType: 'citizen',
    referenceId,
    targetUserId: userId ?? null,
  });
  return true;
}

async function handleLicenseRestored(
  citizenId: string,
  asOf: Date,
  retirementSet: Set<string>,
  movementOutSet: Set<string>,
): Promise<boolean> {
  if (!(await shouldSendAlert('LICENSE_RESTORED', 'citizen', citizenId, asOf))) {
    return false;
  }
  if (retirementSet.has(citizenId) || movementOutSet.has(citizenId)) {
    return false;
  }
  const updated = await WorkforceComplianceRepository.restoreLatestEligibility(citizenId);
  if (updated <= 0) return false;

  await emitAuditEvent({
    eventType: AuditEventType.OTHER,
    entityType: 'eligibility',
    entityId: null,
    actorId: null,
    actorRole: null,
    actionDetail: {
      reason: 'LICENSE_RESTORED',
      citizen_id: citizenId,
    },
  });

  const userId = await WorkforceComplianceRepository.findUserIdByCitizenId(citizenId);
  if (userId) {
    await NotificationService.notifyUserByTemplate(userId, 'WORKFORCE_LICENSE_RESTORED_USER', {});
  }

  await logAlert({
    alertType: 'LICENSE_RESTORED',
    referenceType: 'citizen',
    referenceId: citizenId,
    targetUserId: userId ?? null,
  });
  return true;
}

export async function runLicenseAutoCutRestore(): Promise<{ cut: number; restored: number }> {
  const asOf = new Date();
  const expiredList = await LicenseComplianceRepository.getListByBucket('expired', asOf);
  let cut = 0;
  let restored = 0;

  for (const row of expiredList) {
    const citizenId = row.citizen_id;
    const expiryDate = row.license_expiry ?? formatOpsDate(asOf);
    if (await handleLicenseExpired(citizenId, expiryDate, asOf)) {
      cut += 1;
    }
  }

  const allExpiry = await LicenseComplianceRepository.getAllWithExpiry(asOf);
  const validSet = new Set(
    allExpiry
      .filter((row) => row.effective_expiry && (row.days_left ?? -1) >= 0)
      .map((row) => row.citizen_id),
  );

  const retirementsDue = await WorkforceComplianceRepository.getRetirementsDue(asOf);
  const retirementSet = new Set(retirementsDue.map((row) => row.citizen_id));
  const movementOuts = await WorkforceComplianceRepository.getMovementOutCandidates(asOf);
  const movementOutSet = new Set(movementOuts.map((row) => row.citizen_id));

  for (const citizenId of validSet) {
    if (await handleLicenseRestored(citizenId, asOf, retirementSet, movementOutSet)) {
      restored += 1;
    }
  }

  return { cut, restored };
}
