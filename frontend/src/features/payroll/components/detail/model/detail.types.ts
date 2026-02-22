"use client"

export type PeriodStatus =
  | "OPEN"
  | "WAITING_HR"
  | "WAITING_HEAD_FINANCE"
  | "WAITING_DIRECTOR"
  | "CLOSED"

export type IssueKey =
  | "LICENSE_EXPIRED"
  | "LICENSE_SOON"
  | "HAS_DEDUCTION"
  | "HAS_RETRO"
  | "HAS_RETRO_DEDUCT"
  | "HAS_NOTE"

export type IssueTag = {
  key: IssueKey
  label: string
  level: "ต้องหยุดก่อน" | "ควรตรวจ"
}

export type PayrollRow = {
  id: number
  citizenId: string
  eligibilityId: number | null
  requestId: number | null
  title: string
  name: string
  position: string
  department: string
  professionCode: string
  rateGroup: string
  groupNo: string
  itemNo: string
  subItemNo: string
  baseRate: number
  retroactiveAmount: number
  workDays: number
  leaveDays: number
  totalAmount: number
  deductionAmount: number
  licenseValidUntil?: string | null
  licenseStatus?: string | null
  issues: IssueTag[]
  checkCount: number
  blockerCount: number
  warningCount: number
  note?: string
}
