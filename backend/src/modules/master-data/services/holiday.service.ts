/**
 * PHTS System - Holiday Config Service
 *
 * Manages official holidays configuration.
 */

import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { query } from '@config/database.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';

type HolidayType = "national" | "special" | "substitution";

const resolveHolidayTypeFromName = (name?: string | null): HolidayType => {
  const normalized = String(name ?? "");
  if (normalized.includes("ชดเชย")) return "substitution";
  if (normalized.includes("พิเศษ")) return "special";
  return "national";
};

const normalizeHolidayDate = (value: unknown): string => {
  // mysql2 may return Date objects for DATE/DATETIME columns.
  // IMPORTANT: Using toISOString() can shift the day depending on timezone.
  // Our API contract expects 'YYYY-MM-DD' (date-only) for route params & frontend date inputs.
  if (!value) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value);
  if (!raw) return "";
  // Handle ISO strings or DATETIME-like strings
  if (raw.includes("T")) return raw.slice(0, 10);
  if (raw.includes(" ")) return raw.slice(0, 10);
  return raw;
};

let holidayTypeColumnAvailable: boolean | null = null;

const hasHolidayTypeColumn = async (): Promise<boolean> => {
  if (holidayTypeColumnAvailable !== null) {
    return holidayTypeColumnAvailable;
  }
  const rows = await query<RowDataPacket[]>(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'cfg_holidays'
       AND COLUMN_NAME = 'holiday_type'
     LIMIT 1`,
  );
  holidayTypeColumnAvailable = rows.length > 0;
  return holidayTypeColumnAvailable;
};

export const getHolidays = async (year?: string | number): Promise<any[]> => {
  const hasTypeColumn = await hasHolidayTypeColumn();
  let sql = hasTypeColumn
    ? "SELECT holiday_date, holiday_name, is_active, holiday_type FROM cfg_holidays WHERE is_active = 1"
    : "SELECT holiday_date, holiday_name, is_active, NULL AS holiday_type FROM cfg_holidays WHERE is_active = 1";
  const params: any[] = [];

  if (year) {
    sql += " AND YEAR(holiday_date) = ?";
    params.push(year);
  }
  sql += " ORDER BY holiday_date DESC";

  const holidays = await query<RowDataPacket[]>(sql, params);
  return holidays.map((row) => ({
    ...row,
    holiday_date: normalizeHolidayDate((row as any).holiday_date),
    holiday_type: (row as any).holiday_type ?? resolveHolidayTypeFromName((row as any).holiday_name),
  }));
};

export const addHoliday = async (
  date: string,
  name: string,
  type?: HolidayType,
  actorId?: number,
): Promise<void> => {
  const hasTypeColumn = await hasHolidayTypeColumn();
  if (hasTypeColumn) {
    await query<ResultSetHeader>(
      `INSERT INTO cfg_holidays (holiday_date, holiday_name, holiday_type, is_active)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         holiday_name = VALUES(holiday_name),
         holiday_type = VALUES(holiday_type),
         is_active = 1`,
      [date, name, type ?? resolveHolidayTypeFromName(name)],
    );
  } else {
    await query<ResultSetHeader>(
      "INSERT INTO cfg_holidays (holiday_date, holiday_name, is_active) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE holiday_name = VALUES(holiday_name), is_active = 1",
      [date, name],
    );
  }

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
      holiday_type: type ?? resolveHolidayTypeFromName(name),
    },
  });
};

export const updateHoliday = async (
  originalDate: string,
  date: string,
  name: string,
  type?: HolidayType,
  actorId?: number,
): Promise<void> => {
  const hasTypeColumn = await hasHolidayTypeColumn();
  if (hasTypeColumn) {
    await query<ResultSetHeader>(
      `UPDATE cfg_holidays
       SET holiday_date = ?, holiday_name = ?, holiday_type = ?, is_active = 1
       WHERE holiday_date = ? OR DATE(holiday_date) = ?`,
      [date, name, type ?? resolveHolidayTypeFromName(name), originalDate, originalDate],
    );
  } else {
    await query<ResultSetHeader>(
      `UPDATE cfg_holidays
       SET holiday_date = ?, holiday_name = ?, is_active = 1
       WHERE holiday_date = ? OR DATE(holiday_date) = ?`,
      [date, name, originalDate, originalDate],
    );
  }

  await emitAuditEvent({
    eventType: AuditEventType.HOLIDAY_UPDATE,
    entityType: "holiday",
    entityId: null,
    actorId: actorId ?? null,
    actorRole: null,
    actionDetail: {
      action: "UPDATE",
      original_holiday_date: originalDate,
      holiday_date: date,
      holiday_name: name,
      holiday_type: type ?? resolveHolidayTypeFromName(name),
    },
  });
};

export const deleteHoliday = async (
  date: string,
  actorId?: number,
): Promise<void> => {
  await query<ResultSetHeader>(
    "UPDATE cfg_holidays SET is_active = 0 WHERE holiday_date = ? OR DATE(holiday_date) = ?",
    [date, date],
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
