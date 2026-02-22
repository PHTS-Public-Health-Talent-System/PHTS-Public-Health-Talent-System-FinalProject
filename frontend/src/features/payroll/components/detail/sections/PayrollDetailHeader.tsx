"use client"

import Link from "next/link"
import { ArrowLeft, CheckCircle2, Download, FileText, Send, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog"
import { formatThaiNumber } from "@/shared/utils/thai-locale"
import { formatDate, formatPeriodLabel } from "../model/detail.helpers"

type PayrollDetailHeaderProps = {
  backHref: string
  period: {
    period_month?: number | null
    period_year?: number | null
    created_by_name?: string | null
    created_at?: string | null
    status?: string
  } | undefined
  activeProfessionLabel: string
  statusLabel: string
  statusClassName: string
  allowApprovalActions: boolean
  approvalStatus: string
  approvalLabel: string
  canRejectPeriod: boolean
  periodStatus?: string
  currentProfessionReviewed: boolean
  canSubmitReview: boolean
  isSubmittingForReview: boolean
  filteredCount: number
  onApproveClick: () => void
  onRejectClick: () => void
  onToggleReviewed?: () => void
  onSubmitForReview?: () => Promise<void>
  onExportCsv: () => void
  onExportPdf: () => Promise<void>
  isPdfPending: boolean
}

export function PayrollDetailHeader({
  backHref,
  period,
  activeProfessionLabel,
  statusLabel,
  statusClassName,
  allowApprovalActions,
  approvalStatus,
  approvalLabel,
  canRejectPeriod,
  periodStatus,
  currentProfessionReviewed,
  canSubmitReview,
  isSubmittingForReview,
  filteredCount,
  onApproveClick,
  onRejectClick,
  onToggleReviewed,
  onSubmitForReview,
  onExportCsv,
  onExportPdf,
  isPdfPending,
}: PayrollDetailHeaderProps) {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="px-6 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Link href={backHref}>
              <Button variant="ghost" size="icon" className="-ml-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground md:text-2xl">
                  รอบจ่าย {formatPeriodLabel(period?.period_month ?? null, period?.period_year ?? null)}
                  {activeProfessionLabel ? (
                    <span className="font-normal text-muted-foreground"> / {activeProfessionLabel}</span>
                  ) : null}
                </h1>
                <Badge variant="outline" className={statusClassName}>
                  {statusLabel}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                สร้างโดย {period?.created_by_name ?? "-"} • {formatDate(period?.created_at ?? null)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {allowApprovalActions && period?.status === approvalStatus ? (
              <div className="flex gap-2">
                <Button
                  onClick={onApproveClick}
                  className="bg-emerald-600 shadow-sm hover:bg-emerald-700"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  อนุมัติ{approvalLabel}
                </Button>
                {canRejectPeriod && (
                  <Button
                    variant="destructive"
                    onClick={onRejectClick}
                    className="shadow-sm"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    ปฏิเสธ
                  </Button>
                )}
              </div>
            ) : (
              !allowApprovalActions &&
              onToggleReviewed && (
                <div className="flex gap-2">
                  {periodStatus !== "OPEN" ? (
                    <Button
                      variant="outline"
                      className="border-muted text-muted-foreground"
                      disabled
                      title="ส่งให้ HR แล้ว จึงไม่สามารถยืนยัน/แก้ไขสถานะการตรวจได้"
                    >
                      ยืนยันการตรวจ
                    </Button>
                  ) : (
                    <ConfirmActionDialog
                      trigger={
                        <Button
                          variant={currentProfessionReviewed ? "outline" : "default"}
                          className={
                            currentProfessionReviewed
                              ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                              : "bg-emerald-600 hover:bg-emerald-700"
                          }
                        >
                          {currentProfessionReviewed ? (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" /> ตรวจแล้ว
                            </>
                          ) : (
                            "ยืนยันการตรวจ"
                          )}
                        </Button>
                      }
                      title={currentProfessionReviewed ? "ยกเลิกสถานะตรวจแล้ว?" : "ยืนยันการตรวจวิชาชีพ?"}
                      description="ยืนยันสถานะการตรวจของวิชาชีพนี้"
                      cancelText={currentProfessionReviewed ? "ไม่ยกเลิก" : "ยกเลิก"}
                      confirmText={currentProfessionReviewed ? "ยืนยันยกเลิก" : "ยืนยัน"}
                      variant={currentProfessionReviewed ? "destructive" : "default"}
                      onConfirm={onToggleReviewed}
                    />
                  )}
                  {onSubmitForReview && (
                    <ConfirmActionDialog
                      trigger={
                        <Button
                          variant="secondary"
                          className="gap-2"
                          disabled={!canSubmitReview || isSubmittingForReview}
                        >
                          <Send className="h-4 w-4" />
                          ส่ง HR
                        </Button>
                      }
                      title="ยืนยันส่งให้ HR ตรวจสอบ"
                      description={<span>ระบบจะส่งผลการตรวจของรอบนี้ให้ HR (ต้องตรวจครบทุกวิชาชีพก่อน)</span>}
                      confirmText="ส่งให้ HR"
                      onConfirm={onSubmitForReview}
                      disabled={!canSubmitReview || isSubmittingForReview}
                    />
                  )}
                </div>
              )
            )}

            <div className="mx-1 hidden h-6 w-px bg-border md:block" />

            <div className="flex gap-1">
              <ConfirmActionDialog
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="ส่งออก CSV"
                    disabled={filteredCount === 0}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                }
                title="ยืนยันส่งออก CSV"
                description={
                  <span>
                    จะส่งออกรายการ <b>{formatThaiNumber(filteredCount)}</b> รายการ
                  </span>
                }
                confirmText="ส่งออก"
                onConfirm={onExportCsv}
                disabled={filteredCount === 0}
              />
              <ConfirmActionDialog
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="ส่งออก PDF"
                    disabled={isPdfPending}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                }
                title="ยืนยันดาวน์โหลดรายงาน PDF"
                description="ระบบจะดาวน์โหลดรายงานรอบจ่ายเงินเป็นไฟล์ PDF"
                confirmText="ดาวน์โหลด"
                onConfirm={onExportPdf}
                disabled={isPdfPending}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
