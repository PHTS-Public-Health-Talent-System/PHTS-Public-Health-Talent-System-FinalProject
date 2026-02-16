import { RowDataPacket } from "mysql2/promise";
import { query } from '@config/database.js';
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { getLicenseAlertSummary } from '@/modules/alerts/services/license-alerts.service.js';

type DigestResult = {
  sent: number;
  mode: "daily" | "weekly" | "none";
  summary: {
    expired: number;
    expiring_30: number;
    expiring_60: number;
    expiring_90: number;
    total: number;
  };
};

const getOfficerCount = async (): Promise<number> => {
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM users WHERE role = 'PTS_OFFICER' AND is_active = 1`,
  );
  return Number(rows[0]?.count ?? 0);
};

const buildMessage = (summary: DigestResult["summary"]) => {
  return [
    `หมดอายุแล้ว: ${summary.expired}`,
    `ใกล้หมดอายุ <=30 วัน: ${summary.expiring_30}`,
    `ใกล้หมดอายุ <=60 วัน: ${summary.expiring_60}`,
    `ใกล้หมดอายุ <=90 วัน: ${summary.expiring_90}`,
  ].join("\n");
};

export async function sendLicenseAlertDigest(
  options: { now?: Date } = {},
): Promise<DigestResult> {
  const now = options.now ?? new Date();
  const summary = await getLicenseAlertSummary(now);
  const hasDaily = summary.expired + summary.expiring_30 > 0;
  const hasWeekly =
    summary.expired +
      summary.expiring_30 +
      summary.expiring_60 +
      summary.expiring_90 >
    0;

  const isMonday = now.getDay() === 1;
  const officerCount = await getOfficerCount();

  if (officerCount === 0) {
    return { sent: 0, mode: "none", summary };
  }

  if (hasDaily) {
    await NotificationService.notifyRole(
      "PTS_OFFICER",
      "License Alerts (รายวัน)",
      buildMessage(summary),
      "/dashboard/officer/license-alerts",
    );
    return { sent: officerCount, mode: "daily", summary };
  }

  if (hasWeekly && isMonday) {
    await NotificationService.notifyRole(
      "PTS_OFFICER",
      "License Alerts (รายสัปดาห์)",
      buildMessage(summary),
      "/dashboard/officer/license-alerts",
    );
    return { sent: officerCount, mode: "weekly", summary };
  }

  return { sent: 0, mode: "none", summary };
}
