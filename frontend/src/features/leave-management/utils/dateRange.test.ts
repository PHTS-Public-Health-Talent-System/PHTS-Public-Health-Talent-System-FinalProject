import { describe, expect, test } from "vitest"
import { isValidDateRange, validateOptionalDateRange } from "./dateRange"

describe("leave date range utils", () => {
  test("isValidDateRange accepts same day", () => {
    expect(isValidDateRange("2026-02-01", "2026-02-01")).toBe(true)
  })

  test("isValidDateRange accepts start before end", () => {
    expect(isValidDateRange("2026-02-01", "2026-02-10")).toBe(true)
  })

  test("isValidDateRange rejects start after end", () => {
    expect(isValidDateRange("2026-02-16", "2026-02-01")).toBe(false)
  })

  test("validateOptionalDateRange returns null when both empty", () => {
    expect(validateOptionalDateRange("", "", "ตามเอกสาร")).toBeNull()
  })

  test("validateOptionalDateRange requires both sides when one provided", () => {
    expect(validateOptionalDateRange("2026-02-01", "", "ตามเอกสาร")).toContain("กรุณาระบุวันที่เริ่มและวันที่สิ้นสุดให้ครบ")
    expect(validateOptionalDateRange("", "2026-02-01", "ตามเอกสาร")).toContain("กรุณาระบุวันที่เริ่มและวันที่สิ้นสุดให้ครบ")
  })

  test("validateOptionalDateRange rejects reversed range", () => {
    expect(validateOptionalDateRange("2026-02-16", "2026-02-01", "ตามเอกสาร")).toContain("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม")
  })
})

