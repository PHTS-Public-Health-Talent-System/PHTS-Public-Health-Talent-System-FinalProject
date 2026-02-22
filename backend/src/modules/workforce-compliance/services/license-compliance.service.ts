import crypto from "node:crypto";
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { AlertLogsRepository } from '@/modules/workforce-compliance/repositories/alert-logs.repository.js';
import { WorkforceComplianceRepository } from '@/modules/workforce-compliance/repositories/workforce-compliance.repository.js';
import { LicenseComplianceRepository } from '@/modules/workforce-compliance/repositories/license-compliance.repository.js';

type AlertBucket = "expired" | "30" | "60" | "90";

type LicenseAlertRow = {
  citizen_id: string;
  full_name: string;
  position_name: string;
  department: string | null;
  profession_code: string | null;
  license_no: string | null;
  license_expiry: string | null;
  days_left: number | null;
  bucket: AlertBucket;
  last_notified_at?: string | null;
};

export async function getLicenseAlertSummary(asOf: Date = new Date()) {
  return LicenseComplianceRepository.getSummary(asOf);
}

export async function getLicenseAlertList(
  bucket: AlertBucket,
  asOf: Date = new Date(),
) {
  const rows = await LicenseComplianceRepository.getListByBucket(bucket, asOf);
  const normalizedRows = (rows as any[]).map((row) => ({
    citizen_id: row.citizen_id,
    full_name: row.full_name?.trim() ? row.full_name.trim() : row.citizen_id,
    position_name: row.position_name,
    profession_code: row.profession_code ?? null,
    license_expiry: row.license_expiry ? String(row.license_expiry) : null,
    days_left: row.days_left !== null ? Number(row.days_left) : null,
    bucket: row.bucket as AlertBucket,
  })) as LicenseAlertRow[];

  const refs = normalizedRows.map((row) => `${row.citizen_id}:${row.bucket}`);
  if (refs.length === 0) return normalizedRows;

  const logs = await AlertLogsRepository.findLatestLicenseLogsByReferenceIds(refs);
  const notifiedMap = new Map<string, string>();
  logs.forEach((row) => {
    if (row.reference_id) {
      notifiedMap.set(row.reference_id, row.sent_at ?? "");
    }
  });

  return normalizedRows.map((row) => ({
    ...row,
    last_notified_at: notifiedMap.get(`${row.citizen_id}:${row.bucket}`) ?? null,
  }));
}

const hashKey = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

async function hasDailyNotification(citizenId: string, bucket: AlertBucket, date: Date): Promise<boolean> {
  const key = `LICENSE_EXPIRING:citizen:${citizenId}:${bucket}:${date.toISOString().slice(0, 10)}`;
  return AlertLogsRepository.hasPayloadHash(hashKey(key));
}

export async function notifyLicenseAlerts(
  items: Array<{ citizen_id: string; bucket: AlertBucket }>,
  asOf: Date = new Date(),
) {
  let sent = 0;
  let skipped = 0;

  for (const item of items) {
    const citizenId = item.citizen_id.trim();
    if (!citizenId) continue;

    if (await hasDailyNotification(citizenId, item.bucket, asOf)) {
      skipped += 1;
      continue;
    }

    const userId = await WorkforceComplianceRepository.findUserIdByCitizenId(citizenId);
    if (userId) {
      const prefix = item.bucket === "expired" ? "ใบอนุญาตหมดอายุแล้ว" : "ใบอนุญาตใกล้หมดอายุ";
      await NotificationService.notifyUserByTemplate(
        userId,
        "WORKFORCE_LICENSE_EXPIRING_USER",
        { prefix },
      );
    }

    const dedupeKey = `LICENSE_EXPIRING:citizen:${citizenId}:${item.bucket}:${asOf.toISOString().slice(0, 10)}`;
    await AlertLogsRepository.insertLog({
      alert_type: "LICENSE_EXPIRING",
      target_user_id: userId ?? null,
      reference_type: "citizen",
      reference_id: `${citizenId}:${item.bucket}`,
      payload_hash: hashKey(dedupeKey),
      status: "SENT",
      sent_at: asOf,
    });
    sent += 1;
  }

  return { sent, skipped };
}

export type { AlertBucket, LicenseAlertRow };
