import { describe, expect, test } from "vitest"
import { deriveReturnReportStatus } from "./reportStatus"

describe("deriveReturnReportStatus", () => {
  test("returns undefined when leave does not require report", () => {
    expect(deriveReturnReportStatus({ requireReport: false })).toBeUndefined()
  })

  test("returns pending when require report but no return date and no events", () => {
    expect(
      deriveReturnReportStatus({
        requireReport: true,
        returnDate: null,
        events: [],
      }),
    ).toBe("pending")
  })

  test("returns reported when return date exists", () => {
    expect(
      deriveReturnReportStatus({
        requireReport: true,
        returnDate: "2026-02-10",
      }),
    ).toBe("reported")
  })

  test("returns reported when events exist even if return date is empty", () => {
    expect(
      deriveReturnReportStatus({
        requireReport: true,
        returnDate: "",
        events: [{ report_date: "2026-02-10" }],
      }),
    ).toBe("reported")
  })
})
