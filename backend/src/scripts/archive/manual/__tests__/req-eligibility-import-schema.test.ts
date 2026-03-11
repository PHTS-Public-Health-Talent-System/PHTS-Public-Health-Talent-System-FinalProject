import { chooseImportRequestId } from "@/scripts/archive/manual/req-eligibility-import-schema.js";

describe("chooseImportRequestId", () => {
  it("uses null when request_id allows null", () => {
    expect(chooseImportRequestId(true)).toBeNull();
  });

  it("uses sentinel 0 when request_id is NOT NULL", () => {
    expect(chooseImportRequestId(false)).toBe(0);
  });
});
