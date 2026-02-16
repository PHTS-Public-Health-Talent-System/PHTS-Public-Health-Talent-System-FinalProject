"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, GraduationCap, Trash2, Eye, User } from "lucide-react"
import type { LeaveRecord, LeaveRecordDocument } from "@/features/leave-records/components/leaveRecords.types"

function resolveFileUrl(filePath: string): string {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"
  const baseUrl = apiBase.replace(/\/api\/?$/, "")
  const normalizedPath = filePath.includes("uploads/") ? filePath.slice(filePath.indexOf("uploads/")) : filePath
  return `${baseUrl}/${normalizedPath}`
}

export function LeaveDetailContent({
  leave,
  getLeaveTypeColor,
  formatDateDisplay,
  documents,
  onPreview,
  onDeleteDocument,
}: {
  leave: LeaveRecord
  getLeaveTypeColor: (type: string) => string
  formatDateDisplay: (date: string) => string
  documents: LeaveRecordDocument[]
  onPreview: (url: string, name: string) => void
  onDeleteDocument: (documentId: number) => void
}) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-secondary/50 border border-border">
        <div className="flex items-center gap-3 mb-3">
          <User className="h-5 w-5 text-primary" />
          <span className="font-medium">ข้อมูลผู้ลา</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">ชื่อ-นามสกุล</p>
            <p className="font-medium">{leave.personName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">ตำแหน่ง</p>
            <p className="font-medium">{leave.personPosition}</p>
          </div>
          <div>
            <p className="text-muted-foreground">หน่วยงาน</p>
            <p className="font-medium">{leave.personDepartment}</p>
          </div>
        </div>
      </div>

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
              <Badge variant="outline" className={
                leave.reportStatus === "reported"
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-400 border-amber-500/30"
              }>
                {leave.reportStatus === "reported" ? "รายงานตัวแล้ว" : "รอรายงานตัว"}
              </Badge>
            </div>
            {leave.reportDate && (
              <p className="text-sm mt-2">วันที่รายงานตัว: {formatDateDisplay(leave.reportDate)}</p>
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

      {documents.length > 0 && (
        <div className="p-4 rounded-lg bg-slate-500/10 border border-slate-500/30">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-5 w-5 text-slate-400" />
            <span className="font-medium text-slate-400">เอกสารแนบ</span>
          </div>
          <div className="space-y-2">
            {documents.map((doc) => {
              const fileUrl = resolveFileUrl(doc.file_path)
              return (
                <div key={doc.document_id} className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">{doc.file_type}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onPreview(fileUrl, doc.file_name)}
                      className="h-8 w-8 text-slate-500 hover:text-primary"
                      aria-label="ดูเอกสารแนบ"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteDocument(doc.document_id)}
                      className="h-8 w-8 text-slate-500 hover:text-destructive"
                      aria-label="ลบเอกสารแนบ"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
