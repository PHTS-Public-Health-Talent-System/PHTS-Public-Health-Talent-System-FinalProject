export const THAI_LOCALE = "th-TH-u-ca-buddhist";
export const THAI_TIMEZONE = "Asia/Bangkok";

export const toGregorianYear = (year: number): number => (year >= 2400 ? year - 543 : year);
export const toBuddhistYear = (year: number): number => (year >= 2400 ? year : year + 543);

const toDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const formatThaiDate = (
  value?: string | Date | null,
  options?: Intl.DateTimeFormatOptions,
): string => {
  const date = toDate(value);
  if (!date) return "-";
  const hasStyle = Boolean(options?.dateStyle || options?.timeStyle);
  const normalizedOptions: Intl.DateTimeFormatOptions = {
    timeZone: THAI_TIMEZONE,
    ...(hasStyle ? {} : { day: "numeric", month: "short", year: "numeric" }),
    ...options,
  };

  // dateStyle/timeStyle cannot be combined with day/month/year/hour/minute in Intl options.
  if (hasStyle) {
    delete normalizedOptions.day;
    delete normalizedOptions.month;
    delete normalizedOptions.year;
    delete normalizedOptions.hour;
    delete normalizedOptions.minute;
    delete normalizedOptions.second;
  }

  return date.toLocaleDateString(THAI_LOCALE, normalizedOptions);
};

export const formatThaiDateTime = (
  value?: string | Date | null,
  options?: Intl.DateTimeFormatOptions,
): string => {
  const date = toDate(value);
  if (!date) return "-";
  const hasStyle = Boolean(options?.dateStyle || options?.timeStyle);
  const normalizedOptions: Intl.DateTimeFormatOptions = {
    timeZone: THAI_TIMEZONE,
    ...(hasStyle
      ? {}
      : { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    ...options,
  };

  if (hasStyle) {
    delete normalizedOptions.day;
    delete normalizedOptions.month;
    delete normalizedOptions.year;
    delete normalizedOptions.hour;
    delete normalizedOptions.minute;
    delete normalizedOptions.second;
  }

  return date.toLocaleString(THAI_LOCALE, normalizedOptions);
};

export const formatThaiTime = (
  value?: string | Date | null,
  options?: Intl.DateTimeFormatOptions,
): string => {
  const date = toDate(value);
  if (!date) return "-";
  const hasStyle = Boolean(options?.timeStyle);
  const normalizedOptions: Intl.DateTimeFormatOptions = {
    timeZone: THAI_TIMEZONE,
    ...(hasStyle ? {} : { hour: "2-digit", minute: "2-digit" }),
    ...options,
  };

  if (hasStyle) {
    delete normalizedOptions.hour;
    delete normalizedOptions.minute;
    delete normalizedOptions.second;
  }

  return date.toLocaleTimeString(THAI_LOCALE, normalizedOptions);
};

export const formatThaiMonthYear = (month: number, year: number): string => {
  const normalizedYear = toGregorianYear(year);
  const date = new Date(normalizedYear, month - 1, 1);
  return date.toLocaleDateString(THAI_LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: THAI_TIMEZONE,
  });
};

export const formatThaiCurrency = (amount: number): string =>
  new Intl.NumberFormat(THAI_LOCALE, {
    style: "currency",
    currency: "THB",
  }).format(amount);

export const formatThaiNumber = (
  value: number,
  options?: Intl.NumberFormatOptions,
): string => new Intl.NumberFormat(THAI_LOCALE, options).format(value);
