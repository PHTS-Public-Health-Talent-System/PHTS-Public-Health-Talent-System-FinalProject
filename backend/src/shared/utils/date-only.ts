const DATE_PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/;

const parseTimezoneOffsetMinutes = (value: string): number | null => {
  const normalized = value.trim().toUpperCase();
  if (!normalized || normalized === "Z" || normalized === "UTC") return 0;
  const match = normalized.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) return null;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;
  return sign * (hours * 60 + minutes);
};

const formatByOffset = (date: Date, timezoneOffset: string): string => {
  const offsetMinutes = parseTimezoneOffsetMinutes(timezoneOffset);
  if (offsetMinutes === null) return date.toISOString().slice(0, 10);
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = `${shifted.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${shifted.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatByIanaTimezone = (date: Date, timezone: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return date.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
};

export const formatDateOnly = (
  value: Date | string,
  options?: { timezone?: string; fallbackTimezoneOffset?: string },
): string => {
  const raw = typeof value === "string" ? value.trim() : null;
  if (raw) {
    const datePrefix = raw.match(DATE_PREFIX_PATTERN);
    if (datePrefix?.[1]) return datePrefix[1];
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new RangeError("Invalid time value");
  }

  const timezone = options?.timezone?.trim() || "";
  if (timezone) {
    if (/^[+-]\d{2}:?\d{2}$/.test(timezone) || timezone.toUpperCase() === "UTC" || timezone === "Z") {
      return formatByOffset(parsed, timezone);
    }
    return formatByIanaTimezone(parsed, timezone);
  }

  const fallbackOffset = options?.fallbackTimezoneOffset || "+07:00";
  return formatByOffset(parsed, fallbackOffset);
};
