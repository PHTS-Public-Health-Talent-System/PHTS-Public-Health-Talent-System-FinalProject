import {
  countBusinessDays,
  countCalendarDays,
  formatLocalDate,
  isHoliday,
  makeLocalDate,
} from '@/modules/payroll/core/utils.js';

describe("payroll core utils", () => {
  test("formatLocalDate returns yyyy-mm-dd or empty on invalid", () => {
    expect(formatLocalDate("2026-02-04")).toBe("2026-02-04");
    expect(formatLocalDate(new Date(2026, 1, 4))).toBe("2026-02-04");
    expect(formatLocalDate("invalid")).toBe("");
    expect(formatLocalDate(null)).toBe("");
  });

  test("makeLocalDate sets time to midnight local", () => {
    const d = makeLocalDate(2026, 1, 4);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  test("isHoliday treats weekend and listed holidays as true", () => {
    expect(isHoliday("2026-02-07", [])).toBe(true); // Saturday
    expect(isHoliday("2026-02-08", [])).toBe(true); // Sunday
    expect(isHoliday("2026-02-10", ["2026-02-10"])).toBe(true);
    expect(isHoliday("2026-02-09", [])).toBe(false);
  });

  test("countBusinessDays excludes weekends and holidays", () => {
    const start = new Date("2026-02-09"); // Monday
    const end = new Date("2026-02-13"); // Friday
    const holidays = ["2026-02-11"];
    expect(countBusinessDays(start, end, holidays)).toBe(4);
  });

  test("countCalendarDays is inclusive", () => {
    const start = new Date("2026-02-01");
    const end = new Date("2026-02-03");
    expect(countCalendarDays(start, end)).toBe(3);
  });
});
