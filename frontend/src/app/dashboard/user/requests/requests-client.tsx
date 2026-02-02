"use client";

import { Plus, Eye, Pencil, FileText, Search } from "lucide-react";
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">คำขอทั้งหมด</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setQuery({ q: e.target.value });
              }}
              placeholder="ค้นหาเลขที่คำขอ"
              className="pl-9 w-full sm:w-64"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val as RequestStatus | "ALL");
              setQuery({ status: val });
            }}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="สถานะ" />
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
          <Link href="/dashboard/user/request">
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> ยื่นคำขอใหม่
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">รายการคำขอ</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !requests || requests.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <FileText className="mx-auto h-10 w-10 mb-2 opacity-40" />
              <p>ยังไม่มีคำขอ</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <FileText className="mx-auto h-10 w-10 mb-2 opacity-40" />
              <p>ไม่พบคำขอตามเงื่อนไขที่เลือก</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เลขที่คำขอ</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">จำนวนเงิน</TableHead>
                      <TableHead>วันที่ยื่น</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((req) => (
                      <TableRow key={req.request_id}>
                        <TableCell className="font-medium">
                          {req.request_no ?? `#${req.request_id}`}
                        </TableCell>
                        <TableCell>
                          {REQUEST_TYPE_LABELS[req.request_type] ?? req.request_type}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={req.status} currentStep={req.current_step} />
                        </TableCell>
                        <TableCell className="text-right">
                          {req.requested_amount.toLocaleString()} บาท
                        </TableCell>
                        <TableCell>
                          {new Date(req.created_at).toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Link href={`/dashboard/user/requests/${req.request_id}`}>
                              <Button variant="ghost" size="icon" title="ดูรายละเอียด">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {(req.status === "DRAFT" || req.status === "RETURNED") && (
                              <Link href={`/dashboard/user/requests/${req.request_id}/edit`}>
                                <Button variant="ghost" size="icon" title="แก้ไข">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="space-y-3 md:hidden">
                {sorted.map((req) => (
                  <Link
                    key={req.request_id}
                    href={`/dashboard/user/requests/${req.request_id}`}
                  >
                    <Card className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">
                          {req.request_no ?? `#${req.request_id}`}
                        </span>
                        <StatusBadge status={req.status} currentStep={req.current_step} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {REQUEST_TYPE_LABELS[req.request_type] ?? req.request_type}
                      </p>
                      <div className="flex justify-between items-end mt-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString("th-TH")}
                        </span>
                        <span className="font-semibold text-primary">
                          {req.requested_amount.toLocaleString()} บาท
                        </span>
                      </div>
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
