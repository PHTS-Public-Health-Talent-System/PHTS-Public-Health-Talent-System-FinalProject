import redis from '@config/redis.js';
import { OPS_JOB_TIMEZONE } from '@/modules/workforce-compliance/constants/workforce-compliance-policy.js';

const SYNC_SCHEDULE_KEY = 'system:sync:auto-schedule';
const SYNC_LAST_RUN_PREFIX = 'system:sync:auto-last-run:';

export type SyncAutoMode = 'DAILY' | 'INTERVAL';

export type SyncAutoScheduleConfig = {
  mode: SyncAutoMode;
  hour: number;
  minute: number;
  interval_minutes: number;
  timezone: string;
};

const DEFAULT_MODE: SyncAutoMode =
  String(process.env.SYNC_AUTO_MODE || '').trim().toUpperCase() === 'INTERVAL'
    ? 'INTERVAL'
    : 'DAILY';

const toSafeInt = (
  raw: string | number | undefined,
  fallback: number,
  min: number,
  max: number,
): number => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
};

const getDefaultSchedule = (): SyncAutoScheduleConfig => ({
  mode: DEFAULT_MODE,
  hour: toSafeInt(process.env.SYNC_AUTO_DAILY_HOUR, 2, 0, 23),
  minute: toSafeInt(process.env.SYNC_AUTO_DAILY_MINUTE, 0, 0, 59),
  interval_minutes: toSafeInt(process.env.SYNC_AUTO_INTERVAL_MINUTES, 60, 1, 1440),
  timezone: process.env.SYNC_AUTO_TIMEZONE || OPS_JOB_TIMEZONE || 'Asia/Bangkok',
});

const normalizeMode = (raw: unknown): SyncAutoMode => {
  const normalized = String(raw || '').trim().toUpperCase();
  return normalized === 'INTERVAL' ? 'INTERVAL' : 'DAILY';
};

const normalizeConfig = (input: Partial<SyncAutoScheduleConfig>): SyncAutoScheduleConfig => {
  const defaults = getDefaultSchedule();
  return {
    mode: normalizeMode(input.mode ?? defaults.mode),
    hour: toSafeInt(input.hour, defaults.hour, 0, 23),
    minute: toSafeInt(input.minute, defaults.minute, 0, 59),
    interval_minutes: toSafeInt(input.interval_minutes, defaults.interval_minutes, 1, 1440),
    timezone:
      typeof input.timezone === 'string' && input.timezone.trim().length > 0
        ? input.timezone.trim()
        : defaults.timezone,
  };
};

const toTwoDigits = (value: number): string => String(value).padStart(2, '0');

const getZonedDateParts = (date: Date, timezone: string) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: Number(getPart('year')),
    month: Number(getPart('month')),
    day: Number(getPart('day')),
    hour: Number(getPart('hour')),
    minute: Number(getPart('minute')),
  };
};

const buildDateKey = (parts: { year: number; month: number; day: number }) =>
  `${parts.year}-${toTwoDigits(parts.month)}-${toTwoDigits(parts.day)}`;

export const getSyncAutoScheduleConfig = async (): Promise<SyncAutoScheduleConfig> => {
  const raw = await redis.get(SYNC_SCHEDULE_KEY);
  if (!raw) return getDefaultSchedule();
  try {
    const parsed = JSON.parse(raw) as Partial<SyncAutoScheduleConfig>;
    return normalizeConfig(parsed);
  } catch {
    return getDefaultSchedule();
  }
};

export const setSyncAutoScheduleConfig = async (
  input: Partial<SyncAutoScheduleConfig>,
): Promise<SyncAutoScheduleConfig> => {
  const normalized = normalizeConfig(input);
  await redis.set(SYNC_SCHEDULE_KEY, JSON.stringify(normalized));
  return normalized;
};

export const shouldRunAutoSync = async (at: Date = new Date()): Promise<boolean> => {
  const schedule = await getSyncAutoScheduleConfig();

  if (schedule.mode === 'DAILY') {
    const parts = getZonedDateParts(at, schedule.timezone);
    const currentMinuteOfDay = parts.hour * 60 + parts.minute;
    const scheduleMinuteOfDay = schedule.hour * 60 + schedule.minute;
    if (currentMinuteOfDay < scheduleMinuteOfDay) {
      return false;
    }

    const dateKey = buildDateKey(parts);
    const lockKey = `${SYNC_LAST_RUN_PREFIX}daily:${dateKey}`;
    const marked = await redis.set(lockKey, '1', 'EX', 60 * 60 * 48, 'NX');
    return Boolean(marked);
  }

  const intervalMinutes = Math.max(1, schedule.interval_minutes);
  const bucket = Math.floor(at.getTime() / (intervalMinutes * 60 * 1000));
  const lockKey = `${SYNC_LAST_RUN_PREFIX}interval:${intervalMinutes}:${bucket}`;
  const ttlSeconds = Math.max(60, intervalMinutes * 60 * 3);
  const marked = await redis.set(lockKey, '1', 'EX', ttlSeconds, 'NX');
  return Boolean(marked);
};

