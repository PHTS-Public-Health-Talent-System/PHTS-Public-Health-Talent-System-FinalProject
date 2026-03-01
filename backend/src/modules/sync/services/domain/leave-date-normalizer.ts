import type { RowDataPacket } from 'mysql2/promise';
import { HALF_DAY_LABELS, normalizeDigitsText } from '@/modules/sync/services/domain/leave-classification-rules.js';

const MIN_REASONABLE_YEAR = 1990;
const FUTURE_YEAR_TOLERANCE = 2;

export type DateRange = {
  start: Date | null;
  end: Date | null;
};

const currentYear = (): number => new Date().getUTCFullYear();

const normalizeSuspiciousFutureYear = (year: number): number => {
  const maxExpectedYear = currentYear() + FUTURE_YEAR_TOLERANCE;
  if (year <= maxExpectedYear) return year;

  const candidateFromShiftBug = year - 43;
  if (candidateFromShiftBug >= MIN_REASONABLE_YEAR && candidateFromShiftBug <= maxExpectedYear) {
    return candidateFromShiftBug;
  }

  return year;
};

const buildUtcDate = (year: number, month: number, day: number): Date | null => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
};

export const toDateOnly = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const text = normalizeDigitsText(String(value)).trim();

  let match = /^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(text);
  if (match) {
    let year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year > 2400) year -= 543;
    year = normalizeSuspiciousFutureYear(year);
    return buildUtcDate(year, month, day);
  }

  match = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(text);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = Number(match[3]);
    if (year > 2400) year -= 543;
    year = normalizeSuspiciousFutureYear(year);
    return buildUtcDate(year, month, day);
  }

  return null;
};

export const toDateString = (value: Date | null): string | null => {
  if (!value) return null;
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const diffDaysInclusive = (start: Date | null, end: Date | null): number => {
  if (!start || !end) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / 86400000);
  return diff + 1;
};

export const fiscalYearFromDate = (date: Date | null): number | null => {
  if (!date) return null;
  const year = date.getUTCFullYear() + 543;
  const month = date.getUTCMonth() + 1;
  return year + (month >= 10 ? 1 : 0);
};

export const normalizeDateRange = (row: RowDataPacket): DateRange => {
  const start = toDateOnly(row.start_date);
  const end = toDateOnly(row.end_date);
  if (!start || !end) {
    return { start: start ?? end, end: end ?? start };
  }
  return {
    start: new Date(Math.min(start.getTime(), end.getTime())),
    end: new Date(Math.max(start.getTime(), end.getTime())),
  };
};

export const resolveDurationDays = (row: RowDataPacket, range: DateRange): number => {
  const sourceType = String(row.source_type ?? 'LEAVE');
  const halfDay = Number(row.half_day ?? 0) === 1;
  const endDateDetail = String(row.end_date_detail ?? '');
  const sameDay = range.start && range.end && range.start.getTime() === range.end.getTime();
  const rawDuration = diffDaysInclusive(range.start, range.end);
  if (sourceType === 'LEAVE' && (halfDay || (sameDay && HALF_DAY_LABELS.has(endDateDetail)))) {
    return 0.5;
  }
  const parsed = Number(row.duration_days ?? rawDuration);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return rawDuration > 0 ? rawDuration : 0;
};
