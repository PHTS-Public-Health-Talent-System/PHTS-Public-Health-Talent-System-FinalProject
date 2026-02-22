"use client"

import { AlertCircle, AlertTriangle, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { PayoutDetail } from "@/features/payroll/api"
import { issueBadgeClass } from "../model/detail.helpers"
import type { PayrollRow } from "../model/detail.types"
import { EvidenceBlock, SummaryWithBoldMoney } from "./ChecksEvidence"

type ChecksIssuesSectionProps = {
  checks: PayoutDetail["checks"]
  fallbackIssues: PayrollRow["issues"]
}

export function ChecksIssuesSection({
  checks,
  fallbackIssues,
}: ChecksIssuesSectionProps) {
  if (checks.length === 0 && fallbackIssues.length === 0) return null

  const blockers = checks.filter((check) => check.severity === "BLOCKER")
  const warnings = checks.filter((check) => check.severity !== "BLOCKER")

  return (
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
  )
}
