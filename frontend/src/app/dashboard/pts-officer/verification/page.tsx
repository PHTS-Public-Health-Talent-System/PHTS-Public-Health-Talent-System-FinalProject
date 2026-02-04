"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { 
  Search, 
  Eye, 
  Filter, 
  CheckCircle2, 
} from "lucide-react";
import { toast } from "sonner";

import { usePendingApprovals, useApproveBatch } from "@/features/request/hooks";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PtsOfficerVerificationPage() {
  const { data: requests, isLoading, refetch } = usePendingApprovals();
  const approveBatch = useApproveBatch();

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Extract unique departments for filter
  const departments = useMemo(() => {
    if (!requests) return [];
    const depts = new Set(requests.map((r) => r.current_department).filter(Boolean));
    return Array.from(depts).sort();
  }, [requests]);

  // Filter and Sort Logic
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    
    return requests.filter((req) => {
      // 1. Search Text
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (req.request_no?.toLowerCase().includes(q) || false) ||
        (req.requester?.first_name?.toLowerCase().includes(q) || false) ||
        (req.requester?.last_name?.toLowerCase().includes(q) || false);

      // 2. Department Filter
      const matchesDept = deptFilter === "ALL" || req.current_department === deptFilter;

      return matchesSearch && matchesDept;
    }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); // Oldest first for verification?
  }, [requests, search, deptFilter]);

  // Selection Logic
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredRequests.map((r) => r.request_id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((prevId) => prevId !== id));
    }
  };

  const isAllSelected = filteredRequests.length > 0 && selectedIds.length === filteredRequests.length;

  // Batch Actions
  const handleBatchApprove = () => {
    if (selectedIds.length === 0) return;

    toast.promise(
      approveBatch.mutateAsync({ requestIds: selectedIds, comment: "Batch approved by PTS Officer" }),
      {
        loading: "กำลังบันทึกการอนุมัติ...",
        success: () => {
          setSelectedIds([]);
          refetch();
          return "อนุมัติรายการที่เลือกเรียบร้อยแล้ว";
        },
        error: "เกิดข้อผิดพลาดในการอนุมัติ",
      }
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            ตรวจสอบเอกสารคำขอ
          </h2>
          <p className="text-slate-500 mt-1">
            รายการคำขอที่รอการตรวจสอบความถูกต้องของเอกสารและคุณสมบัติ
          </p>
        </div>
      </div>

      {/* Filters & Actions Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
        <div className="flex flex-1 items-center gap-2">
           <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาเลขที่, ชื่อ, สกุล..."
                className="pl-9 bg-white"
              />
           </div>
           <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[180px] bg-white">
                <div className="flex items-center gap-2">
                   <Filter className="h-4 w-4 text-slate-400" />
                   <SelectValue placeholder="ทุกแผนก" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกแผนก</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept as string} value={dept as string}>
                    {dept as string}
                  </SelectItem>
                ))}
              </SelectContent>
           </Select>
        </div>
        
        {/* Selection Stats */}
        {selectedIds.length > 0 && (
           <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 font-medium bg-slate-100 px-3 py-1.5 rounded-full">
                 เลือกแล้ว {selectedIds.length} รายการ
              </span>
              <Button size="sm" variant="default" onClick={handleBatchApprove} disabled={approveBatch.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                 <CheckCircle2 className="mr-2 h-4 w-4" /> อนุมัติทั้งหมด
              </Button>
           </div>
        )}
      </div>

      {/* Data Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-slate-50 border-slate-100">
                <TableHead className="w-[50px] text-center">
                  <Checkbox 
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                    className="translate-y-[2px]"
                  />
                </TableHead>
                <TableHead className="w-[15%]">เลขที่คำขอ</TableHead>
                <TableHead className="w-[20%]">ผู้ยื่นคำขอ</TableHead>
                <TableHead className="w-[20%]">ตำแหน่ง/สังกัด</TableHead>
                <TableHead className="w-[15%] text-right">จำนวนเงิน</TableHead>
                <TableHead className="w-[15%] text-center">สถานะ</TableHead>
                <TableHead className="w-[15%] text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-12 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                       <Search className="h-8 w-8 opacity-20" />
                       <p>ไม่พบข้อมูลคำขอ</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((req) => (
                  <TableRow key={req.request_id} className="group hover:bg-slate-50 border-slate-100 transition-colors">
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={selectedIds.includes(req.request_id)}
                        onCheckedChange={(checked) => handleSelectOne(req.request_id, checked as boolean)}
                        aria-label={`Select request ${req.request_no}`}
                        className="translate-y-[2px]"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-slate-900">{req.request_no ?? "-"}</span>
                        <span className="text-xs text-slate-500">
                           {new Date(req.created_at).toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: '2-digit' })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                       <div className="font-medium text-slate-900">
                         {req.requester?.first_name} {req.requester?.last_name}
                       </div>
                       <div className="text-xs text-slate-500">{req.citizen_id}</div>
                    </TableCell>
                    <TableCell>
                       <div className="text-sm text-slate-700">{req.requester?.position ?? req.current_position_number ?? "-"}</div>
                       <div className="text-xs text-slate-500">{req.current_department}</div>
                    </TableCell>
                    <TableCell className="text-right font-numbers font-medium text-slate-900">
                       {req.requested_amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                       <StatusBadge status={req.status} currentStep={req.current_step} />
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end gap-1">
                          <Link href={`/dashboard/pts-officer/verification/${req.request_id}`}>
                             <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-500 hover:text-primary hover:bg-indigo-50">
                                <Eye className="mr-1.5 h-3.5 w-3.5" /> ตรวจสอบ
                             </Button>
                          </Link>
                       </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Floating Action Bar (Alternative placement) */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white backdrop-blur-sm px-6 py-3 rounded-full shadow-xl flex items-center gap-4 transition-all duration-300 z-50 ${selectedIds.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
          <div className="flex items-center gap-2 border-r border-white/20 pr-4">
             <CheckCircle2 className="h-5 w-5 text-emerald-400" />
             <span className="font-medium text-sm">{selectedIds.length} รายการที่เลือก</span>
          </div>
          <div className="flex items-center gap-2">
             <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 h-8" onClick={() => setSelectedIds([])}>
                ยกเลิก
             </Button>
             <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 border-0" onClick={handleBatchApprove} disabled={approveBatch.isPending}>
                อนุมัติทั้งหมด
             </Button>
          </div>
      </div>
    </div>
  );
}