import { describe, expect, test } from "@jest/globals";
import { auditSearchQuerySchema } from "@/modules/audit/audit.schema.js";

describe("audit schema", () => {
  test("rejects impossible calendar date in query", () => {
    expect(() =>
      auditSearchQuerySchema.parse({
        query: { startDate: "2026-02-31" },
      }),
    ).toThrow();
  });

  test("accepts valid calendar date in query", () => {
    const parsed = auditSearchQuerySchema.parse({
      query: { startDate: "2026-02-28" },
    });

    expect(parsed.query.startDate).toBe("2026-02-28");
  });
});
