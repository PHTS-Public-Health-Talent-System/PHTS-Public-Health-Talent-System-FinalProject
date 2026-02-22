import crypto from "node:crypto";
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { AlertLogsRepository } from '@/modules/workforce-compliance/repositories/alert-logs.repository.js';
import { WorkforceComplianceRepository } from '@/modules/workforce-compliance/repositories/workforce-compliance.repository.js';
import { LicenseComplianceRepository } from '@/modules/workforce-compliance/repositories/license-compliance.repository.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { getSLAReport } from '@/modules/sla/services/sla.service.js';
import type { AlertType } from '@/modules/workforce-compliance/entities/workforce-compliance.entity.js';
import {
  ALERT_JOB_TIMEZONE,
  LEAVE_REPORT_POLICY,
  resolveLeavePolicy,
} from '@/modules/workforce-compliance/constants/workforce-compliance-policy.js';

const DATE_FMT = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ALERT_JOB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

const hashKey = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

async function shouldSendAlert(
  alertType: AlertType,
  referenceType: string,
  referenceId: string,
  date: Date = new Date(),
): Promise<boolean> {
  const dedupeKey = `${alertType}:${referenceType}:${referenceId}:${DATE_FMT(date)}`;
  const payloadHash = hashKey(dedupeKey);
  const exists = await AlertLogsRepository.hasPayloadHash(payloadHash);
  return !exists;
}

async function logAlert(
  alertType: AlertType,
  referenceType: string,
  referenceId: string,
  targetUserId?: number | null,
  errorMessage?: string | null,
): Promise<void> {
  const sentAt = new Date();
  const dedupeKey = `${alertType}:${referenceType}:${referenceId}:${DATE_FMT(sentAt)}`;
  const payloadHash = hashKey(dedupeKey);
  await AlertLogsRepository.insertLog({
    alert_type: alertType,
    target_user_id: targetUserId ?? null,
    reference_type: referenceType,
    reference_id: referenceId,
    payload_hash: payloadHash,
    status: errorMessage ? "FAILED" : "SENT",
    error_message: errorMessage ?? null,
    sent_at: sentAt,
  });
}

async function handleLicenseExpired(
  citizenId: string,
  expiryDate: string,
  asOf: Date,
): Promise<boolean> {
  const referenceId = `${citizenId}:${expiryDate}`;
  if (!(await shouldSendAlert("LICENSE_EXPIRED", "citizen", referenceId, asOf))) {
    return false;
  }
  await WorkforceComplianceRepository.setEligibilityExpiry(citizenId, expiryDate);
  await emitAuditEvent({
    eventType: AuditEventType.OTHER,
    entityType: "eligibility",
    entityId: null,
    actorId: null,
    actorRole: null,
    actionDetail: {
      reason: "LICENSE_EXPIRED",
      citizen_id: citizenId,
      expiry_date: expiryDate,
    },
  });
  const userId = await WorkforceComplianceRepository.findUserIdByCitizenId(citizenId);
  if (userId) {
    await NotificationService.notifyUserByTemplate(
      userId,
      "WORKFORCE_LICENSE_EXPIRED_USER",
      { expiryDate },
    );
  }
  await logAlert("LICENSE_EXPIRED", "citizen", referenceId, userId ?? null);
  return true;
}

async function handleLicenseRestored(
  citizenId: string,
  asOf: Date,
  retirementSet: Set<string>,
  movementOutSet: Set<string>,
): Promise<boolean> {
  if (!(await shouldSendAlert("LICENSE_RESTORED", "citizen", citizenId, asOf))) {
    return false;
  }
  if (retirementSet.has(citizenId) || movementOutSet.has(citizenId)) {
    return false;
  }
  const updated = await WorkforceComplianceRepository.restoreLatestEligibility(citizenId);
  if (updated <= 0) {
    return false;
  }

  await emitAuditEvent({
    eventType: AuditEventType.OTHER,
    entityType: "eligibility",
    entityId: null,
    actorId: null,
    actorRole: null,
    actionDetail: {
      reason: "LICENSE_RESTORED",
      citizen_id: citizenId,
    },
  });

  const userId = await WorkforceComplianceRepository.findUserIdByCitizenId(citizenId);
  if (userId) {
    await NotificationService.notifyUserByTemplate(
      userId,
      "WORKFORCE_LICENSE_RESTORED_USER",
      {},
    );
  }

  await logAlert("LICENSE_RESTORED", "citizen", citizenId, userId ?? null);
  return true;
}

export async function runLicenseAutoCutRestore(): Promise<{
  cut: number;
  restored: number;
}> {
  const asOf = new Date();
  const expiredList = await LicenseComplianceRepository.getListByBucket("expired", asOf);
  let cut = 0;
  let restored = 0;

  for (const row of expiredList) {
    const citizenId = row.citizen_id;
    const expiryDate = row.license_expiry ?? DATE_FMT(asOf);
    if (await handleLicenseExpired(citizenId, expiryDate, asOf)) {
      cut += 1;
    }
  }

  // Auto-restore (only if currently valid and no retirement/movement-out signals)
  const allExpiry = await LicenseComplianceRepository.getAllWithExpiry(asOf);
  const validSet = new Set(
    allExpiry
      .filter((r) => r.effective_expiry && (r.days_left ?? -1) >= 0)
      .map((r) => r.citizen_id),
  );

  const retirementsDue = await WorkforceComplianceRepository.getRetirementsDue(asOf);
  const retirementSet = new Set(retirementsDue.map((r) => r.citizen_id));
  const movementOuts = await WorkforceComplianceRepository.getMovementOutCandidates(asOf);
  const movementOutSet = new Set(movementOuts.map((m) => m.citizen_id));

  for (const citizenId of validSet) {
    if (
      await handleLicenseRestored(
        citizenId,
        asOf,
        retirementSet,
        movementOutSet,
      )
    ) {
      restored += 1;
    }
  }

  return { cut, restored };
}

export async function runRetirementCutoff(): Promise<number> {
  const asOf = new Date();
  const due = await WorkforceComplianceRepository.getRetirementsDue(asOf);
  let cut = 0;

  for (const row of due) {
    const referenceId = `${row.citizen_id}:${row.retire_date}`;
    if (!(await shouldSendAlert("RETIREMENT_CUTOFF", "citizen", referenceId, asOf))) continue;

    await WorkforceComplianceRepository.setEligibilityExpiry(row.citizen_id, row.retire_date);
    await emitAuditEvent({
      eventType: AuditEventType.OTHER,
      entityType: "eligibility",
      entityId: null,
      actorId: null,
      actorRole: null,
      actionDetail: {
        reason: "RETIREMENT_CUTOFF",
        citizen_id: row.citizen_id,
        retire_date: row.retire_date,
      },
    });

    await NotificationService.notifyRoleByTemplate(
      "PTS_OFFICER",
      "WORKFORCE_RETIREMENT_CUTOFF_OFFICER",
      {
        retireDate: row.retire_date,
        citizenId: row.citizen_id,
      },
    );

    await logAlert("RETIREMENT_CUTOFF", "citizen", referenceId, null);
    cut += 1;
  }

  return cut;
}

export async function runMovementOutCutoff(): Promise<number> {
  const asOf = new Date();
  const due = await WorkforceComplianceRepository.getMovementOutCandidates(asOf);
  let cut = 0;

  for (const row of due) {
    const dateStr = DATE_FMT(new Date(row.effective_date));
    const referenceId = `${row.citizen_id}:${dateStr}`;
    if (!(await shouldSendAlert("MOVEMENT_OUT", "citizen", referenceId, asOf))) continue;

    await WorkforceComplianceRepository.setEligibilityExpiry(row.citizen_id, dateStr);
    await emitAuditEvent({
      eventType: AuditEventType.OTHER,
      entityType: "eligibility",
      entityId: null,
      actorId: null,
      actorRole: null,
      actionDetail: {
        reason: "MOVEMENT_OUT",
        citizen_id: row.citizen_id,
        movement_type: row.movement_type,
        effective_date: dateStr,
      },
    });

    await NotificationService.notifyRoleByTemplate(
      "PTS_OFFICER",
      "WORKFORCE_MOVEMENT_OUT_CUTOFF_OFFICER",
      {
        effectiveDate: dateStr,
        citizenId: row.citizen_id,
      },
    );

    await logAlert("MOVEMENT_OUT", "citizen", referenceId, null);
    cut += 1;
  }

  return cut;
}

export async function runSLADigest(): Promise<{ sent: number }> {
  const report = await getSLAReport();
  let sent = 0;

  for (const step of report.byStep) {
    if (step.count === 0) continue;
    if (!(await shouldSendAlert("SLA_DIGEST", "role", step.role, new Date()))) continue;

    await NotificationService.notifyRoleByTemplate(
      step.role,
      "WORKFORCE_SLA_DIGEST_ROLE",
      {
        count: step.count,
        overdue: step.overdue,
      },
    );

    await logAlert("SLA_DIGEST", "role", step.role, null);
    sent += 1;
  }

  return { sent };
}

export async function runLeaveReportAlerts(): Promise<{ sent: number }> {
  const asOf = new Date();
  const stats = {
    candidates: 0,
    sent: 0,
    skippedDedup: 0,
    skippedNoUser: 0,
    failed: 0,
  };

  const ordain = await WorkforceComplianceRepository.getLeaveReportCandidates(
    ["ordain"],
    LEAVE_REPORT_POLICY.ordain.windowDays,
    asOf,
  );
  const military = await WorkforceComplianceRepository.getLeaveReportCandidates(
    ["military"],
    LEAVE_REPORT_POLICY.military.windowDays,
    asOf,
  );

  const candidates = [...ordain, ...military];
  stats.candidates = candidates.length;

  for (const row of candidates) {
    const policy = resolveLeavePolicy(row.leave_type);
    const maxDays = policy.overdueDays;
    const isOverdue = row.days_since_end > policy.overdueDays;
    const referenceId = String(row.leave_record_id);
    if (!(await shouldSendAlert("LEAVE_REPORT", "leave_record", referenceId, asOf))) {
      stats.skippedDedup += 1;
      continue;
    }

    const userId = await WorkforceComplianceRepository.findUserIdByCitizenId(row.citizen_id);
    if (!userId) {
      stats.skippedNoUser += 1;
      continue;
    }

    const templateKey = isOverdue
      ? "WORKFORCE_LEAVE_REPORT_OVERDUE_USER"
      : "WORKFORCE_LEAVE_REPORT_DUE_USER";

    try {
      await NotificationService.notifyUserByTemplate(
        userId,
        templateKey,
        {
          maxDays,
          daysSinceEnd: row.days_since_end,
        },
      );

      await logAlert("LEAVE_REPORT", "leave_record", referenceId, userId);
      stats.sent += 1;
    } catch (error) {
      stats.failed += 1;
      await logAlert(
        "LEAVE_REPORT",
        "leave_record",
        referenceId,
        userId,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  console.info(
    `[leave-report] tz=${ALERT_JOB_TIMEZONE} candidates=${stats.candidates} sent=${stats.sent} dedup=${stats.skippedDedup} no_user=${stats.skippedNoUser} failed=${stats.failed}`,
  );

  return { sent: stats.sent };
}
