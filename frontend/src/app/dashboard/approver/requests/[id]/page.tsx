"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Download, FileIcon } from "lucide-react"
import { toast } from "sonner"

import {
  useCheckSignature,
  useMySignature,
  useUploadSignatureBase64,
} from "@/features/signature/hooks"
import { useProcessAction, useRequestDetail } from "@/features/request/hooks"
import {
  formatRequesterName,
  isSignatureReadyForApproval,
} from "@/features/request/approver-utils"
import { StatusBadge } from "@/components/common/status-badge"
import { RequestTimeline } from "@/components/common/request-timeline"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import SignaturePad from "@/components/common/signature-pad"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function ApproverRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { data: request, isLoading } = useRequestDetail(id)
  const processAction = useProcessAction()
  const { data: signatureCheck } = useCheckSignature()
  const { data: signatureData } = useMySignature()
  const uploadSignature = useUploadSignatureBase64()
  const [comment, setComment] = useState("")
  const [signatureMode, setSignatureMode] = useState<"SAVED" | "NEW" | null>(null)
  const [signature, setSignature] = useState("")

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
           <Skeleton className="h-10 w-10 rounded-full" />
           <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  if (!request) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
            <div className="bg-muted/30 p-4 rounded-full mb-4">
                <FileIcon className="h-8 w-8 opacity-50" />
            </div>
            <p className="text-lg font-medium">ไม่พบคำขอที่ระบุ</p>
            <Button variant="link" onClick={() => router.back()}>กลับไปหน้ารายการ</Button>
        </div>
    )
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"
  const requesterName = formatRequesterName(request.requester)
  const canAct = request.status === "PENDING"
  const hasSavedSignature = !!signatureCheck?.has_signature
  const hasNewSignature = !!signature
  const effectiveSignatureMode =
    signatureMode ?? (hasSavedSignature ? "SAVED" : "NEW")
  const signatureReady = isSignatureReadyForApproval(
    effectiveSignatureMode,
    hasSavedSignature,
    hasNewSignature,
  )


  const handleAction = async (action: "APPROVE" | "RETURN" | "REJECT") => {
    if (action === "REJECT" && !comment.trim()) {
      toast.error("กรุณาระบุเหตุผลในการไม่อนุมัติ")
      return
    }

    if (action === "APPROVE" && !signatureReady) {
      toast.error("กรุณาเลือกลายเซ็นผู้อนุมัติ")
      return
    }

    try {
      if (action === "APPROVE" && effectiveSignatureMode === "NEW") {
        await uploadSignature.mutateAsync(signature)
      }

      processAction.mutate(
        { id, payload: { action, comment: comment || undefined } },
        {
          onSuccess: () => {
            toast.success("บันทึกการอนุมัติแล้ว")
            router.push("/dashboard/approver/requests")
          },
          onError: (error: unknown) => {
            const msg = error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ"
            toast.error(msg)
          },
        },
      )
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "บันทึกลายเซ็นไม่สำเร็จ"
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-6 pb-24 md:pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 border-b pb-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center flex-wrap gap-2">
             <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                {request.request_no ?? `#${request.request_id}`}
             </h2>
             <StatusBadge status={request.status} currentStep={request.current_step} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            ยื่นโดย: <span className="font-medium text-foreground">{requesterName}</span> ({request.citizen_id})
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Details & Attachments */}
        <div className="lg:col-span-2 space-y-6">
           <Card className="border-l-4 border-l-primary shadow-sm">
             <CardHeader className="pb-3 bg-muted/5">
               <CardTitle className="text-base font-semibold flex items-center gap-2">
                 <FileIcon className="h-4 w-4 text-primary" /> ข้อมูลคำขอ
               </CardTitle>
             </CardHeader>
             <CardContent className="pt-4 grid gap-4 sm:grid-cols-2 text-sm">
               <div>
                 <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">สังกัด</p>
                 <p className="font-medium text-base">{request.current_department ?? "-"}</p>
               </div>
               <div>
                 <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">เลขที่ตำแหน่ง</p>
                 <p className="font-medium text-base">{request.current_position_number ?? "-"}</p>
               </div>
               <div className="sm:col-span-2">
                 <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">ภารกิจหลัก</p>
                 <p className="font-medium">{request.main_duty ?? "-"}</p>
               </div>
               <div>
                 <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">วันที่มีผล</p>
                 <p className="font-medium">
                   {new Date(request.effective_date).toLocaleDateString("th-TH", { dateStyle: 'long' })}
                 </p>
               </div>
               <div>
                 <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">ยอดเบิกจ่าย</p>
                 <p className="text-xl font-bold text-emerald-600">
                   {request.requested_amount.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">บาท</span>
                 </p>
               </div>
             </CardContent>
           </Card>

           <Card className="shadow-sm">
             <CardHeader className="pb-3">
               <CardTitle className="text-base font-semibold">เอกสารแนบ ({request.attachments.length})</CardTitle>
             </CardHeader>
             <CardContent>
               {request.attachments.length === 0 ? (
                 <div className="text-center text-muted-foreground py-8 bg-muted/10 rounded-lg border border-dashed">
                    ไม่พบเอกสารแนบ
                 </div>
               ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {request.attachments.map((att) => (
                     <div
                       key={att.attachment_id}
                       className="group relative flex items-center justify-between rounded-lg border bg-card p-3 hover:shadow-md transition-shadow cursor-pointer"
                       onClick={() => window.open(`${apiBase}/${att.file_path}`, '_blank')}
                     >
                       <div className="flex items-center gap-3 overflow-hidden">
                         <div className="h-10 w-10 flex items-center justify-center rounded bg-primary/10 text-primary shrink-0">
                            <FileIcon className="h-5 w-5" />
                         </div>
                         <div className="min-w-0">
                           <p className="text-sm font-medium truncate pr-2" title={att.file_name}>{att.file_name}</p>
                           <p className="text-xs text-muted-foreground">
                             {(att.file_size / 1024).toFixed(0)} KB • {att.file_type}
                           </p>
                         </div>
                       </div>
                       <Button variant="ghost" size="icon" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Download className="h-4 w-4" />
                       </Button>
                     </div>
                   ))}
                 </div>
               )}
             </CardContent>
           </Card>
        </div>

        {/* Right Column: Timeline & Action */}
        <div className="space-y-6">
           <Card className="shadow-sm">
             <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">ประวัติการดำเนินการ</CardTitle>
             </CardHeader>
             <CardContent className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
               <RequestTimeline currentStep={request.current_step} status={request.status} />
             </CardContent>
           </Card>

           {/* Approval Action Panel */}
           <Card className={`border-2 ${canAct ? 'border-primary/20 bg-primary/5' : 'border-dashed opacity-80'}`}>
             <CardHeader className="pb-3">
               <CardTitle className="text-base font-semibold flex items-center gap-2">
                 {canAct ? 'ดำเนินการอนุมัติ' : 'สถานะการดำเนินการ'}
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                {canAct ? (
                    <>
                        {/* Signature Mode Selector */}
                        <div className="bg-white p-3 rounded-lg border space-y-3">
                            <label className="text-sm font-medium text-muted-foreground">ลายเซ็นผู้อนุมัติ</label>
                            <div className="grid gap-2 text-sm">
                                <label className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="signature-mode"
                                        value="SAVED"
                                        checked={effectiveSignatureMode === "SAVED"}
                                        onChange={() => setSignatureMode("SAVED")}
                                        disabled={!hasSavedSignature}
                                        className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                                    />
                                    <span>
                                        ใช้ลายเซ็นเดิม
                                        {!hasSavedSignature && <span className="text-xs text-muted-foreground ml-1">(ไม่มี)</span>}
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="signature-mode"
                                        value="NEW"
                                        checked={effectiveSignatureMode === "NEW"}
                                        onChange={() => setSignatureMode("NEW")}
                                        className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                                    />
                                    <span>เซ็นชื่อใหม่</span>
                                </label>
                            </div>

                            {effectiveSignatureMode === "SAVED" && hasSavedSignature && (
                                <div className="mt-2 h-16 flex items-center justify-center bg-muted/20 rounded border border-dashed text-xs text-muted-foreground">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={signatureData?.data_url} alt="Saved Signature" className="h-12 w-auto object-contain mix-blend-multiply opacity-80" />
                                </div>
                            )}

                            {effectiveSignatureMode === "NEW" && (
                                <div className="mt-2 border rounded overflow-hidden bg-white">
                                    <SignaturePad
                                        onSave={(data) => setSignature(data)}
                                        clearLabel="ล้าง"
                                        placeholder="เซ็นชื่อที่นี่"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                             <label className="text-sm font-medium text-muted-foreground">ความเห็นเพิ่มเติม (Optional)</label>
                             <textarea
                                className="flex min-h-[80px] w-full rounded-md border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="ระบุเหตุผล หรือ หมายเหตุ..."
                            />
                        </div>
                    </>
                ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                        รายการนี้สิ้นสุดการดำเนินการของท่านแล้ว
                    </div>
                )}
             </CardContent>
           </Card>
        </div>
      </div>

      {/* Sticky Action Bar for Mobile */}
      {canAct && (
          <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:relative md:p-0 md:bg-transparent md:border-t-0 md:shadow-none md:z-0">
             <div className="flex items-center gap-3 justify-end max-w-7xl mx-auto">
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" className="flex-1 md:flex-none border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" disabled={processAction.isPending}>
                      ไม่อนุมัติ
                    </Button>
                  }
                  title="ไม่อนุมัติคำขอ"
                  description="คำขอนี้จะถูกปฏิเสธและต้องยื่นใหม่ ต้องการดำเนินการต่อหรือไม่?"
                  confirmLabel="ยืนยันไม่อนุมัติ"
                  onConfirm={() => handleAction("REJECT")}
                  variant="destructive"
                />

                <ConfirmDialog
                  trigger={
                    <Button variant="outline" className="flex-1 md:flex-none" disabled={processAction.isPending}>
                      แก้ไข
                    </Button>
                  }
                  title="ส่งกลับแก้ไข"
                  description="ส่งคืนคำขอให้ผู้ยื่นแก้ไขข้อมูล?"
                  confirmLabel="ส่งคืน"
                  onConfirm={() => handleAction("RETURN")}
                />

                <ConfirmDialog
                  trigger={
                    <Button
                      className="flex-[2] md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px] shadow-lg md:shadow-none"
                      disabled={
                        processAction.isPending ||
                        (effectiveSignatureMode === "SAVED" && !hasSavedSignature) ||
                        (effectiveSignatureMode === "NEW" && !hasNewSignature)
                      }
                    >
                      อนุมัติคำขอ
                    </Button>
                  }
                  title="ยืนยันการอนุมัติ"
                  description="ยืนยันการอนุมัติคำขอนี้พร้อมลายเซ็นของท่าน?"
                  confirmLabel="ยืนยันอนุมัติ"
                  onConfirm={() => handleAction("APPROVE")}
                />
             </div>
          </div>
      )}
    </div>
  )
}
