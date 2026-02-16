"use client"

import type React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { PayoutDetail } from "@/features/payroll/api"
import { formatThaiDate, formatThaiNumber } from "@/shared/utils/thai-locale"
import { issueBadgeClass } from "./payrollDetail.helpers"
import type { PayrollRow } from "./payrollDetail.types"
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Calendar,
  Calculator,
  FileText,
  List,
  XCircle,
} from "lucide-react"

export function PayrollChecksPanel({
  payoutDetail,
  fallbackRow,
}: {
  payoutDetail: PayoutDetail | undefined
  fallbackRow: PayrollRow | null
}) {
  const payout = payoutDetail?.payout
  const checks = payoutDetail?.checks ?? []
  const items = payoutDetail?.items ?? []

  const blockers = checks.filter((check) => check.severity === "BLOCKER")
  const warnings = checks.filter((check) => check.severity !== "BLOCKER")
  const fallbackIssues = fallbackRow?.issues ?? []

  const month = Number(payout?.period_month ?? 0)
  const rawYear = Number(payout?.period_year ?? 0)
  const yearAd = rawYear > 2400 ? rawYear - 543 : rawYear
  const daysInMonth = month > 0 && yearAd > 0 ? new Date(yearAd, month, 0).getDate() : 0

  const baseRate = Number(payout?.pts_rate_snapshot ?? fallbackRow?.baseRate ?? 0)
  const eligibleDays = Number(payout?.eligible_days ?? fallbackRow?.workDays ?? 0)
  const deductedDays = Number(payout?.deducted_days ?? fallbackRow?.leaveDays ?? 0)
  const calculatedAmount = Number(payout?.calculated_amount ?? 0)

  const retro = Number(payout?.retroactive_amount ?? fallbackRow?.retroactiveAmount ?? 0)
  const dailyRate = daysInMonth > 0 ? baseRate / daysInMonth : 0
  const deductedAmount = dailyRate > 0 ? dailyRate * deductedDays : 0
  const otherLossRaw = baseRate - calculatedAmount - deductedAmount
  const otherLoss = Number.isFinite(otherLossRaw) && otherLossRaw > 0 ? otherLossRaw : 0

  return (
    <div className="space-y-6 p-1">
      {(checks.length > 0 || fallbackIssues.length > 0) && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertCircle className="h-4 w-4 text-primary" />
            ประเด็นที่พบ ({checks.length || fallbackIssues.length})
          </h3>

          {checks.length > 0 ? (
            <div className="grid gap-3">
              {blockers.map((check) => (
                <div
                  key={check.check_id}
                  className="rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                >
                  <div className="flex items-start gap-3">
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <div className="w-full space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-destructive">{check.title}</p>
                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                          ต้องหยุดจ่าย
                        </Badge>
                      </div>
                      {check.summary ? (
                        <p className="text-xs text-destructive/80">
                          <SummaryWithBoldMoney summary={check.summary} />
                        </p>
                      ) : null}

                      {Array.isArray(check.evidence) && check.evidence.length > 0 && (
                        <div className="mt-3 overflow-hidden rounded-md border border-destructive/10 bg-background/40">
                          <div className="divide-y divide-destructive/10 px-3 text-xs">
                            {check.evidence.slice(0, 12).map((ev, idx) => (
                              <EvidenceBlock key={idx} evidence={ev} variant="danger" />
                            ))}
                          </div>
                          {check.evidence.length > 12 ? (
                            <div className="border-t border-destructive/10 px-3 py-2 text-xs text-muted-foreground">
                              และอีก {check.evidence.length - 12} รายการ
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {warnings.map((check) => (
                <div key={check.check_id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div className="w-full space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-amber-700">{check.title}</p>
                        <Badge
                          variant="secondary"
                          className="h-5 border-amber-200 bg-amber-100 px-1.5 text-[10px] text-amber-700"
                        >
                          ควรตรวจสอบ
                        </Badge>
                      </div>
                      {check.summary ? (
                        <p className="text-xs text-amber-700/80">
                          <SummaryWithBoldMoney summary={check.summary} />
                        </p>
                      ) : null}

                      {Array.isArray(check.evidence) && check.evidence.length > 0 && (
                        <div className="mt-3 overflow-hidden rounded-md border border-amber-200/50 bg-background/40">
                          <div className="divide-y divide-amber-200/40 px-3 text-xs">
                            {check.evidence.slice(0, 12).map((ev, idx) => (
                              <EvidenceBlock key={idx} evidence={ev} variant="warning" />
                            ))}
                          </div>
                          {check.evidence.length > 12 ? (
                            <div className="border-t border-amber-200/40 px-3 py-2 text-xs text-muted-foreground">
                              และอีก {check.evidence.length - 12} รายการ
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-2">
              {fallbackIssues.map((issue) => (
                <div
                  key={issue.key}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-secondary/10 p-3"
                >
                  <span className="text-sm font-medium">{issue.label}</span>
                  <Badge variant="outline" className={issueBadgeClass(issue.key)}>
                    {issue.level}
                  </Badge>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                หมายเหตุ: ชุดข้อมูล checks แบบมีหลักฐานยังไม่มีสำหรับรายการนี้ (อาจเป็นข้อมูลคำนวณก่อนระบบ checks)
              </p>
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Calculator className="h-4 w-4 text-primary" />
          รายละเอียดการคำนวณ
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground">
              <FileText className="h-3 w-3" /> ข้อมูลสิทธิ
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">อัตราเงิน</span>
                <span className="font-medium">
                  {formatThaiNumber(baseRate)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">วันมีสิทธิ</span>
                <span className="font-medium">
                  {formatThaiNumber(eligibleDays)} วัน
                </span>
              </div>
              <div className="flex justify-between text-sm text-orange-600/80">
                <span>วันถูกหัก</span>
                <span className="font-medium">
                  -{formatThaiNumber(deductedDays)} วัน
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-secondary/10 p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground">
              <Banknote className="h-3 w-3" /> สรุปยอดเงิน
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">เงินงวดปัจจุบัน</span>
                <span className="font-medium">
                  {formatThaiNumber(calculatedAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ถูกหัก (ตามวันถูกหัก)</span>
                <span className={cn("font-medium tabular-nums", deductedAmount > 0 ? "text-orange-700" : "text-muted-foreground")}>
                  -{formatThaiNumber(deductedAmount, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ขาดสิทธิ/ไม่ครอบคลุมงวด</span>
                <span className={cn("font-medium tabular-nums", otherLoss > 0 ? "text-orange-700" : "text-muted-foreground")}>
                  -{formatThaiNumber(otherLoss, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ตกเบิก</span>
                <span
                  className={cn(
                    "font-medium",
                    retro > 0 ? "text-blue-600" : retro < 0 ? "text-orange-600" : "text-muted-foreground",
                  )}
                >
                  {retro > 0 ? "+" : ""}
                  {formatThaiNumber(retro)}
                </span>
              </div>
              <div className="flex items-end justify-between border-t pt-2">
                <span className="text-sm font-semibold">รวมจ่ายสุทธิ</span>
                <span className="text-lg font-bold text-emerald-600">
                  {formatThaiNumber(Number(payout?.total_payable ?? 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {items.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <List className="h-4 w-4 text-primary" />
            รายการ
          </h3>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-3 font-medium text-muted-foreground">รายการ</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.item_id}>
                    <td className="p-3">
                      <p className="font-medium">{item.description ?? "-"}</p>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {Number(item.reference_month ?? 0) === 0 && Number(item.reference_year ?? 0) === 0
                          ? "แก้ไขด้วยมือ"
                          : `อ้างอิง ${item.reference_month}/${item.reference_year}`}
                        {item.item_type !== "CURRENT" ? (
                          <Badge variant="outline" className="ml-2 h-4 text-[10px]">
                            {item.item_type === "RETROACTIVE_ADD"
                              ? "ตกเบิก (เพิ่ม)"
                              : item.item_type === "RETROACTIVE_DEDUCT"
                                ? "ตกเบิก (หัก)"
                                : item.item_type}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {(() => {
                        const amount = Number(item.amount ?? 0)
                        if (!Number.isFinite(amount)) return "-"
                        if (item.item_type === "RETROACTIVE_DEDUCT") {
                          return (
                            <span className="font-medium text-orange-700">
                              -{formatThaiNumber(amount)}
                            </span>
                          )
                        }
                        if (item.item_type === "RETROACTIVE_ADD") {
                          return (
                            <span className="font-medium text-blue-600">
                              +{formatThaiNumber(amount)}
                            </span>
                          )
                        }
                        return formatThaiNumber(amount)
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(payout?.remark || fallbackRow?.note) ? (
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          <span className="mr-2 font-semibold">หมายเหตุระบบ:</span>
          {payout?.remark ?? fallbackRow?.note}
        </div>
      ) : null}
    </div>
  )
}

function SummaryWithBoldMoney({ summary }: { summary: string }) {
  // Bold only money numbers (keep "บาท" normal) so users can spot impact quickly.
  const re = /([+-]?\d[\d,]*(?:\.\d+)?)(\s*บาท)/g
  const parts: React.ReactNode[] = []
  let last = 0
  for (const match of summary.matchAll(re)) {
    const idx = match.index ?? 0
    if (idx > last) parts.push(summary.slice(last, idx))
    const amount = match[1] ?? ""
    const unit = match[2] ?? " บาท"
    parts.push(
      <span key={`${idx}-${amount}`}>
        <span className="font-semibold tabular-nums">{amount}</span>
        {unit}
      </span>,
    )
    last = idx + match[0].length
  }
  if (last < summary.length) parts.push(summary.slice(last))
  return <>{parts.length ? parts : summary}</>
}

function EvidenceBlock({
  evidence,
  variant,
}: {
  evidence: unknown
  variant: "danger" | "warning"
}) {
  return (
    <div
      className={cn(
        "py-3 text-muted-foreground",
        variant === "danger" ? "border-l-2 border-l-destructive/50 pl-3" : "border-l-2 border-l-amber-400/60 pl-3",
      )}
    >
      <EvidenceLine evidence={evidence} />
    </div>
  )
}

type EvidenceGridItem = {
  label: string
  value: React.ReactNode
  align?: "left" | "right"
}

function EvidenceGrid({ label, items }: { label: string; items: EvidenceGridItem[] }) {
  const filtered = items.filter(Boolean) as EvidenceGridItem[]
  if (!label && filtered.length === 0) return null
  return (
    <div className="space-y-2">
      {label ? (
        <div className="text-sm font-semibold text-foreground">{label}</div>
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {filtered.map((item, idx) => (
          <div
            key={`${label}-${idx}-${item.label}`}
            className="flex items-baseline justify-between gap-3 rounded-md border border-border/60 bg-background/60 px-3 py-2"
          >
            <span className="text-xs text-muted-foreground">{item.label}</span>
            <span
              className={cn(
                "text-sm font-medium text-foreground",
                item.align === "right" ? "text-right" : "text-left",
              )}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EvidenceLine({ evidence }: { evidence: unknown }) {
  if (!evidence || typeof evidence !== "object") return <span>{String(evidence)}</span>
  const ev = evidence as Record<string, unknown>
  const type = String(ev.type ?? "")

  const formatThaiShortDate = (value: unknown) => {
    const raw = typeof value === "string" ? value : ""
    const ymd = raw.length >= 10 ? raw.slice(0, 10) : ""
    if (!ymd) return "-"
    return formatThaiDate(`${ymd}T00:00:00`)
  }

  const leaveTypeLabel = (leaveType: string) => {
    switch (leaveType) {
      case "sick":
        return "ลาป่วย"
      case "personal":
        return "ลากิจส่วนตัว"
      case "vacation":
        return "ลาพักผ่อน"
      case "wife_help":
        return "ลาช่วยภริยาคลอด"
      case "maternity":
        return "ลาคลอดบุตร"
      case "ordain":
        return "ลาอุปสมบท"
      case "military":
        return "ลาเกณฑ์ทหาร"
      case "education":
        return "ลาศึกษา/อบรม"
      case "rehab":
        return "ลาฟื้นฟูสมรรถภาพ"
      default:
        return leaveType ? `ลา (${leaveType})` : "ลา"
    }
  }

  const quotaUnitLabel = (unit: string) => {
    if (unit === "business_days") return "วันทำการ"
    if (unit === "calendar_days") return "วันปฏิทิน"
    return unit || "-"
  }

  const toNumber = (value: unknown, fallback = 0) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }

  if (type === "eligibility") {
    return (
      <EvidenceGrid
        label="สิทธิ/อัตรา"
        items={[
          {
            label: "อัตราเงิน",
            value: <span className="tabular-nums">{formatThaiNumber(toNumber(ev.rate))} บาท</span>,
            align: "right",
          },
          { label: "มีผล", value: formatThaiShortDate(ev.effective_date) },
          ...(ev.expiry_date ? [{ label: "หมดอายุ", value: formatThaiShortDate(ev.expiry_date) }] : []),
        ]}
      />
    )
  }
  if (type === "eligibility_gap") {
    const missing = Array.isArray(ev.missing_ranges)
      ? (ev.missing_ranges as Array<Record<string, unknown>>)
      : []

    if (missing.length === 0) {
      return (
        <EvidenceGrid
          label="ช่องว่างสิทธิ"
          items={[
            {
              label: "ช่วงงาน",
              value: `${formatThaiShortDate(ev.work_start_date)} ถึง ${formatThaiShortDate(ev.work_end_date)}`,
            },
            { label: "ช่วงที่ไม่มีสิทธิ", value: "-", align: "right" },
          ]}
        />
      )
    }

    return (
      <div className="space-y-1">
        {missing.map((range, idx) => (
          <EvidenceGrid
            key={`gap-${idx}`}
            label={idx === 0 ? "ช่องว่างสิทธิ" : ""}
            items={[
              {
                label: "ช่วงงาน",
                value: `${formatThaiShortDate(ev.work_start_date)} ถึง ${formatThaiShortDate(ev.work_end_date)}`,
              },
              {
                label: "ช่วงที่ไม่มีสิทธิ",
                value: `${formatThaiShortDate(range?.start)} ถึง ${formatThaiShortDate(range?.end)}`,
                align: "right",
              },
            ]}
          />
        ))}
      </div>
    )
  }
  if (type === "leave") {
    const quotaLimitRaw = ev.quota_limit
    const quotaLimit = quotaLimitRaw === null || quotaLimitRaw === undefined ? null : Number(quotaLimitRaw)
    const leaveDurationRaw = ev.leave_duration
    const leaveDuration = leaveDurationRaw === null || leaveDurationRaw === undefined ? null : Number(leaveDurationRaw)
    const unit = String(ev.quota_unit ?? "")
    const leaveType = String(ev.leave_type ?? "")
    const start = formatThaiShortDate(ev.start_date)
    const end = formatThaiShortDate(ev.end_date)
    const exceed = ev.exceed_date ? formatThaiShortDate(ev.exceed_date) : null

    const overQuota = Boolean(ev.over_quota)
    const isNoPay = Boolean(ev.is_no_pay)
    const statusLabel = isNoPay ? "no-pay (ไม่รับเงินเดือน)" : overQuota ? "ลาเกินโควตา" : "ลา"
    return (
      <EvidenceGrid
        label={`การลา (${leaveTypeLabel(leaveType)})`}
        items={[
          { label: "รายการ", value: `#${String(ev.leave_record_id ?? "-")}` },
          { label: "ช่วงวันที่", value: `${start} - ${end}` },
          { label: "สถานะ", value: statusLabel, align: "right" },
          ...(overQuota ? [{ label: "เกินตั้งแต่", value: exceed ?? "-" }] : []),
          ...(overQuota && quotaLimit !== null && Number.isFinite(quotaLimit)
            ? [{ label: "โควตา", value: `${formatThaiNumber(quotaLimit)} ${quotaUnitLabel(unit)}`, align: "right" as const }]
            : []),
          ...(overQuota && leaveDuration !== null && Number.isFinite(leaveDuration)
            ? [{ label: "จำนวนวันลา (ครั้งนี้)", value: `${formatThaiNumber(leaveDuration)} วัน` }]
            : []),
        ]}
      />
    )
  }
  if (type === "license") {
    return (
      <EvidenceGrid
        label="ใบอนุญาต"
        items={[
          { label: "สถานะ", value: String(ev.status ?? "-"), align: "right" },
          { label: "มีผล", value: formatThaiShortDate(ev.valid_from) },
          { label: "หมดอายุ", value: formatThaiShortDate(ev.valid_until), align: "right" },
        ]}
      />
    )
  }
  if (type === "movement") {
    return (
      <EvidenceGrid
        label="สถานะบุคลากร"
        items={[
          { label: "รายการ", value: String(ev.movement_type ?? "-") },
          { label: "มีผล", value: formatThaiShortDate(ev.effective_date), align: "right" },
        ]}
      />
    )
  }
  if (type === "retro") {
    const diff = Number(ev.diff ?? 0)
    const ref = `${String(ev.reference_month ?? "-")}/${String(ev.reference_year ?? "-")}`
    return (
      <EvidenceGrid
        label="ตกเบิกย้อนหลัง"
        items={[
          { label: "อ้างอิง", value: ref },
          {
            label: "ส่วนต่าง",
            value: (
              <span className={cn("tabular-nums", diff < 0 ? "text-orange-600" : "text-blue-600")}>
                {diff >= 0 ? "+" : ""}
                {formatThaiNumber(diff)} บาท
              </span>
            ),
            align: "right",
          },
          ...(ev.remark ? [{ label: "หมายเหตุ", value: String(ev.remark ?? "") }] : []),
        ]}
      />
    )
  }

  // Fallback
  return (
    <div className="text-[11px] text-muted-foreground">
      {JSON.stringify(ev)}
    </div>
  )
}
