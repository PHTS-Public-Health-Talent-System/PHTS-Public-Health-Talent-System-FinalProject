"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, Eye, FileSearch } from "lucide-react"

import { usePendingApprovals } from "@/features/request/hooks"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

export default function PtsOfficerVerificationPage() {
  const { data: requests, isLoading } = usePendingApprovals()
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!requests) return []
    const q = search.trim().toLowerCase()
    if (!q) return requests
    return requests.filter((req) => {
      const requestNo = req.request_no ?? ""
      return (
        requestNo.toLowerCase().includes(q) ||
        String(req.request_id).includes(q)
      )
    })
  }, [requests, search])

  const sorted = useMemo(() => {
    return [...filtered].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
  }, [filtered])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-primary/5 p-6 rounded-xl border border-primary/10 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            ตรวจสอบเอกสารคำขอ
          </h2>
          <p className="text-muted-foreground mt-1">
            รายการคำขอที่รอการตรวจสอบความถูกต้องของเอกสาร
          </p>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
        <div className="relative z-10 w-full sm:w-72">
           <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาเลขที่คำขอ..."
                className="pl-9 w-full bg-background/80 backdrop-blur-sm focus:bg-background transition-colors"
              />
           </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-primary" />
            รายการที่รอตรวจสอบ ({sorted.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : !requests || requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
               <FileSearch className="mx-auto h-10 w-10 mb-3 opacity-20" />
               <p>ไม่มีคำขอที่รอตรวจสอบในขณะนี้</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              ไม่พบคำขอตามเงื่อนไขที่เลือก
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-border">
              {sorted.map((req) => (
                <div
                  key={req.request_id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/30 transition-colors first:rounded-t-lg last:rounded-b-lg gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-primary">
                        {req.request_no ?? `#${req.request_id}`}
                      </span>
                      <StatusBadge status={req.status} currentStep={req.current_step} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                       <span>สังกัด: {req.current_department ?? "-"}</span>
                       <span className="hidden sm:inline text-border">|</span>
                       <span>ยื่นเมื่อ: {new Date(req.created_at).toLocaleDateString("th-TH", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button asChild variant="outline" size="sm" className="h-8">
                       <Link href={`/dashboard/pts-officer/verification/${req.request_id}`}>
                          <Eye className="mr-2 h-3 w-3" /> ตรวจสอบ
                       </Link>
                    </Button>
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
