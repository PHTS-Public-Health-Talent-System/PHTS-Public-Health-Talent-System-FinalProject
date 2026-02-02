"use client"

import { CheckCircle2, RefreshCw } from "lucide-react"
import { useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

import { RequestFormData } from "@/types/request.types"
import { useAttachmentOcr, useMasterRates, useRequestAttachmentOcr } from "@/features/request/hooks"
import {
  getAttachmentOcr,
  getRecommendedClassification,
  type MasterRate,
  type OcrResult,
} from "@/features/request/api"


interface Step4Props {
  data: RequestFormData
  updateData: (field: keyof RequestFormData, value: unknown) => void
}

export function Step4Classification({ data, updateData }: Step4Props) {
  const { data: masterRates, isLoading } = useMasterRates()
  const requestOcrMutation = useRequestAttachmentOcr()
  const attachmentId = data.ocrResult?.attachmentId
  const recommendAttemptRef = useRef<{ attachmentId?: number; requestId?: string | number }>({})
  const { data: ocrData } = useAttachmentOcr(attachmentId, {
    enabled: !!attachmentId,
    refetchInterval: (result: unknown) => {
      const status = (result as OcrResult | undefined)?.ocr_status
      if (status === "PENDING" || status === "PROCESSING") return 3000
      return false
    },
  })

  const handleGroupChange = (value: string) => {
    updateData("classification", {
        ...data.classification,
        groupId: value,
        itemId: "",
        amount: 0
    })
  }

  const handleItemChange = (value: string) => {
    const selected = itemsForGroup.find((item) => item.value === value)
    updateData("classification", {
      ...data.classification,
      itemId: value,
      amount: selected?.amount ?? 0,
    })
  }

  const ocrResult = data.ocrResult
  const recommended = data.recommendedClassification
  const ocr = ocrData as OcrResult | undefined
  const ocrStatus = ocr?.ocr_status ?? (ocrResult ? "COMPLETED" : "NONE")

  const statusLabel =
    ocrStatus === "PROCESSING"
      ? "กำลังประมวลผล"
      : ocrStatus === "PENDING"
      ? "รอคิว OCR"
      : ocrStatus === "FAILED"
      ? "ล้มเหลว"
      : ocrStatus === "COMPLETED"
      ? "เสร็จแล้ว"
      : "ยังไม่มีข้อมูล"

  const rates = (masterRates ?? []) as MasterRate[]
  const groups = Array.from(new Set(rates.map((r) => r.group_no))).sort((a, b) => a - b)
  const selectedGroupNo = Number(data.classification?.groupId?.match(/\d+/)?.[0] ?? 0)
  const itemsForGroup = rates
    .filter((r) => r.group_no === selectedGroupNo)
    .map((r) => {
      const item = `${r.item_no}${r.sub_item_no ? `.${r.sub_item_no}` : ""}`
      const value = r.sub_item_no ? `item${r.item_no}_${r.sub_item_no}` : `item${r.item_no}`
      return {
        value,
        label: `ข้อ ${item}`,
        amount: r.amount,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  useEffect(() => {
    if (!ocr) return
    const status = ocr.ocr_status
    if (status === "COMPLETED") {
      updateData("ocrResult", {
        licenseNo: ocr.license_no ?? "-",
        expiryDate: ocr.expiry_date ?? "-",
        confidence: ocr.confidence ?? 0,
        attachmentId,
      })
      if (data.id && !data.recommendedClassification) {
        const key = `${data.id}-${attachmentId ?? "none"}`
        if (recommendAttemptRef.current.requestId === key) return
        recommendAttemptRef.current.requestId = key
        getRecommendedClassification(data.id)
          .then((recommended) => {
            if (!recommended) return
            updateData("recommendedClassification", {
              groupId: `group${recommended.group_no}`,
              itemId: recommended.sub_item_no
                ? `item${recommended.item_no}_${recommended.sub_item_no}`
                : `item${recommended.item_no}`,
              amount: recommended.amount,
              hintText: recommended.hint_text,
            })
            updateData("classification", {
              groupId: `group${recommended.group_no}`,
              itemId: recommended.sub_item_no
                ? `item${recommended.item_no}_${recommended.sub_item_no}`
                : `item${recommended.item_no}`,
              amount: recommended.amount,
            })
          })
          .catch(() => {
            toast.error("ไม่สามารถดึงคำแนะนำได้");
          })
      }
    }
  }, [ocr, attachmentId, updateData, data.id, data.recommendedClassification])

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* 1. OCR Result (Read-only) */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-blue-50/50 border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-blue-800">
              <CheckCircle2 className="h-5 w-5" /> ผลการอ่านเอกสาร (OCR)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex items-center justify-between">
               <Label className="text-muted-foreground">สถานะ</Label>
               <Badge variant={ocrStatus === "FAILED" ? "destructive" : "secondary"}>
                 {statusLabel}
               </Badge>
             </div>
             <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">เลขที่ใบอนุญาต</Label>
                  <p className="font-semibold text-lg">{ocrResult?.licenseNo || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">วันหมดอายุ</Label>
                  <p className="font-semibold text-lg">{ocrResult?.expiryDate || "-"}</p>
                </div>
             </div>

             {!ocrResult && (
               <Alert className="bg-white border-blue-200 py-2">
                 <AlertDescription className="text-xs text-blue-600">
                   ยังไม่มีผล OCR กรุณาแนบใบอนุญาตและยืนยันเอกสารในขั้นตอนก่อนหน้า
                 </AlertDescription>
               </Alert>
             )}

             {recommended?.hintText && (
               <Alert className="bg-white border-blue-200 py-2">
                 <AlertDescription className="text-xs text-blue-600">
                   ℹ️ AI Analysis: {recommended.hintText}
                 </AlertDescription>
               </Alert>
             )}

             {ocrStatus === "FAILED" && (
               <Alert className="bg-white border-destructive/30 py-2">
                 <AlertDescription className="text-xs text-destructive">
                   OCR ไม่สำเร็จ กรุณาตรวจสอบไฟล์ใบอนุญาต (PDF/PNG/JPEG) ให้ชัดเจน แล้วกด “ลองใหม่”
                 </AlertDescription>
               </Alert>
             )}

             {!recommended && (
               <div className="flex items-center justify-between gap-2">
                 <p className="text-xs text-muted-foreground">
                   หาก OCR ไม่สำเร็จ สามารถกดเพื่อพยายามอีกครั้ง
                 </p>
                 <Button
                   size="sm"
                   variant="outline"
                   disabled={requestOcrMutation.isPending}
                   onClick={async () => {
                     const attachmentId = data.ocrResult?.attachmentId;
                     if (!attachmentId) {
                       toast.error("ไม่พบไฟล์ใบอนุญาตสำหรับ OCR");
                       return;
                     }
                     try {
                       await requestOcrMutation.mutateAsync(attachmentId);
                       const ocr = await getAttachmentOcr(attachmentId);
                       updateData("ocrResult", {
                         licenseNo: ocr?.license_no ?? "-",
                         expiryDate: ocr?.expiry_date ?? "-",
                         confidence: ocr?.confidence ?? 0,
                         attachmentId,
                       });
                       if (data.id) {
                         const recommended = await getRecommendedClassification(data.id);
                         if (recommended) {
                           updateData("recommendedClassification", {
                             groupId: `group${recommended.group_no}`,
                             itemId: recommended.sub_item_no
                               ? `item${recommended.item_no}_${recommended.sub_item_no}`
                               : `item${recommended.item_no}`,
                             amount: recommended.amount,
                             hintText: recommended.hint_text,
                           });
                           updateData("classification", {
                             groupId: `group${recommended.group_no}`,
                             itemId: recommended.sub_item_no
                               ? `item${recommended.item_no}_${recommended.sub_item_no}`
                               : `item${recommended.item_no}`,
                             amount: recommended.amount,
                           });
                         }
                       }
                       toast.success("ร้องขอ OCR ใหม่แล้ว");
                     } catch {
                       toast.error("ขอ OCR ใหม่ไม่สำเร็จ");
                     }
                   }}
                 >
                   <RefreshCw className="mr-1 h-3 w-3" /> ลองใหม่
                 </Button>
               </div>
             )}
          </CardContent>
        </Card>

        <Card className="border-primary shadow-sm">
           <CardHeader className="pb-2 bg-primary text-primary-foreground rounded-t-lg">
              <CardTitle className="text-base">ระบบแนะนำ (Recommended)</CardTitle>
           </CardHeader>
           <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">
                 {recommended?.amount?.toLocaleString() || 0} <span className="text-sm font-normal text-muted-foreground">บาท</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                 กลุ่ม {recommended?.groupId} ข้อ {recommended?.itemId}
              </p>
           </CardContent>
        </Card>
      </div>

      {/* 2. Selection Form (User Override) */}
      <div className="border rounded-lg p-6 bg-white shadow-sm space-y-4">
         <div className="flex items-center gap-2">
            <div className="h-6 w-1 bg-primary rounded-full"></div>
            <h4 className="font-semibold text-lg">ยืนยันข้อมูลเพื่อคำนวณเงิน</h4>
         </div>

         <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
               <Label>กลุ่มบัญชี</Label>
               {isLoading ? (
                 <Skeleton className="h-10 w-full" />
               ) : (
                 <Select
                   value={data.classification?.groupId}
                   onValueChange={handleGroupChange}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="เลือกกลุ่มบัญชี" />
                   </SelectTrigger>
                   <SelectContent>
                      {groups.length === 0 ? (
                        <SelectItem value="none" disabled>ไม่พบข้อมูลกลุ่มบัญชี</SelectItem>
                      ) : (
                        groups.map((groupNo) => (
                          <SelectItem key={groupNo} value={`group${groupNo}`}>
                            กลุ่ม {groupNo}
                          </SelectItem>
                        ))
                      )}
                   </SelectContent>
                 </Select>
               )}
            </div>

            <div className="space-y-2">
               <Label>รายการเบิก</Label>
               {isLoading ? (
                 <Skeleton className="h-10 w-full" />
               ) : (
                 <Select
                   value={data.classification?.itemId}
                   onValueChange={handleItemChange}
                   disabled={!data.classification?.groupId}
                 >
                   <SelectTrigger>
                      <SelectValue placeholder="เลือกรายการ" />
                   </SelectTrigger>
                   <SelectContent>
                      {itemsForGroup.length === 0 ? (
                        <SelectItem value="none" disabled>ไม่พบรายการเบิก</SelectItem>
                      ) : (
                        itemsForGroup.map((item) => (
                          <SelectItem key={`${item.value}-${item.amount}`} value={item.value}>
                            {item.label} — {item.amount.toLocaleString()} บาท
                          </SelectItem>
                        ))
                      )}
                   </SelectContent>
                 </Select>
               )}
            </div>
            <div className="space-y-2">
              <Label>วันที่มีผล</Label>
              <Input
                type="date"
                value={data.effectiveDate}
                onChange={(e) => updateData("effectiveDate", e.target.value)}
              />
            </div>
         </div>
      </div>
    </div>
  )
}
