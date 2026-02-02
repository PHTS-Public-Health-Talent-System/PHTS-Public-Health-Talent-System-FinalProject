"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Eye, Search } from "lucide-react"

import { useMyScopes, usePendingApprovals, useApproveBatch } from "@/features/request/hooks"
import { buildScopeOptions } from "@/features/request/approver-utils"
import { StatusBadge } from "@/components/common/status-badge"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/components/providers/auth-provider"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

export default function ApproverRequestsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const scopeQuery = searchParams.get("scope") || "ALL"
  const queryParam = searchParams.get("q") || ""

  const { user } = useAuth()
  const isDirector = user?.role === "DIRECTOR"
  const approveBatch = useApproveBatch()
  const qc = useQueryClient()

  const { data: scopes } = useMyScopes()
  const [search, setSearch] = useState(queryParam)
  const [scopeFilter, setScopeFilter] = useState(scopeQuery)
  const [batchComment, setBatchComment] = useState("")
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const pendingScope = scopeFilter === "ALL" ? undefined : scopeFilter
  const { data: requests, isLoading } = usePendingApprovals(pendingScope)

  const scopeOptions = useMemo(() => buildScopeOptions(scopes ?? []), [scopes])

  const updateQuery = (next: { q?: string; scope?: string }) => {
    const params = new URLSearchParams()
    const nextQ = next.q !== undefined ? next.q : search
    const nextScope = next.scope !== undefined ? next.scope : scopeFilter

    if (nextQ) params.set("q", nextQ)
    if (nextScope && nextScope !== "ALL") params.set("scope", nextScope)

    const query = params.toString()
    router.replace(query ? `?${query}` : "/dashboard/approver/requests")
  }

  const filtered = useMemo(() => {
    if (!requests) return []
    const q = search.trim().toLowerCase()
    return requests.filter((req) => {
      if (!q) return true
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

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const selectAllVisible = () => {
    setSelectedIds(sorted.map((req) => req.request_id))
  }

  const clearSelection = () => {
    setSelectedIds([])
    setBatchComment("")
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
           <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">คำขอรออนุมัติ</h2>
              <p className="text-muted-foreground mt-1">ตรวจสอบและอนุมัติคำขอที่เข้ามาใหม่</p>
           </div>

        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  updateQuery({ q: e.target.value })
                }}
                placeholder="ค้นหาเลขที่คำขอ..."
                className="pl-9 w-full h-11"
              />
            </div>
            <Select
              value={scopeFilter}
              onValueChange={(val: string) => {
                setScopeFilter(val)
                updateQuery({ scope: val })
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px] h-11">
                <SelectValue placeholder="เลือกขอบเขต" />
              </SelectTrigger>
              <SelectContent>
                {scopeOptions.map((scope) => (
                  <SelectItem key={scope.value} value={scope.value}>
                    {scope.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
        </div>
      </div>

      {isDirector && (
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
               การอนุมัติแบบชุด <span className="text-xs font-normal text-muted-foreground">(เฉพาะผู้อำนวยการ)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                variant="outline"
                size="sm"
                onClick={selectAllVisible}
                disabled={sorted.length === 0}
                className="whitespace-nowrap"
                >
                เลือกทั้งหมด ({sorted.length})
                </Button>
                {selectedIds.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearSelection} className="text-muted-foreground">
                    ล้าง ({selectedIds.length})
                </Button>
                )}
            </div>

            <div className="flex w-full sm:w-auto flex-1 gap-2">
                <Input
                value={batchComment}
                onChange={(e) => setBatchComment(e.target.value)}
                placeholder="ระบุความเห็น (ถ้ามี)"
                className="h-9 min-w-[200px]"
                />
                <ConfirmDialog
                trigger={
                    <Button size="sm" disabled={selectedIds.length === 0 || approveBatch.isPending} className="whitespace-nowrap">
                    อนุมัติที่เลือก ({selectedIds.length})
                    </Button>
                }
                title="ยืนยันการอนุมัติแบบชุด"
                description={`ต้องการอนุมัติคำขอจำนวน ${selectedIds.length} รายการ หรือไม่?`}
                confirmLabel="อนุมัติทั้งหมด"
                onConfirm={() => {
                    approveBatch.mutate(
                    { requestIds: selectedIds, comment: batchComment || undefined },
                    {
                        onSuccess: () => {
                        toast.success("อนุมัติคำขอที่เลือกแล้ว")
                        qc.invalidateQueries({ queryKey: ["pending-approvals"] })
                        clearSelection()
                        },
                        onError: (error: unknown) => {
                        const msg = error instanceof Error ? error.message : "อนุมัติไม่สำเร็จ"
                        toast.error(msg)
                        },
                    },
                    )
                }}
                />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request List */}
      <Card className="border-none shadow-none bg-transparent">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : !requests || requests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                  <Search className="h-6 w-6 opacity-40" />
              </div>
              <h3 className="font-medium text-lg mb-1">ไม่มีคำขอที่รออนุมัติ</h3>
              <p className="text-sm">ขอบเขตงานของคุณเรียบร้อยดี</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
               <p>ไม่พบคำขอตามเงื่อนไขที่เลือก</p>
               <Button variant="link" onClick={() => {setSearch(""); setScopeFilter("ALL"); updateQuery({q: "", scope: "ALL"})}}>
                 ล้างตัวกรอง
               </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {sorted.map((req) => (
                <div
                  key={req.request_id}
                  className={`group relative flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md md:flex-row md:items-center md:justify-between ${
                    selectedIds.includes(req.request_id) ? "ring-2 ring-primary border-primary" : "border-border"
                  }`}
                  onClick={(e) => {
                      if (isDirector && (e.target as HTMLElement).tagName !== 'BUTTON' && (e.target as HTMLElement).tagName !== 'A') {
                          toggleSelect(req.request_id);
                      }
                  }}
                >
                  <div className="flex items-start gap-4">
                    {isDirector && (
                        <div className="flex h-6 items-center">
                             <input
                                type="checkbox"
                                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={selectedIds.includes(req.request_id)}
                                onChange={() => toggleSelect(req.request_id)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}

                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                             <span className="font-bold text-lg text-primary tracking-tight">
                                {req.request_no ?? `#${req.request_id}`}
                            </span>
                             <StatusBadge status={req.status} currentStep={req.current_step} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <span className="w-16 text-xs uppercase tracking-wider opacity-70">สังกัด</span>
                                <span className="font-medium text-foreground">{req.current_department ?? "-"}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-16 text-xs uppercase tracking-wider opacity-70">ยื่นเมื่อ</span>
                                <span>{new Date(req.created_at).toLocaleDateString("th-TH", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                })}</span>
                            </div>
                             <div className="flex items-center gap-1">
                                <span className="w-16 text-xs uppercase tracking-wider opacity-70">จำนวนเงิน</span>
                                <span className="font-medium text-green-600">{req.requested_amount?.toLocaleString() ?? 0} บาท</span>
                            </div>
                        </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 md:pt-0 pl-12 md:pl-0 border-t md:border-t-0 mt-2 md:mt-0">
                    <Link href={`/dashboard/approver/requests/${req.request_id}`} onClick={(e) => e.stopPropagation()}>
                      <Button variant="default" size="sm" className="shadow-none">
                        ตรวจสอบ & อนุมัติ
                        <Eye className="ml-2 h-4 w-4" />
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
