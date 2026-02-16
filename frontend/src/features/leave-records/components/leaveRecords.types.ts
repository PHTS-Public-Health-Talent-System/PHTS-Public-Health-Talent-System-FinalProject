import type { LeaveRecordDocumentRow } from "@/features/leave-records/api"

export interface LeaveRecord {
  id: number
  source: "hrms"
  personId: string
  personName: string
  personPosition: string
  personDepartment: string
  type: string
  typeName: string
  userStartDate: string
  userEndDate: string
  documentStartDate?: string
  documentEndDate?: string
  days: number
  documentDays?: number
  requireReport: boolean
  reportDate?: string
  reportStatus?: "pending" | "reported"
  studyInfo?: {
    institution: string
    program: string
    field: string
    startDate: string
  }
  note?: string
  createdAt: string
}

export type LeaveRecordDocument = LeaveRecordDocumentRow
