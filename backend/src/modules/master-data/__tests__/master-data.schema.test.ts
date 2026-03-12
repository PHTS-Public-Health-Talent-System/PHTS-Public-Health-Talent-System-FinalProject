import { describe, expect, test } from "@jest/globals";
import {
  deleteRateSchema,
  updateRateSchema,
} from "@/modules/master-data/master-data.schema.js";

describe("master-data schema", () => {
  test("updateRateSchema rejects non-numeric rateId", () => {
    expect(() =>
      updateRateSchema.parse({
        params: { rateId: "abc" },
        body: {},
      }),
    ).toThrow();
  });

  test("deleteRateSchema rejects non-numeric rateId", () => {
    expect(() =>
      deleteRateSchema.parse({
        params: { rateId: "abc" },
      }),
    ).toThrow();
  });

  test("updateRateSchema accepts numeric rateId", () => {
    const parsed = updateRateSchema.parse({
      params: { rateId: "42" },
      body: { amount: 10 },
    });

    expect(parsed.params.rateId).toBe(42);
  });
});
