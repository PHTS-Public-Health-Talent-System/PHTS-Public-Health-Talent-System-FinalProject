"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react"
import type { RequestWithDetails } from "@/types/request.types"
import { APPROVAL_STEPS } from "@/features/request/detail/requestDetail.approval"
import { formatThaiDateTime } from "@/features/request/detail/requestDetail.format"

export function ApprovalTimelineCard({ request }: { request: RequestWithDetails }) {
  const approvalActions = request.actions ?? []

  return (
    <Card className="shadow-sm border-border/60">
      <CardHeader className="pb-4 bg-muted/10">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          สถานะการดำเนินการ
        </CardTitle>
        <CardDescription>
          ขั้นตอนปัจจุบัน: {request.current_step ?? "-"}/{APPROVAL_STEPS.length}
        </CardDescription>
      </CardHeader>
      <CardContent className="relative">
        <div
          className="absolute left-[27px] top-6 bottom-6 w-0.5 bg-border/50"
          aria-hidden="true"
        />

        <div className="space-y-0">
          {APPROVAL_STEPS.map((step, index) => {
            const action = approvalActions
              .filter(
                (a) =>
                  a.step_no === step.step &&
                  (a.action === "APPROVE" || a.action === "REJECT" || a.action === "RETURN"),
              )
              .sort((a, b) => (a.action_date || "").localeCompare(b.action_date || ""))
              .pop()

            const status = action
              ? action.action === "APPROVE"
                ? "approved"
                : action.action === "REJECT"
                  ? "rejected"
                  : "returned"
              : request.current_step === step.step
                ? "pending"
                : request.current_step && step.step < request.current_step
                  ? "approved"
                  : "waiting"

            const isLast = index === APPROVAL_STEPS.length - 1

            return (
              <div key={step.step} className={`relative flex gap-4 pb-8 ${isLast ? "pb-0" : ""}`}>
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    status === "approved"
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : status === "pending"
                        ? "bg-white border-primary text-primary animate-pulse"
                        : status === "rejected"
                          ? "bg-red-500 border-red-500 text-white"
                          : status === "returned"
                            ? "bg-orange-500 border-orange-500 text-white"
                            : "bg-white border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {status === "approved" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : status === "rejected" ? (
                    <XCircle className="h-4 w-4" />
                  ) : status === "returned" ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : status === "pending" ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  ) : (
                    <span className="text-[10px]">{step.step}</span>
                  )}
                </div>

                <div className="flex-1 pt-0.5">
                  <p
                    className={`text-sm font-semibold ${
                      status === "waiting" ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {step.role}
                  </p>

                  {(action?.actor || status === "pending") && (
                    <div className="mt-1 flex flex-col gap-1">
                      {action?.actor && (
                        <span className="text-xs text-foreground/80">
                          โดย: {action.actor.first_name} {action.actor.last_name}
                        </span>
                      )}
                      {action?.action_date && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatThaiDateTime(action.action_date)}
                        </span>
                      )}
                      {status === "pending" && request.step_started_at && (
                        <span className="text-xs text-muted-foreground">
                          เริ่มเมื่อ: {formatThaiDateTime(request.step_started_at)}
                        </span>
                      )}
                    </div>
                  )}

                  {action?.comment && (
                    <div className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">หมายเหตุ</p>
                      <p className="mt-1 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {action.comment}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
