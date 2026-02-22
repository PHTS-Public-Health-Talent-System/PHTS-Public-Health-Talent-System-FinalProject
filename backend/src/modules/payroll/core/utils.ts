export function formatLocalDate(
  input: Date | string | null | undefined,
): string {
  if (!input) return "";
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function makeLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 0, 0, 0, 0);
}

export function isHoliday(dateStr: string, holidays: string[]): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const day = d.getDay();
  // ระบบถือว่า "วันหยุด" = เสาร์/อาทิตย์ หรืออยู่ใน cfg_holidays
  return day === 0 || day === 6 || holidays.includes(dateStr);
}

export function countBusinessDays(
  start: Date,
  end: Date,
  holidays: string[],
): number {
  // นับเฉพาะวันทำการ (ไม่ใช่ weekend และไม่อยู่ใน holiday list)
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (!isHoliday(formatLocalDate(cur), holidays)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function countCalendarDays(start: Date, end: Date): number {
  return (
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
}
