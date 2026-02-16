"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CalendarCheck, Edit, Eye, Trash2 } from "lucide-react"
import type { LeaveRecord } from "@/features/leave-records/components/leaveRecords.types"

export function LeaveTable({
  records,
  onViewDetail,
  onEdit,
  onDelete,
  onRecordReport,
  getLeaveTypeColor,
  formatDateDisplay,
  showReportButton = false,
  isLoading = false,
  isError = false,
  onRetry,
}: {
  records: LeaveRecord[]
  onViewDetail: (record: LeaveRecord) => void
  onEdit: (record: LeaveRecord) => void
  onDelete: (record: LeaveRecord) => void
  onRecordReport: (record: LeaveRecord) => void
  getLeaveTypeColor: (type: string) => string
  formatDateDisplay: (date: string) => string
  showReportButton?: boolean
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
}) {
  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        กำลังโหลดข้อมูล...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-sm text-destructive">
        <span>โหลดข้อมูลไม่สำเร็จ</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            ลองอีกครั้ง
          </Button>
        )}
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        ไม่พบรายการ
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/50 hover:bg-secondary/50">
            <TableHead className="text-muted-foreground w-[220px]">ชื่อ-นามสกุล</TableHead>
            <TableHead className="text-muted-foreground w-[180px]">กลุ่มงาน</TableHead>
            <TableHead className="text-muted-foreground w-[140px]">ประเภท</TableHead>
            <TableHead className="text-muted-foreground w-[220px]">ช่วงวันลา</TableHead>
            <TableHead className="text-muted-foreground text-center w-[90px]">จำนวนวัน</TableHead>
            <TableHead className="text-muted-foreground w-[96px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id} className="hover:bg-secondary/30">
              <TableCell className="align-middle">
                <div>
                  <p className="font-medium">{record.personName}</p>
                  <p className="text-xs text-muted-foreground">{record.personPosition}</p>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                <span className="block truncate max-w-[180px]">{record.personDepartment}</span>
              </TableCell>
              <TableCell className="align-middle">
                <Badge variant="outline" className={getLeaveTypeColor(record.type)}>
                  {record.typeName}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                <span className="whitespace-nowrap">
                  {formatDateDisplay(record.userStartDate)} – {formatDateDisplay(record.userEndDate)}
                </span>
              </TableCell>
              <TableCell className="text-center font-medium tabular-nums">{record.days}</TableCell>
              <TableCell className="align-middle">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewDetail(record)} title="ดูรายละเอียด" aria-label="ดูรายละเอียด">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(record)} title="แก้ไข" aria-label="แก้ไขรายการ">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(record)} title="ลบ" aria-label="ลบรายการ">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {showReportButton && record.requireReport && record.reportStatus === "pending" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400" onClick={() => onRecordReport(record)} title="บันทึกการรายงานตัว" aria-label="บันทึกการรายงานตัว">
                      <CalendarCheck className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
