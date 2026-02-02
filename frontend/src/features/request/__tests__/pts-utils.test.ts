import { describe, expect, it } from "vitest"
import { findRateIdForSelection, parseClassificationSelection } from "../pts-utils"

describe("parseClassificationSelection", () => {
  it("parses group/item/sub-item selection", () => {
    expect(parseClassificationSelection("group3", "item2_1")).toEqual({
      group_no: 3,
      item_no: "2",
      sub_item_no: "1",
    })
  })

  it("handles missing or invalid selections", () => {
    expect(parseClassificationSelection("", "")).toEqual({
      group_no: null,
      item_no: null,
      sub_item_no: null,
    })
  })

  it("finds rate id by group/item/sub-item", () => {
    const rates = [
      { rate_id: 1, group_no: 3, item_no: "3.1", sub_item_no: "1" },
      { rate_id: 2, group_no: 3, item_no: "3.1", sub_item_no: "2" },
    ]
    expect(findRateIdForSelection(rates, 3, "3.1", "1")).toBe(1)
    expect(findRateIdForSelection(rates, 3, "3.1", "2")).toBe(2)
  })
})
