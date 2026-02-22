"use client"

export type PayrollIssueFilter = "all" | "clean" | "needs_attention" | "blocker" | "warning"

export type PayrollSortBy =
  | "name_asc"
  | "name_desc"
  | "department_asc"
  | "department_desc"
  | "amount_desc"
  | "amount_asc"
  | "rate_desc"
  | "rate_asc"

export type ProfessionCardViewModel = {
  code: string
  label: string
  rates: number[]
}

export type ProfessionGroupsViewModel = Record<
  string,
  { group: number; rate: number }[]
>
