"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GraduationCap, Pencil, Trash2, User } from "lucide-react"
import type { LeaveRecord, LeaveRecordDocument } from "@/features/leave-management/types/leaveManagement.types"
import type { LeaveReturnReportEvent } from "@/features/leave-management/api"
import { deriveReturnReportStatus } from "@/features/leave-management/utils/reportStatus"
import { ReturnReportStatusBadge } from "@/components/common"
import { AttachmentList } from "@/components/common"
import { EntitySummaryCard } from "@/components/common"

export function LeaveDetailContent({
  leave,
  getLeaveTypeColor,
  formatDateDisplay,
  documents,
  returnReportEvents = [],
  onPreview,
  onDeleteDocument,
  onEditReturnReportEvent,
  onDeleteReturnReportEvent,
}: {
  leave: LeaveRecord
  getLeaveTypeColor: (type: string) => string
  formatDateDisplay: (date: string) => string
  documents: LeaveRecordDocument[]
  returnReportEvents?: LeaveReturnReportEvent[]
  onPreview: (url: string, name: string) => void
  onDeleteDocument: (documentId: number) => void
  onEditReturnReportEvent?: (event: LeaveReturnReportEvent) => void
  onDeleteReturnReportEvent?: (event: LeaveReturnReportEvent) => void
}) {
  const derivedReportStatus = deriveReturnReportStatus({
    requireReport: leave.requireReport,
    returnDate: leave.reportDate,
    events: returnReportEvents,
  })
  const reportStatus = derivedReportStatus ?? leave.reportStatus

  return (
    <div className="space-y-4">
      <EntitySummaryCard
        title="ข้อมูลผู้ลา"
        icon={User}
        fields={[
          { label: "ชื่อ-นามสกุล", value: leave.personName },
          { label: "ตำแหน่ง", value: leave.personPosition },
          { label: "หน่วยงาน", value: leave.personDepartment },
        ]}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">ประเภทการลา</span>
          <Badge variant="outline" className={getLeaveTypeColor(leave.type)}>
            {leave.typeName}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">วันที่ลา (ตาม ผู้ใช้งาน)</p>
            <p className="font-medium">{formatDateDisplay(leave.userStartDate)} - {formatDateDisplay(leave.userEndDate)}</p>
          </div>
          {leave.documentStartDate && (
            <div>
              <p className="text-muted-foreground">วันที่ลา (ตามเอกสาร)</p>
              <p className="font-medium text-amber-400">{formatDateDisplay(leave.documentStartDate)} - {formatDateDisplay(leave.documentEndDate || "")}</p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">จำนวนวัน</p>
            <p className="font-medium">{leave.days} วัน</p>
          </div>
          <div>
            <p className="text-muted-foreground">ต้องรายงานตัว</p>
            <p className="font-medium">{leave.requireReport ? "ใช่" : "ไม่"}</p>
          </div>
        </div>

        {leave.requireReport && (
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-400">สถานะการรายงานตัว</span>
              <ReturnReportStatusBadge status={reportStatus} tone="strong" />
            </div>
            {leave.reportDate && (
              <p className="text-sm mt-2">วันที่รายงานตัว: {formatDateDisplay(leave.reportDate)}</p>
            )}
            {returnReportEvents.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">ประวัติการรายงานตัว</p>
                {returnReportEvents.map((event) => (
                  <div
                    key={`${event.event_id ?? "new"}-${event.report_date}`}
                    className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-card/50 px-3 py-2 text-xs"
                  >
                    <div>
                      <p>
                        รายงานตัว: <span className="font-medium">{formatDateDisplay(event.report_date)}</span>
                      </p>
                      <p>
                        กลับไปต่อ:{" "}
                        <span className="font-medium">
                          {event.resume_date ? formatDateDisplay(event.resume_date) : "-"}
                        </span>
                      </p>
                      {event.resume_study_program && (
                        <p>
                          หลักสูตร: <span className="font-medium">{event.resume_study_program}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {onEditReturnReportEvent && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => onEditReturnReportEvent(event)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {onDeleteReturnReportEvent && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => onDeleteReturnReportEvent(event)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {leave.note && (
          <div>
            <p className="text-muted-foreground text-sm">หมายเหตุ</p>
            <p className="text-sm">{leave.note}</p>
          </div>
        )}
      </div>

      {leave.studyInfo && (
        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="h-5 w-5 text-purple-400" />
            <span className="font-medium text-purple-400">ข้อมูลการลาศึกษาต่อ</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">สถานศึกษา</p>
              <p className="font-medium">{leave.studyInfo.institution}</p>
            </div>
            <div>
              <p className="text-muted-foreground">หลักสูตร</p>
              <p className="font-medium">{leave.studyInfo.program}</p>
            </div>
            <div>
              <p className="text-muted-foreground">สาขาวิชา</p>
              <p className="font-medium">{leave.studyInfo.field}</p>
            </div>
            <div>
              <p className="text-muted-foreground">วันที่เริ่มศึกษา</p>
              <p className="font-medium">{formatDateDisplay(leave.studyInfo.startDate)}</p>
            </div>
          </div>
        </div>
      )}

      <AttachmentList
        items={documents.map((doc) => ({
          id: doc.document_id,
          name: doc.file_name,
          type: doc.file_type,
          path: doc.file_path,
        }))}
        onPreview={onPreview}
        onDelete={onDeleteDocument}
      />
    </div>
  )
}
