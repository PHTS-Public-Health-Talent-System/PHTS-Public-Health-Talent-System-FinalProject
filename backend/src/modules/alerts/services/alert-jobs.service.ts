import crypto from "node:crypto";
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { NotificationType } from '@/modules/notification/entities/notification.entity.js';
import { AlertLogsRepository } from '@/modules/alerts/repositories/alert-logs.repository.js';
import { AlertsRepository } from '@/modules/alerts/repositories/alerts.repository.js';
import { LicenseAlertsRepository } from '@/modules/alerts/repositories/license-alerts.repository.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { getSLAReport } from '@/modules/sla/services/sla.service.js';
import type { AlertType } from '@/modules/alerts/entities/alerts.entity.js';
import {
  ALERT_JOB_TIMEZONE,
  LEAVE_REPORT_POLICY,
  resolveLeavePolicy,
} from '@/modules/alerts/constants/alert-policy.js';

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

export async function runLicenseAutoCutRestore(): Promise<{
  cut: number;
  restored: number;
}> {
  const asOf = new Date();
  const expiredList = await LicenseAlertsRepository.getListByBucket("expired", asOf);
  let cut = 0;
  let restored = 0;

  for (const row of expiredList) {
    const citizenId = row.citizen_id;
    const expiryDate = row.license_expiry ?? DATE_FMT(asOf);
    const referenceId = `${citizenId}:${expiryDate}`;
    if (!(await shouldSendAlert("LICENSE_EXPIRED", "citizen", referenceId, asOf))) {
      continue;
    }

    await AlertsRepository.setEligibilityExpiry(citizenId, expiryDate);
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

    const userId = await AlertsRepository.findUserIdByCitizenId(citizenId);
    if (userId) {
      await NotificationService.notifyUser(
        userId,
        "ใบอนุญาตหมดอายุ",
        `ใบอนุญาตของท่านหมดอายุแล้ว (วันหมดอายุ: ${expiryDate})`,
        "/dashboard/user/requests",
        "LICENSE",
      );
    }

    await logAlert("LICENSE_EXPIRED", "citizen", referenceId, userId ?? null);
    cut += 1;
  }

  // Auto-restore (only if currently valid and no retirement/movement-out signals)
  const allExpiry = await LicenseAlertsRepository.getAllWithExpiry(asOf);
  const validSet = new Set(
    allExpiry
      .filter((r) => r.effective_expiry && (r.days_left ?? -1) >= 0)
      .map((r) => r.citizen_id),
  );

  const retirementsDue = await AlertsRepository.getRetirementsDue(asOf);
  const retirementSet = new Set(retirementsDue.map((r) => r.citizen_id));
  const movementOuts = await AlertsRepository.getMovementOutCandidates(asOf);
  const movementOutSet = new Set(movementOuts.map((m) => m.citizen_id));

  for (const citizenId of validSet) {
    if (!(await shouldSendAlert("LICENSE_RESTORED", "citizen", citizenId, asOf))) {
      continue;
    }

    // Skip restore if retirement/movement-out exists
    if (retirementSet.has(citizenId)) continue;
    if (movementOutSet.has(citizenId)) continue;

    const updated = await AlertsRepository.restoreLatestEligibility(citizenId);
    if (updated > 0) {
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

      const userId = await AlertsRepository.findUserIdByCitizenId(citizenId);
      if (userId) {
        await NotificationService.notifyUser(
          userId,
          "ใบอนุญาตต่ออายุแล้ว",
          "ระบบเปิดสิทธิรับเงินเพิ่มให้ท่านอีกครั้งหลังต่ออายุใบอนุญาต",
          "/dashboard/user/requests",
          "LICENSE",
        );
      }

      await logAlert("LICENSE_RESTORED", "citizen", citizenId, userId ?? null);
      restored += 1;
    }
  }

  return { cut, restored };
}

export async function runRetirementCutoff(): Promise<number> {
  const asOf = new Date();
  const due = await AlertsRepository.getRetirementsDue(asOf);
  let cut = 0;

  for (const row of due) {
    const referenceId = `${row.citizen_id}:${row.retire_date}`;
    if (!(await shouldSendAlert("RETIREMENT_CUTOFF", "citizen", referenceId, asOf))) continue;

    await AlertsRepository.setEligibilityExpiry(row.citizen_id, row.retire_date);
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

    await NotificationService.notifyRole(
      "PTS_OFFICER",
      "ตัดสิทธิเนื่องจากเกษียณ",
      `ตัดสิทธิเงินเพิ่ม พ.ต.ส. (เกษียณ) ตั้งแต่ ${row.retire_date} สำหรับ ${row.citizen_id}`,
      "/dashboard/officer",
      NotificationType.REMINDER,
    );

    await logAlert("RETIREMENT_CUTOFF", "citizen", referenceId, null);
    cut += 1;
  }

  return cut;
}

export async function runMovementOutCutoff(): Promise<number> {
  const asOf = new Date();
  const due = await AlertsRepository.getMovementOutCandidates(asOf);
  let cut = 0;

  for (const row of due) {
    const dateStr = DATE_FMT(new Date(row.effective_date));
    const referenceId = `${row.citizen_id}:${dateStr}`;
    if (!(await shouldSendAlert("MOVEMENT_OUT", "citizen", referenceId, asOf))) continue;

    await AlertsRepository.setEligibilityExpiry(row.citizen_id, dateStr);
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

    await NotificationService.notifyRole(
      "PTS_OFFICER",
      "ตัดสิทธิเนื่องจากย้ายออก",
      `ตัดสิทธิเงินเพิ่ม พ.ต.ส. (ย้ายออก) ตั้งแต่ ${dateStr} สำหรับ ${row.citizen_id}`,
      "/dashboard/officer",
      NotificationType.REMINDER,
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

    await NotificationService.notifyRole(
      step.role,
      "สรุปคำขอค้าง (SLA)",
      `มีคำขอค้างทั้งหมด ${step.count} รายการ (เกินกำหนด ${step.overdue})`,
      "/dashboard",
      NotificationType.REMINDER,
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

  const ordain = await AlertsRepository.getLeaveReportCandidates(
    ["ordain"],
    LEAVE_REPORT_POLICY.ordain.windowDays,
    asOf,
  );
  const military = await AlertsRepository.getLeaveReportCandidates(
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

    const userId = await AlertsRepository.findUserIdByCitizenId(row.citizen_id);
    if (!userId) {
      stats.skippedNoUser += 1;
      continue;
    }

    const title = isOverdue
      ? "แจ้งเตือนรายงานตัวกลับ (เกินกำหนด)"
      : "แจ้งเตือนรายงานตัวกลับ";
    const message = isOverdue
      ? `ครบกำหนดรายงานตัวกลับจากการลาแล้ว (${row.days_since_end} วันหลังวันสิ้นสุดการลา)`
      : `กรุณารายงานตัวกลับภายใน ${maxDays} วันหลังสิ้นสุดการลา`;

    try {
      await NotificationService.notifyUser(
        userId,
        title,
        message,
        "/dashboard/user/requests",
        "LEAVE",
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
