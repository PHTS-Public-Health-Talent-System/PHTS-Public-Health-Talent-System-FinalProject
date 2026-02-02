"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, Eye } from "lucide-react"

import { useApprovalHistory } from "@/features/request/hooks"
import { sortRequestsByCreatedAtDesc } from "@/features/request/history-utils"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { STEP_LABELS } from "@/types/request.types"

export default function ApproverHistoryPage() {
  const { data: requests, isLoading } = useApprovalHistory()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [stepFilter, setStepFilter] = useState("ALL")

  const filtered = useMemo(() => {
    if (!requests) return []
    const q = search.trim().toLowerCase()
    return requests.filter((req) => {
      if (statusFilter !== "ALL" && req.status !== statusFilter) return false
      if (stepFilter !== "ALL" && String(req.current_step) !== stepFilter) return false
      if (!q) return true
      const requestNo = req.request_no ?? ""
      return (
        requestNo.toLowerCase().includes(q) ||
        String(req.request_id).includes(q)
      )
    })
  }, [requests, search, statusFilter, stepFilter])

  const sorted = useMemo(() => sortRequestsByCreatedAtDesc(filtered), [filtered])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">ประวัติการอนุมัติ</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเลขที่คำขอ"
              className="pl-9 w-full sm:w-64"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ทุกสถานะ</SelectItem>
              <SelectItem value="PENDING">รอดำเนินการ</SelectItem>
              <SelectItem value="APPROVED">อนุมัติแล้ว</SelectItem>
              <SelectItem value="REJECTED">ไม่อนุมัติ</SelectItem>
              <SelectItem value="RETURNED">ส่งกลับแก้ไข</SelectItem>
              <SelectItem value="CANCELLED">ยกเลิก</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stepFilter} onValueChange={setStepFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="ขั้นตอน" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ทุกขั้นตอน</SelectItem>
              {Object.entries(STEP_LABELS).map(([step, label]) => (
                <SelectItem key={step} value={step}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("")
              setStatusFilter("ALL")
              setStepFilter("ALL")
            }}
          >
            รีเซ็ตตัวกรอง
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">รายการที่คุณดำเนินการ</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !requests || requests.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              ยังไม่มีประวัติการอนุมัติ
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              ไม่พบคำขอตามเงื่อนไขที่เลือก
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((req) => (
                <div
                  key={req.request_id}
                  className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {req.request_no ?? `#${req.request_id}`}
                      </span>
                      <StatusBadge status={req.status} currentStep={req.current_step} />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      สังกัด: {req.current_department ?? "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ยื่นเมื่อ{" "}
                      {new Date(req.created_at).toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/approver/requests/${req.request_id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="mr-1 h-4 w-4" /> ดูรายละเอียด
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
