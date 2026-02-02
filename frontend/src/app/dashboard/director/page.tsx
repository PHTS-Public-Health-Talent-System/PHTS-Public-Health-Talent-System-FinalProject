"use client";

import Link from "next/link";
import {
  FileCheck,
  History,
  FileBarChart,
  CheckCircle2,
  Clock,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePeriods } from "@/features/payroll/hooks";
import type { PayPeriod } from "@/features/payroll/api";

export default function DirectorDashboardPage() {
  const periods = usePeriods();
  const periodRows = (periods.data as PayPeriod[] | undefined) ?? [];

  const waitingDirector = periodRows.filter((p) => p.status === "WAITING_DIRECTOR").length;
  const closed = periodRows.filter((p) => p.status === "CLOSED").length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">แดชบอร์ดผู้บริหาร</h1>
        <p className="text-muted-foreground">ภาพรวมสถานะการเบิกจ่ายและการอนุมัติ</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">งวดรออนุมัติ (ผอ.)</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{waitingDirector}</div>
            <p className="text-xs text-muted-foreground mt-1">งวดที่รอการตรวจสอบและลงนามอนุมัติ</p>
            {waitingDirector > 0 && (
                <div className="mt-4">
                    <Button asChild size="sm" className="w-full sm:w-auto shadow-none">
                        <Link href="/dashboard/director/approvals">
                            ตรวจสอบงวด <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">งวดที่ปิดแล้ว</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{closed}</div>
            <p className="text-xs text-muted-foreground mt-1">งวดการจ่ายที่ดำเนินการเสร็จสิ้นแล้วทั้งหมด</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="h-6 w-1 bg-secondary rounded-full"></span>
            เมนูดำเนินการด่วน
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/dashboard/director/requests" className="group">
                <Card className="h-full hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                    <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                        <div className="p-3 bg-primary/10 rounded-full text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                             <FileCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="font-semibold group-hover:text-primary">คำขอรออนุมัติ</h4>
                            <p className="text-xs text-muted-foreground mt-1">ตรวจสอบและอนุมัติคำขอรายบุคคล</p>
                        </div>
                    </CardContent>
                </Card>
            </Link>

            <Link href="/dashboard/director/approvals" className="group">
                <Card className="h-full hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                    <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                        <div className="p-3 bg-primary/10 rounded-full text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                             <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="font-semibold group-hover:text-primary">อนุมัติการเบิกจ่าย</h4>
                            <p className="text-xs text-muted-foreground mt-1">อนุมัติงวดการเบิกจ่าย (Batch)</p>
                        </div>
                    </CardContent>
                </Card>
            </Link>

            <Link href="/dashboard/director/history" className="group">
                <Card className="h-full hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                    <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                        <div className="p-3 bg-primary/10 rounded-full text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                             <History className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="font-semibold group-hover:text-primary">ประวัติย้อนหลัง</h4>
                            <p className="text-xs text-muted-foreground mt-1">ค้นหาและตรวจสอบประวัติการอนุมัติ</p>
                        </div>
                    </CardContent>
                </Card>
            </Link>

            <Link href="/dashboard/director/reports" className="group">
                <Card className="h-full hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                    <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                        <div className="p-3 bg-primary/10 rounded-full text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                             <FileBarChart className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="font-semibold group-hover:text-primary">รายงาน</h4>
                            <p className="text-xs text-muted-foreground mt-1">ดาวน์โหลดรายงานสรุปผลการดำเนินงาน</p>
                        </div>
                    </CardContent>
                </Card>
            </Link>
        </div>
      </div>
    </div>
  );
}
