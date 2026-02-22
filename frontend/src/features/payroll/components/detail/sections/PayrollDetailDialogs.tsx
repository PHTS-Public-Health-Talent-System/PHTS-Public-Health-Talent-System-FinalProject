"use client"

import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { resolveProfessionLabel } from "@/shared/constants/profession"
import { formatThaiNumber } from "@/shared/utils/thai-locale"
import type { PayoutDetail } from "@/features/payroll/api"
import type { PayrollRow } from "../model/detail.types"
import { formatPeriodLabel } from "../model/detail.helpers"
import { PayrollChecksPanel } from "../checks/PayrollChecksPanel"

export function PayrollEditDialog({
  open,
  onOpenChange,
  editRow,
  editEligibleDays,
  setEditEligibleDays,
  editDeductedDays,
  setEditDeductedDays,
  editRetroactiveAmount,
  setEditRetroactiveAmount,
  editRemark,
  setEditRemark,
  periodMonth,
  periodYear,
  onSave,
  saving,
  canEditPayout,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editRow: PayrollRow | null
  editEligibleDays: string
  setEditEligibleDays: (value: string) => void
  editDeductedDays: string
  setEditDeductedDays: (value: string) => void
  editRetroactiveAmount: string
  setEditRetroactiveAmount: (value: string) => void
  editRemark: string
  setEditRemark: (value: string) => void
  periodMonth?: number | null
  periodYear?: number | null
  onSave: () => void
  saving: boolean
  canEditPayout: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>แก้ไขรายการจ่าย (งวดนี้)</DialogTitle>
          <DialogDescription>
            แก้ไขเฉพาะข้อมูลของงวดนี้เท่านั้น (การคำนวณใหม่อาจทับค่าที่แก้)
          </DialogDescription>
        </DialogHeader>

        {editRow ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-foreground">{editRow.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{editRow.citizenId}</div>
                </div>
                <Badge variant="outline">
                  {resolveProfessionLabel(editRow.professionCode, editRow.professionCode)}
                </Badge>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">วันมีสิทธิ (วัน)</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={editEligibleDays}
                  onChange={(e) => setEditEligibleDays(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">วันถูกหัก (วัน)</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={editDeductedDays}
                  onChange={(e) => setEditDeductedDays(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">ตกเบิก (บาท)</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={editRetroactiveAmount}
                  onChange={(e) => setEditRetroactiveAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">อัตราเงินที่ได้รับ</label>
                <Input value={formatThaiNumber(Number(editRow.baseRate ?? 0))} disabled />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/10 p-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">เงินงวดปัจจุบัน (ประมาณ)</span>
                  <span className="font-medium tabular-nums">
                    {(() => {
                      const month = Number(periodMonth ?? 0)
                      const rawYear = Number(periodYear ?? 0)
                      const year = rawYear > 2400 ? rawYear - 543 : rawYear
                      const daysInMonth = month > 0 ? new Date(year, month, 0).getDate() : 0
                      const eligibleDays = Number(editEligibleDays)
                      if (!Number.isFinite(daysInMonth) || daysInMonth <= 0) return "-"
                      if (!Number.isFinite(eligibleDays) || eligibleDays < 0) return "-"
                      const calc = (Number(editRow.baseRate ?? 0) / daysInMonth) * eligibleDays
                      return formatThaiNumber(calc, { maximumFractionDigits: 2 })
                    })()}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">ยอดหัก (ตามวันถูกหัก)</span>
                  <span className="font-medium tabular-nums text-orange-700">
                    {(() => {
                      const month = Number(periodMonth ?? 0)
                      const rawYear = Number(periodYear ?? 0)
                      const year = rawYear > 2400 ? rawYear - 543 : rawYear
                      const daysInMonth = month > 0 ? new Date(year, month, 0).getDate() : 0
                      const deductedDays = Number(editDeductedDays)
                      if (!Number.isFinite(daysInMonth) || daysInMonth <= 0) return "-0"
                      if (!Number.isFinite(deductedDays) || deductedDays < 0) return "-"
                      const amt = (Number(editRow.baseRate ?? 0) / daysInMonth) * deductedDays
                      return `-${formatThaiNumber(amt, { maximumFractionDigits: 2 })}`
                    })()}
                  </span>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                หมายเหตุ: ระบบใช้วันมีสิทธิเป็นจำนวนวันที่จ่ายจริง (หลังหักแล้ว) ส่วน “ยอดหัก” เป็นตัวช่วยให้เห็นผลกระทบจากวันถูกหัก
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">หมายเหตุ</label>
              <Textarea
                value={editRemark}
                onChange={(e) => setEditRemark(e.target.value)}
                placeholder="หมายเหตุ (ถ้ามี)"
                className="resize-none"
              />
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            ยกเลิก
          </Button>
          <Button
            onClick={onSave}
            disabled={!editRow || saving || !canEditPayout}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PayrollActionDialog({
  open,
  onClose,
  actionType,
  setComment,
  comment,
  approvalLabel,
  periodMonth,
  periodYear,
  totalHeadcount,
  totalAmount,
  onConfirm,
  isPending,
}: {
  open: boolean
  onClose: () => void
  actionType: "approve" | "reject" | null
  setComment: (value: string) => void
  comment: string
  approvalLabel: string
  periodMonth?: number | null
  periodYear?: number | null
  totalHeadcount?: number | null
  totalAmount?: number | null
  onConfirm: () => void
  isPending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>
            {actionType === "approve" && `อนุมัติรอบจ่ายเงิน (${approvalLabel})`}
            {actionType === "reject" && "ปฏิเสธรอบจ่ายเงิน"}
          </DialogTitle>
          <DialogDescription>
            รอบจ่ายเงิน {formatPeriodLabel(periodMonth ?? null, periodYear ?? null)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">จำนวนรายการ:</span>
                <p className="font-medium">{Number(totalHeadcount ?? 0)} คน</p>
              </div>
              <div>
                <span className="text-muted-foreground">ยอดรวม:</span>
                <p className="font-medium">{formatThaiNumber(Number(totalAmount ?? 0))} บาท</p>
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">
              {actionType === "approve" ? "หมายเหตุ (ไม่บังคับ)" : "เหตุผลที่ปฏิเสธ"}
            </label>
            <Textarea
              placeholder={
                actionType === "approve"
                  ? "ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
                  : "ระบุเหตุผลที่ปฏิเสธรอบจ่ายนี้"
              }
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-2 bg-secondary border-border"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className={actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive hover:bg-destructive/90"}
          >
            {actionType === "approve" && "อนุมัติ"}
            {actionType === "reject" && "ปฏิเสธ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PayrollChecksDialog({
  open,
  onOpenChange,
  selectedCheckRow,
  payoutDetailLoading,
  payoutDetailError,
  payoutDetail,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCheckRow: PayrollRow | null
  payoutDetailLoading: boolean
  payoutDetailError: boolean
  payoutDetail: PayoutDetail | undefined
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-card border-border sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-[hsl(var(--warning))]" />
            สิ่งที่ต้องตรวจสอบ
          </DialogTitle>
          <DialogDescription>
            {selectedCheckRow?.name ?? "-"} ({selectedCheckRow?.citizenId ?? "-"})
          </DialogDescription>
        </DialogHeader>

        {payoutDetailLoading ? (
          <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
            กำลังโหลดรายละเอียดการตรวจสอบ...
          </div>
        ) : payoutDetailError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            โหลดรายละเอียดการตรวจสอบไม่สำเร็จ
          </div>
        ) : (
          <PayrollChecksPanel
            fallbackRow={selectedCheckRow}
            payoutDetail={payoutDetail}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
