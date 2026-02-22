"use client"

import type { PayrollIssueFilter, PayrollSortBy } from "./detail.view-model"

export const PAYROLL_ISSUE_FILTER_OPTIONS: Array<{
  value: PayrollIssueFilter
  label: string
}> = [
  { value: "all", label: "ทุกสถานะตรวจ" },
  { value: "clean", label: "ปกติ" },
  { value: "needs_attention", label: "ต้องตรวจ" },
  { value: "blocker", label: "ต้องหยุดก่อน" },
  { value: "warning", label: "มีคำเตือน" },
]

export const PAYROLL_SORT_OPTIONS: Array<{
  value: PayrollSortBy
  label: string
}> = [
  { value: "amount_desc", label: "ยอดสุทธิ มาก->น้อย" },
  { value: "amount_asc", label: "ยอดสุทธิ น้อย->มาก" },
  { value: "name_asc", label: "ชื่อ ก-ฮ" },
  { value: "name_desc", label: "ชื่อ ฮ-ก" },
  { value: "department_asc", label: "หน่วยงาน ก-ฮ" },
  { value: "department_desc", label: "หน่วยงาน ฮ-ก" },
  { value: "rate_desc", label: "อัตรา มาก->น้อย" },
  { value: "rate_asc", label: "อัตรา น้อย->มาก" },
]
