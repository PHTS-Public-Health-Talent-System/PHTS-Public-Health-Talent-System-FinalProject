"use client";

import { Plus, Eye, Pencil, FileText, Search, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMyRequests } from "@/features/request/hooks";
import { StatusBadge } from "@/components/common/status-badge";
import { REQUEST_TYPE_LABELS, type RequestStatus } from "@/types/request.types";
import { useMemo, useState } from "react";

interface UserRequestsListClientProps {
  initialQuery?: string;
  initialStatus?: string;
}

export default function UserRequestsListClient({
  initialQuery = "",
  initialStatus = "ALL",
}: UserRequestsListClientProps) {
  const { data: requests, isLoading } = useMyRequests();
  const router = useRouter();
  const [search, setSearch] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "ALL">(
    (initialStatus as RequestStatus | "ALL") ?? "ALL",
  );

  const setQuery = (next: { q?: string; status?: string }) => {
    const params = new URLSearchParams();
    const nextQ = next.q !== undefined ? next.q : search;
    const nextStatus = next.status !== undefined ? next.status : statusFilter;

    if (nextQ) params.set("q", nextQ);
    if (nextStatus && nextStatus !== "ALL") params.set("status", nextStatus);

    const query = params.toString();
    router.replace(query ? `?${query}` : "/dashboard/user/requests");
  };

  const filtered = useMemo(() => {
    if (!requests) return [];
    const q = search.trim().toLowerCase();
    return requests.filter((req) => {
      const matchesStatus = statusFilter === "ALL" || req.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      const requestNo = req.request_no ?? "";
      return (
        requestNo.toLowerCase().includes(q) ||
        String(req.request_id).includes(q)
      );
    });
  }, [requests, search, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [filtered]);

  return (
    <div className="space-y-8 pb-10">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold text-slate-900">คำขอทั้งหมด</h1>
           <p className="text-slate-500 mt-1">ประวัติรายการยื่นคำขอรับเงิน พ.ต.ส.</p>
        </div>
        <Link href="/dashboard/user/request">
            <Button size="lg" className="h-12 px-6 rounded-xl shadow-md shadow-primary/20 hover:shadow-primary/30 w-full md:w-auto">
              <Plus className="mr-2 h-5 w-5" /> ยื่นคำขอใหม่
            </Button>
          </Link>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setQuery({ q: e.target.value });
              }}
              placeholder="ค้นหาเลขที่คำขอ..."
              className="pl-11 h-12 text-base border-slate-200 bg-slate-50 focus:bg-white"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val as RequestStatus | "ALL");
              setQuery({ status: val });
            }}
          >
            <SelectTrigger className="w-full sm:w-[220px] h-12 text-base border-slate-200 bg-slate-50">
              <SelectValue placeholder="สถานะทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ทั้งหมด</SelectItem>
              <SelectItem value="DRAFT">ฉบับร่าง</SelectItem>
              <SelectItem value="PENDING">รอดำเนินการ</SelectItem>
              <SelectItem value="APPROVED">อนุมัติแล้ว</SelectItem>
              <SelectItem value="REJECTED">ไม่อนุมัติ</SelectItem>
              <SelectItem value="RETURNED">ส่งกลับแก้ไข</SelectItem>
              <SelectItem value="CANCELLED">ยกเลิก</SelectItem>
            </SelectContent>
          </Select>
          {/* Reset Button (Optional) */}
          {(search || statusFilter !== "ALL") && (
             <Button variant="ghost" size="icon" className="h-12 w-12" onClick={() => { setSearch(""); setStatusFilter("ALL"); setQuery({ q: "", status: "ALL" }) }}>
                <FilterX className="h-5 w-5 text-slate-400" />
             </Button>
          )}
      </div>

      {/* Data Table / List */}
      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : !requests || requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="bg-slate-50 p-6 rounded-full mb-4">
                 <FileText className="h-12 w-12 text-slate-300" />
              </div>
              <p className="text-lg font-medium text-slate-600">ยังไม่มีประวัติคำขอ</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Search className="mx-auto h-12 w-12 mb-4 opacity-20" />
              <p className="text-lg text-slate-600">ไม่พบคำขอตามเงื่อนไขที่เลือก</p>
              <Button variant="link" onClick={() => { setSearch(""); setStatusFilter("ALL"); setQuery({ q: "", status: "ALL" }) }}>
                ล้างตัวกรอง
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="hover:bg-slate-50/80 border-slate-100">
                      <TableHead className="h-12 font-semibold text-slate-700 w-[15%]">เลขที่คำขอ</TableHead>
                      <TableHead className="h-12 font-semibold text-slate-700 w-[20%]">ประเภท</TableHead>
                      <TableHead className="h-12 font-semibold text-slate-700 w-[20%]">สถานะ</TableHead>
                      <TableHead className="h-12 font-semibold text-slate-700 text-right w-[15%]">จำนวนเงิน</TableHead>
                      <TableHead className="h-12 font-semibold text-slate-700 text-center w-[15%]">วันที่ยื่น</TableHead>
                      <TableHead className="h-12 font-semibold text-slate-700 text-right w-[15%]">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((req) => (
                      <TableRow key={req.request_id} className="h-16 hover:bg-slate-50 border-slate-100">
                        <TableCell className="font-medium text-slate-900 text-base">
                          {req.request_no ?? <span className="text-slate-400 italic">Draft</span>}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {REQUEST_TYPE_LABELS[req.request_type] ?? req.request_type}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={req.status} currentStep={req.current_step} />
                        </TableCell>
                        <TableCell className="text-right font-numbers text-base font-medium text-slate-900">
                          {req.requested_amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center text-slate-500 text-sm">
                          {new Date(req.created_at).toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "short",
                            year: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {(req.status === "DRAFT" || req.status === "RETURNED") ? (
                              <Link href={`/dashboard/user/requests/${req.request_id}/edit`}>
                                <Button variant="outline" size="icon" className="h-9 w-9 border-slate-200 text-amber-600 hover:bg-amber-50 hover:border-amber-200" title="แก้ไข">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </Link>
                            ) : null}
                            <Link href={`/dashboard/user/requests/${req.request_id}`}>
                              <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-primary hover:bg-blue-50" title="ดูรายละเอียด">
                                <Eye className="h-5 w-5" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View */}
              <div className="space-y-4 p-4 md:hidden bg-slate-50/30">
                {sorted.map((req) => (
                  <Link
                    key={req.request_id}
                    href={`/dashboard/user/requests/${req.request_id}`}
                    className="block"
                  >
                    <Card className="border-slate-200 shadow-sm active:scale-[0.99] transition-transform">
                       <CardContent className="p-5">
                          <div className="flex justify-between items-start mb-3">
                             <div className="flex flex-col">
                                <span className="font-bold text-lg text-slate-900">
                                   {req.request_no ?? "Draft"}
                                </span>
                                <span className="text-sm text-slate-500 mt-0.5">
                                   {new Date(req.created_at).toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                             </div>
                             <StatusBadge status={req.status} currentStep={req.current_step} />
                          </div>

                          <div className="h-px bg-slate-100 my-3" />

                          <div className="flex justify-between items-end">
                             <div className="text-sm text-slate-600">
                                {REQUEST_TYPE_LABELS[req.request_type]}
                             </div>
                             <div className="font-numbers text-xl font-semibold text-primary">
                                {req.requested_amount.toLocaleString()} <span className="text-sm font-sans font-normal text-slate-400">บาท</span>
                             </div>
                          </div>
                       </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
