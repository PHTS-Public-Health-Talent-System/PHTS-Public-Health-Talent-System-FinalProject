"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApproveByHR, useDownloadPeriodReport, usePeriodDetail, usePeriodPayouts, usePeriodSummaryByProfession, useRejectPeriod } from "@/features/payroll/hooks";
import { useEntityAuditTrail } from "@/features/audit/hooks";
import { getPeriodStatusLabel, toPeriodLabel } from "@/features/payroll/period-utils";
import type { PayPeriod, PeriodPayoutRow, PeriodSummaryRow } from "@/features/payroll/api";

type AuditEvent = {
  audit_id: number;
  created_at?: string | null;
  event_type?: string | null;
  actor_name?: string | null;
  actor_id?: number | null;
  actor_role?: string | null;
  action_detail?: unknown;
};

export default function HrPayrollDetailPage() {
  const params = useParams();
  const periodId = Number(params.periodId);
  const detail = usePeriodDetail(periodId);
  const payouts = usePeriodPayouts(periodId);
  const summary = usePeriodSummaryByProfession(periodId);
  const approve = useApproveByHR();
  const reject = useRejectPeriod();
  const downloadReport = useDownloadPeriodReport();
  const auditTrail = useEntityAuditTrail("period", periodId);
  const [rejectReason, setRejectReason] = useState("");

  const period = detail.data?.period as PayPeriod | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">งวด</div>
          <div className="text-2xl font-semibold">{period ? toPeriodLabel(period) : "-"}</div>
          <div className="text-sm text-muted-foreground">{period ? getPeriodStatusLabel(period.status) : ""}</div>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/head-hr/payroll-check">ย้อนกลับ</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>อนุมัติงวด</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={() => approve.mutate(periodId)} disabled={approve.isPending}>
            {approve.isPending ? "กำลังอนุมัติ..." : "อนุมัติ"}
          </Button>
          <div>
            {period?.status !== "CLOSED" && (
              <div className="text-xs text-muted-foreground mb-1">
                ดาวน์โหลดได้เฉพาะงวดที่ปิดแล้ว
              </div>
            )}
            <Button
              variant="outline"
              onClick={async () => {
                const blob = await downloadReport.mutateAsync(periodId);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `period-${periodId}-report.pdf`;
                a.click();
                window.URL.revokeObjectURL(url);
              }}
              disabled={downloadReport.isPending || period?.status !== "CLOSED"}
            >
              ดาวน์โหลด PDF
            </Button>
          </div>
          <input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="ระบุเหตุผลการตีกลับ"
            className="h-9 w-72 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button
            variant="destructive"
            onClick={() => reject.mutate({ periodId, payload: { reason: rejectReason } })}
            disabled={reject.isPending || !rejectReason.trim()}
          >
            {reject.isPending ? "กำลังตีกลับ..." : "ตีกลับ"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>สรุปตามวิชาชีพ</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ตำแหน่ง</TableHead>
                <TableHead className="text-right">จำนวนคน</TableHead>
                <TableHead className="text-right">ยอดรวม</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(summary.data ?? []).map((row: PeriodSummaryRow) => (
                <TableRow key={row.position_name}>
                  <TableCell>{row.position_name}</TableCell>
                  <TableCell className="text-right">{Number(row.headcount)}</TableCell>
                  <TableCell className="text-right">{Number(row.total_payable).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {(summary.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    ยังไม่มีข้อมูลสรุป
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายการจ่ายเงิน</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>ตำแหน่ง</TableHead>
                <TableHead className="text-right">วันสิทธิ</TableHead>
                <TableHead className="text-right">วันหัก</TableHead>
                <TableHead className="text-right">อัตรา</TableHead>
                <TableHead className="text-right">ยอดรวม</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payouts.data ?? []).map((row: PeriodPayoutRow) => (
                <TableRow key={row.payout_id}>
                  <TableCell>
                    {row.first_name ?? ""} {row.last_name ?? ""}
                  </TableCell>
                  <TableCell>{row.position_name ?? "-"}</TableCell>
                  <TableCell className="text-right">{row.eligible_days ?? 0}</TableCell>
                  <TableCell className="text-right">{row.deducted_days ?? 0}</TableCell>
                  <TableCell className="text-right">{Number(row.rate ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{Number(row.total_payable ?? 0).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {(payouts.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    ยังไม่มีรายการ
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          {auditTrail.isLoading ? (
            <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เวลา</TableHead>
                  <TableHead>เหตุการณ์</TableHead>
                  <TableHead>ผู้ทำรายการ</TableHead>
                  <TableHead>บทบาท</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((auditTrail.data ?? []) as AuditEvent[]).map((event) => (
                  <TableRow key={event.audit_id}>
                    <TableCell>
                      {event.created_at ? new Date(event.created_at).toLocaleString() : "-"}
                    </TableCell>
                    <TableCell>{event.event_type ?? "-"}</TableCell>
                    <TableCell>{event.actor_name ?? event.actor_id ?? "-"}</TableCell>
                    <TableCell>{event.actor_role ?? "-"}</TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      {event.action_detail ? JSON.stringify(event.action_detail) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {(auditTrail.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      ยังไม่มีข้อมูล
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
