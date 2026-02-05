import { leaveReturnReportSchema } from '@/modules/payroll/payroll.schema.js';

describe("payroll schema", () => {
  test("rejects invalid return_date format", async () => {
    const result = await leaveReturnReportSchema.safeParseAsync({
      body: {
        leave_record_id: 1,
        return_date: "bad-date",
      },
    });
    expect(result.success).toBe(false);
  });

  test("accepts valid return_date format", async () => {
    const result = await leaveReturnReportSchema.safeParseAsync({
      body: {
        leave_record_id: 1,
        return_date: "2026-02-04",
      },
    });
    expect(result.success).toBe(true);
  });
});
