"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { 
  Plus, 
  Calendar, 
  Settings2, 
  FileText, 
  RefreshCw, 
  Send,
  MoreVertical,
  DollarSign,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock Data for display
const MOCK_PERIODS = [
  { period_id: 101, period_month: 2, period_year: 2024, status: 'OPEN', total_headcount: 145, total_amount: 450000, created_at: '2024-02-01' },
  { period_id: 100, period_month: 1, period_year: 2024, status: 'APPROVED_HR', total_headcount: 142, total_amount: 442500, created_at: '2024-01-01' },
  { period_id: 99, period_month: 12, period_year: 2023, status: 'CLOSED', total_headcount: 140, total_amount: 435000, created_at: '2023-12-01' },
  { period_id: 98, period_month: 11, period_year: 2023, status: 'CLOSED', total_headcount: 138, total_amount: 428000, created_at: '2023-11-01' },
];

export default function PayrollPeriodsPage() {
  const [periods] = useState(MOCK_PERIODS);
  
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));

  // Find the current open period
  const openPeriod = periods.find(p => p.status === 'OPEN');

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'OPEN': return <Badge className="bg-emerald-500 hover:bg-emerald-600">เปิดงวด</Badge>;
      case 'CLOSED': return <Badge variant="secondary">ปิดงวดแล้ว</Badge>;
      case 'APPROVED_HR': return <Badge variant="outline" className="border-blue-500 text-blue-500">รอการเงิน</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPeriodLabel = (m: number, y: number) => {
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            จัดการงวดการจ่าย
          </h2>
          <p className="text-slate-500 mt-1">
            สร้างและบริหารจัดการงวดเงินเดือน (Payroll Cycles)
          </p>
        </div>
      </div>

      {/* 1. Open Period Highlight */}
      {openPeriod && (
        <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm">
           <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                 <div>
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 mb-2">งวดปัจจุบัน</Badge>
                    <CardTitle className="text-2xl text-emerald-950">
                       {getPeriodLabel(openPeriod.period_month, openPeriod.period_year)}
                    </CardTitle>
                    <CardDescription className="text-emerald-700 mt-1">
                       สถานะ: กำลังดำเนินการ (Open)
                    </CardDescription>
                 </div>
                 <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200">
                    จัดการข้อมูล
                 </Button>
              </div>
           </CardHeader>
           <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                 <div className="bg-white p-4 rounded-lg border border-emerald-100 flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                       <Users className="h-6 w-6" />
                    </div>
                    <div>
                       <p className="text-sm text-slate-500">จำนวนบุคลากร</p>
                       <p className="text-2xl font-bold text-slate-900 font-numbers">{openPeriod.total_headcount}</p>
                    </div>
                 </div>
                 <div className="bg-white p-4 rounded-lg border border-emerald-100 flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                       <DollarSign className="h-6 w-6" />
                    </div>
                    <div>
                       <p className="text-sm text-slate-500">ยอดเงินรวมโดยประมาณ</p>
                       <p className="text-2xl font-bold text-slate-900 font-numbers">{openPeriod.total_amount.toLocaleString()}</p>
                    </div>
                 </div>
                 <div className="flex flex-col justify-center gap-2">
                    <Button variant="outline" className="w-full bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
                       <RefreshCw className="mr-2 h-4 w-4" /> คำนวณยอดใหม่
                    </Button>
                    <Button variant="outline" className="w-full bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
                       <Send className="mr-2 h-4 w-4" /> ปิดงวดและส่งต่อ HR
                    </Button>
                 </div>
              </div>
           </CardContent>
        </Card>
      )}

      <div className="grid gap-8 md:grid-cols-3">
        {/* Create Period Form */}
        <Card className="md:col-span-1 h-fit border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
                <Plus className="h-5 w-5 text-primary" /> สร้างงวดใหม่
            </CardTitle>
            <CardDescription>ระบุปีและเดือนเพื่อเริ่มงวดใหม่</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-slate-600">ปี (ค.ศ.)</Label>
                    <Input
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="font-mono text-center bg-slate-50 border-slate-200"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-slate-600">เดือน (1-12)</Label>
                    <Input
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="font-mono text-center bg-slate-50 border-slate-200"
                    />
                </div>
            </div>
            <Button className="w-full">
              ยืนยันการสร้างงวด
            </Button>
          </CardContent>
        </Card>

        {/* History Table */}
        <Card className="md:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
             <CardTitle className="flex items-center gap-2 text-slate-800">
                 <Calendar className="h-5 w-5 text-primary" /> ประวัติงวดทั้งหมด
             </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50">
                    <TableRow className="border-slate-100">
                        <TableHead className="w-[30%]">งวดเดือน/ปี</TableHead>
                        <TableHead className="w-[20%] text-center">สถานะ</TableHead>
                        <TableHead className="text-right w-[15%]">จำนวนคน</TableHead>
                        <TableHead className="text-right w-[25%]">ยอดรวม (บาท)</TableHead>
                        <TableHead className="w-[10%]" />
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {periods.map((period) => (
                        <TableRow key={period.period_id} className="hover:bg-slate-50 border-slate-100">
                        <TableCell className="font-medium text-slate-900">
                            <div className="flex flex-col">
                                <span>{getPeriodLabel(period.period_month, period.period_year)}</span>
                                <span className="text-xs text-slate-500 font-normal">สร้างเมื่อ {new Date(period.created_at).toLocaleDateString('th-TH')}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center">{getStatusBadge(period.status)}</TableCell>
                        <TableCell className="text-right font-numbers text-slate-700">{period.total_headcount}</TableCell>
                        <TableCell className="text-right font-numbers font-medium text-slate-900">{period.total_amount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>จัดการ</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>
                                        <Link href={`/dashboard/pts-officer/payroll/${period.period_id}`} className="flex items-center w-full">
                                           <Settings2 className="mr-2 h-4 w-4" /> รายละเอียด
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        <FileText className="mr-2 h-4 w-4" /> ดาวน์โหลดรายงาน
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                             </DropdownMenu>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}