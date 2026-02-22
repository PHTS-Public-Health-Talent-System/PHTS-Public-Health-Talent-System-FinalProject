import { buildSearchParam, normalizeSearchQuery } from "./search"

test("normalizeSearchQuery trims, lowercases, and splits into tokens", () => {
  expect(normalizeSearchQuery("  สมชาย   ใจดี 1100 ")).toEqual([
    "สมชาย",
    "ใจดี",
    "1100",
  ])
})

test("buildSearchParam returns undefined for empty input", () => {
  expect(buildSearchParam("   ")).toBeUndefined()
})

test("buildSearchParam joins tokens with spaces", () => {
  expect(buildSearchParam("Somchai 1100")).toBe("somchai 1100")
})
