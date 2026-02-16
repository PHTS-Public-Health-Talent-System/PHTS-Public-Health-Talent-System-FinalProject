import { retirementCreateSchema } from '@/modules/alerts/alerts.schema.js';

describe("alerts schema", () => {
  test("rejects invalid retire_date", async () => {
    const result = await retirementCreateSchema.safeParseAsync({
      body: {
        citizen_id: "123",
        retire_date: "not-a-date",
      },
    });
    expect(result.success).toBe(false);
  });

  test("accepts valid retire_date", async () => {
    const result = await retirementCreateSchema.safeParseAsync({
      body: {
        citizen_id: "123",
        retire_date: "2026-02-04",
      },
    });
    expect(result.success).toBe(true);
  });
});
