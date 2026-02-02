export const parseClassificationSelection = (
  groupId: string,
  itemId: string,
) => {
  const groupMatch = groupId.match(/\d+/)
  const group_no = groupMatch ? Number(groupMatch[0]) : null
  const rawItem = itemId.replace(/^item/, "")
  if (!rawItem) {
    return { group_no, item_no: null, sub_item_no: null }
  }
  const [itemPart, subPart] = rawItem.split("_")
  const item_no = itemPart || null
  const sub_item_no = subPart || null

  return {
    group_no,
    item_no,
    sub_item_no,
  }
}

export const findRateIdForSelection = (
  rates: Array<{
    rate_id: number
    group_no: number
    item_no: string
    sub_item_no: string | null
  }>,
  groupNo: number,
  itemNo: string | null,
  subItemNo: string | null,
) => {
  if (!itemNo) return null
  const [itemBaseInput, itemSubInput] = String(itemNo).split(".")
  const itemToken = itemBaseInput
  const subToken = subItemNo ?? itemSubInput ?? null
  const match = rates.find((rate) => {
    const itemBase = rate.item_no?.split(".")[0]
    const itemSub = rate.sub_item_no ?? rate.item_no?.split(".")[1] ?? null
    return (
      rate.group_no === groupNo &&
      itemBase === itemToken &&
      (subToken ? itemSub === subToken : itemSub == null)
    )
  })
  return match?.rate_id ?? null
}
