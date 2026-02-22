export function normalizeSearchQuery(input: string): string[] {
  return input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

export function buildSearchParam(input: string): string | undefined {
  const tokens = normalizeSearchQuery(input)
  if (tokens.length === 0) return undefined
  return tokens.join(" ")
}
