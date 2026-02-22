"use client"

import type React from "react"
import { cn } from "@/lib/utils"
import { formatThaiNumber } from "@/shared/utils/thai-locale"
import {
  formatThaiShortDate,
  leaveTypeLabel,
  quotaUnitLabel,
  toNumber,
} from "./checks.helpers"

export function SummaryWithBoldMoney({ summary }: { summary: string }) {
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

export function EvidenceBlock({
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
        variant === "danger"
          ? "border-l-2 border-l-destructive/50 pl-3"
          : "border-l-2 border-l-amber-400/60 pl-3",
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
      {label ? <div className="text-sm font-semibold text-foreground">{label}</div> : null}
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
    const returnReportStatus = String(ev.return_report_status ?? "").trim()
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
          ...(returnReportStatus
            ? [{ label: "รายงานตัวกลับ", value: returnReportStatus, align: "right" as const }]
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

  return <div className="text-[11px] text-muted-foreground">{JSON.stringify(ev)}</div>
}
