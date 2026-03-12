import { describe, expect, test } from "@jest/globals";
import { getQueueSchema } from "@/modules/access-review/access-review.schema.js";

describe("access-review schema", () => {
  test("rejects impossible detected_from date", () => {
    expect(() =>
      getQueueSchema.parse({
        query: { detected_from: "2026-02-31" },
      }),
    ).toThrow();
  });

  test("accepts valid detected_from date", () => {
    const parsed = getQueueSchema.parse({
      query: { detected_from: "2026-02-28" },
    });

    expect(parsed.query.detected_from).toBe("2026-02-28");
  });
});
