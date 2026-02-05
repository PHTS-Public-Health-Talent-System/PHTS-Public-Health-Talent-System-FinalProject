/**
 * PHTS System - Holiday Config Service
 *
 * Manages official holidays configuration.
 */

import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { query } from '@config/database.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';

export const getHolidays = async (year?: string | number): Promise<any[]> => {
  let sql = "SELECT * FROM cfg_holidays WHERE is_active = 1";
  const params: any[] = [];

  if (year) {
    sql += " AND YEAR(holiday_date) = ?";
    params.push(year);
  }
  sql += " ORDER BY holiday_date DESC";

  const holidays = await query<RowDataPacket[]>(sql, params);
  return holidays;
};

export const addHoliday = async (
  date: string,
  name: string,
  actorId?: number,
): Promise<void> => {
  await query<ResultSetHeader>(
    "INSERT INTO cfg_holidays (holiday_date, holiday_name, is_active) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE holiday_name = VALUES(holiday_name)",
    [date, name],
  );

  await emitAuditEvent({
    eventType: AuditEventType.HOLIDAY_UPDATE,
    entityType: "holiday",
    entityId: null,
    actorId: actorId ?? null,
    actorRole: null,
    actionDetail: {
      action: "UPSERT",
      holiday_date: date,
      holiday_name: name,
    },
  });
};

export const deleteHoliday = async (
  date: string,
  actorId?: number,
): Promise<void> => {
  await query<ResultSetHeader>(
    "UPDATE cfg_holidays SET is_active = 0 WHERE holiday_date = ?",
    [date],
  );

  await emitAuditEvent({
    eventType: AuditEventType.HOLIDAY_UPDATE,
    entityType: "holiday",
    entityId: null,
    actorId: actorId ?? null,
    actorRole: null,
    actionDetail: {
      action: "DEACTIVATE",
      holiday_date: date,
    },
  });
};
