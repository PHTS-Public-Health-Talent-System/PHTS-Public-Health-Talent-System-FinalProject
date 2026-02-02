"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Download, FileIcon } from "lucide-react"
import { toast } from "sonner"

import {
  useAttachmentOcr,
  useAvailableOfficers,
  useMasterRates,
  useProcessAction,
  useRecommendedClassification,
  useReassignHistory,
  useReassignRequest,
  useRequestAttachmentOcr,
  useRequestDetail,
  useCreateVerificationSnapshot,
  useUpdateClassification,
  useUpdateRequest,
  useUpdateVerificationChecks,
  useAdjustLeaveRequest,
} from "@/features/request/hooks"
import {
  useCheckSignature,
  useMySignature,
  useUploadSignatureBase64,
} from "@/features/signature/hooks"
import { findRateIdForSelection, parseClassificationSelection } from "@/features/request/pts-utils"
import { formatRequesterName, isSignatureReadyForApproval } from "@/features/request/approver-utils"
import { StatusBadge } from "@/components/common/status-badge"
import { RequestTimeline } from "@/components/common/request-timeline"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import SignaturePad from "@/components/common/signature-pad"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PERSONNEL_TYPE_LABELS,
  REQUEST_TYPE_LABELS,
  WORK_ATTRIBUTE_LABELS,
  type WorkAttributes,
} from "@/types/request.types"

export default function PtsOfficerRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { data: request, isLoading } = useRequestDetail(id)
  const updateRequest = useUpdateRequest()
  const updateClassification = useUpdateClassification()
  const updateChecks = useUpdateVerificationChecks()
  const processAction = useProcessAction()
  const createSnapshot = useCreateVerificationSnapshot()
  const requestOcr = useRequestAttachmentOcr()
  const { data: rates, isLoading: isRatesLoading } = useMasterRates()
  const { data: recommended } = useRecommendedClassification(id)
  const { data: availableOfficers } = useAvailableOfficers()
  const reassignMutation = useReassignRequest()
  const { data: reassignHistory } = useReassignHistory(id)
  const adjustLeave = useAdjustLeaveRequest()
  const { data: signatureCheck } = useCheckSignature()
  const { data: signatureData } = useMySignature()
  const uploadSignature = useUploadSignatureBase64()

  const [comment, setComment] = useState("")
  const [signatureMode, setSignatureMode] = useState<"SAVED" | "NEW" | null>(null)
  const [signature, setSignature] = useState("")
  const [overrides, setOverrides] = useState<{
    personnel_type?: string
    position_number?: string
    department_group?: string
    request_type?: string
    main_duty?: string
    effective_date?: string
    work_attributes?: WorkAttributes
  }>({})
  const [verification, setVerification] = useState({
    qualification_ok: false,
    evidence_ok: false,
  })
  const [classification, setClassification] = useState({
    groupId: "",
    itemId: "",
    amount: 0,
  })
  const [reassignTarget, setReassignTarget] = useState<string>("")
  const [reassignReason, setReassignReason] = useState("")
  const [leaveAdjust, setLeaveAdjust] = useState({
    manual_start_date: "",
    manual_end_date: "",
    manual_duration_days: "",
    remark: "",
  })

  const licenseAttachmentId = request?.attachments?.find(
    (att) => att.file_type === "LICENSE",
  )?.attachment_id
  const { data: licenseOcr } = useAttachmentOcr(licenseAttachmentId, {
    enabled: !!licenseAttachmentId,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  if (!request) {
    return <div className="text-center py-20 text-muted-foreground">ไม่พบคำขอ</div>
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"
  const requesterName = formatRequesterName(request.requester)
  const canAct = request.status === "PENDING"
  const baseWorkAttributes =
    request.work_attributes ?? ({
      operation: false,
      planning: false,
      coordination: false,
      service: false,
    } as WorkAttributes)
  const currentForm = {
    personnel_type: overrides.personnel_type ?? request.personnel_type ?? "",
    position_number:
      overrides.position_number ?? request.current_position_number ?? "",
    department_group: overrides.department_group ?? request.current_department ?? "",
    request_type: overrides.request_type ?? request.request_type ?? "",
    main_duty: overrides.main_duty ?? request.main_duty ?? "",
    effective_date:
      overrides.effective_date ?? request.effective_date?.split("T")[0] ?? "",
    work_attributes: overrides.work_attributes ?? baseWorkAttributes,
  }

  const hasSavedSignature = !!signatureCheck?.has_signature
  const hasNewSignature = !!signature
  const effectiveSignatureMode =
    signatureMode ?? (hasSavedSignature ? "SAVED" : "NEW")
  const signatureReady = isSignatureReadyForApproval(
    effectiveSignatureMode,
    hasSavedSignature,
    hasNewSignature,
  )

  const groups = Array.from(new Set((rates ?? []).map((r) => r.group_no))).sort(
    (a, b) => a - b,
  )
  const selectedGroupNo = Number(classification.groupId.match(/\d+/)?.[0] ?? 0)
  const itemsForGroup = (rates ?? [])
    .filter((r) => r.group_no === selectedGroupNo)
    .map((r) => {
      const item = `${r.item_no}${r.sub_item_no ? `.${r.sub_item_no}` : ""}`
      const value = r.sub_item_no ? `item${r.item_no}_${r.sub_item_no}` : `item${r.item_no}`
      return { value, label: `ข้อ ${item}`, amount: r.amount }
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  const handleSaveRequest = async () => {
    const fd = new FormData()
    fd.append("personnel_type", currentForm.personnel_type)
    fd.append("position_number", currentForm.position_number)
    fd.append("department_group", currentForm.department_group)
    fd.append("request_type", currentForm.request_type)
    fd.append("main_duty", currentForm.main_duty)
    fd.append("effective_date", currentForm.effective_date)
    fd.append("work_attributes", JSON.stringify(currentForm.work_attributes))

    updateRequest.mutate(
      { id, formData: fd },
      {
        onSuccess: () => toast.success("บันทึกข้อมูลเรียบร้อยแล้ว"),
        onError: (error: unknown) => {
          const msg = error instanceof Error ? error.message : "บันทึกข้อมูลไม่สำเร็จ"
          toast.error(msg)
        },
      },
    )
  }

  const handleSaveClassification = async () => {
    const parsed = parseClassificationSelection(
      classification.groupId,
      classification.itemId,
    )
    if (!parsed.group_no || !parsed.item_no) {
      toast.error("กรุณาเลือกกลุ่มและรายการ")
      return
    }
    const payload = {
      group_no: parsed.group_no,
      item_no: parsed.item_no,
      sub_item_no: parsed.sub_item_no ?? null,
    }
    updateClassification.mutate(
      { id, payload },
      {
        onSuccess: (result) => {
          const payload = result as { amount?: unknown } | undefined
          const amount =
            typeof payload?.amount === "number"
              ? payload.amount
              : classification.amount
          setClassification((prev) => ({ ...prev, amount }))
          toast.success("อัปเดตกลุ่ม/อัตราเรียบร้อยแล้ว")
        },
        onError: (error: unknown) => {
          const msg = error instanceof Error ? error.message : "อัปเดตกลุ่มไม่สำเร็จ"
          toast.error(msg)
        },
      },
    )
  }

  const displayAmount =
    classification.amount || request.requested_amount || 0

  const handleSaveChecks = async () => {
    updateChecks.mutate(
      { id, payload: { qualification_ok: verification.qualification_ok, evidence_ok: verification.evidence_ok } },
      {
        onSuccess: () => toast.success("บันทึกผลตรวจสอบเรียบร้อยแล้ว"),
        onError: () => toast.error("บันทึกผลตรวจสอบไม่สำเร็จ"),
      },
    )
  }

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

      if (action === "APPROVE") {
        const parsed = parseClassificationSelection(
          classification.groupId,
          classification.itemId,
        )
        if (!parsed.group_no || !parsed.item_no) {
          toast.error("กรุณาเลือกกลุ่ม/ข้อก่อนอนุมัติ")
          return
        }

        const usableRates =
          (rates ?? []).filter(
            (rate): rate is typeof rate & { rate_id: number } =>
              typeof rate.rate_id === "number",
          ) ?? []
        const normalizedRates = usableRates.map((rate) => ({
          ...rate,
          item_no: String(rate.item_no),
          sub_item_no:
            rate.sub_item_no !== undefined && rate.sub_item_no !== null
              ? String(rate.sub_item_no)
              : null,
        }))
        const rateId = findRateIdForSelection(
          normalizedRates,
          parsed.group_no,
          parsed.item_no,
          parsed.sub_item_no ?? null,
        )
        if (!rateId) {
          toast.error("ไม่พบอัตราที่ตรงกับกลุ่ม/ข้อ")
          return
        }

        await createSnapshot.mutateAsync({
          id,
          payload: {
            master_rate_id: rateId,
            effective_date: currentForm.effective_date,
            snapshot_data: {
              group_no: parsed.group_no,
              item_no: parsed.item_no,
              sub_item_no: parsed.sub_item_no ?? null,
              amount: displayAmount,
              personnel_type: currentForm.personnel_type,
              position_number: currentForm.position_number,
              department: currentForm.department_group,
              main_duty: currentForm.main_duty,
              work_attributes: currentForm.work_attributes,
            },
          },
        })
      }

      processAction.mutate(
        { id, payload: { action, comment: comment || undefined } },
        {
          onSuccess: () => {
            toast.success("บันทึกการอนุมัติแล้ว")
            router.push("/dashboard/pts-officer/verification")
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

  const handleReassign = () => {
    if (!reassignTarget) {
      toast.error("กรุณาเลือกเจ้าหน้าที่ที่จะมอบหมาย")
      return
    }
    if (!reassignReason.trim()) {
      toast.error("กรุณาระบุเหตุผลในการมอบหมาย")
      return
    }
    reassignMutation.mutate(
      { id, payload: { target_officer_id: Number(reassignTarget), remark: reassignReason } },
      {
        onSuccess: () => {
          toast.success("โอนงานเรียบร้อยแล้ว")
          setReassignReason("")
        },
        onError: () => toast.error("โอนงานไม่สำเร็จ"),
      },
    )
  }

  const handleAdjustLeave = () => {
    if (!leaveAdjust.manual_start_date || !leaveAdjust.manual_end_date || !leaveAdjust.manual_duration_days) {
      toast.error("กรุณากรอกข้อมูลให้ครบ")
      return
    }
    adjustLeave.mutate(
      {
        id,
        payload: {
          manual_start_date: leaveAdjust.manual_start_date,
          manual_end_date: leaveAdjust.manual_end_date,
          manual_duration_days: Number(leaveAdjust.manual_duration_days),
          remark: leaveAdjust.remark,
        },
      },
      {
        onSuccess: () => toast.success("บันทึกการปรับวันลาเรียบร้อยแล้ว"),
        onError: () => toast.error("บันทึกการปรับวันลาไม่สำเร็จ"),
      },
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            {request.request_no ?? `#${request.request_id}`}
            <StatusBadge status={request.status} currentStep={request.current_step} />
          </h2>
          <p className="text-sm text-muted-foreground">
            ผู้ยื่น: {requesterName} ({request.citizen_id})
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="py-6">
          <RequestTimeline currentStep={request.current_step} status={request.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ข้อมูลคำขอ (แก้ไขได้)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
          <div className="space-y-2">
            <Label>ประเภทบุคลากร</Label>
            <Select
              value={currentForm.personnel_type}
              onValueChange={(val) => setOverrides((prev) => ({ ...prev, personnel_type: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="เลือกประเภทบุคลากร" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PERSONNEL_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>ประเภทคำขอ</Label>
            <Select
              value={currentForm.request_type}
              onValueChange={(val) => setOverrides((prev) => ({ ...prev, request_type: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="เลือกประเภทคำขอ" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REQUEST_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>เลขที่ตำแหน่ง</Label>
            <Input
              value={currentForm.position_number}
              onChange={(e) =>
                setOverrides((prev) => ({ ...prev, position_number: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>สังกัด</Label>
            <Input
              value={currentForm.department_group}
              onChange={(e) =>
                setOverrides((prev) => ({ ...prev, department_group: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>ภารกิจหลัก</Label>
            <textarea
              className="flex min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={currentForm.main_duty}
              onChange={(e) =>
                setOverrides((prev) => ({ ...prev, main_duty: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>วันที่มีผล</Label>
            <Input
              type="date"
              value={currentForm.effective_date}
              onChange={(e) =>
                setOverrides((prev) => ({ ...prev, effective_date: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>ลักษณะงาน</Label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(WORK_ATTRIBUTE_LABELS) as [keyof WorkAttributes, string][]).map(
                ([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`attr-${key}`}
                      checked={!!currentForm.work_attributes[key]}
                      onCheckedChange={(checked) =>
                        setOverrides((prev) => ({
                          ...prev,
                          work_attributes: {
                            ...currentForm.work_attributes,
                            [key]: !!checked,
                          },
                        }))
                      }
                    />
                    <Label htmlFor={`attr-${key}`}>{label}</Label>
                  </div>
                ),
              )}
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button
              onClick={handleSaveRequest}
              disabled={updateRequest.isPending}
            >
              บันทึกการแก้ไข
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">เอกสารแนบ & OCR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {request.attachments.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">ไม่มีเอกสารแนบ</p>
          ) : (
            request.attachments.map((att) => (
              <div
                key={att.attachment_id}
                className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-3">
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{att.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(att.file_size / 1024).toFixed(0)} KB · {att.ocr_status ?? "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`${apiBase}/${att.file_path}`} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-1 h-4 w-4" /> ดาวน์โหลด
                    </a>
                  </Button>
                  {att.file_type !== "SIGNATURE" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={requestOcr.isPending}
                      onClick={() => requestOcr.mutate(att.attachment_id)}
                    >
                      ขอ OCR ใหม่
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}

          {licenseOcr && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              เลขที่ใบอนุญาต: {licenseOcr.license_no ?? "-"} · หมดอายุ: {licenseOcr.expiry_date ?? "-"}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">จัดกลุ่ม/อัตราเงิน</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>กลุ่มบัญชี</Label>
            {isRatesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={classification.groupId}
                onValueChange={(val) =>
                  setClassification((prev) => ({ ...prev, groupId: val, itemId: "" }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกกลุ่มบัญชี" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((groupNo) => (
                    <SelectItem key={groupNo} value={`group${groupNo}`}>
                      กลุ่ม {groupNo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>รายการเบิก</Label>
            {isRatesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={classification.itemId}
                onValueChange={(val) => {
                  const item = itemsForGroup.find((i) => i.value === val)
                  setClassification((prev) => ({
                    ...prev,
                    itemId: val,
                    amount: item?.amount ?? 0,
                  }))
                }}
                disabled={!classification.groupId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกรายการ" />
                </SelectTrigger>
                <SelectContent>
                  {itemsForGroup.map((item) => (
                    <SelectItem key={`${item.value}-${item.amount ?? ""}`} value={item.value}>
                      {item.label} — {item.amount.toLocaleString()} บาท
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="md:col-span-2">
            <div className="rounded-lg border bg-primary/5 p-4">
              จำนวนเงินที่ขอ: {displayAmount.toLocaleString()} บาท
            </div>
            {recommended && (
              <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
                แนะนำ: กลุ่ม {recommended.group_no} ข้อ {recommended.item_no}
                {recommended.sub_item_no ? `.${recommended.sub_item_no}` : ""} — {recommended.amount.toLocaleString()} บาท
                {recommended.hint_text && (
                  <div className="text-xs text-muted-foreground mt-1">{recommended.hint_text}</div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() =>
                    setClassification({
                      groupId: `group${recommended.group_no}`,
                      itemId: recommended.sub_item_no
                        ? `item${recommended.item_no}_${recommended.sub_item_no}`
                        : `item${recommended.item_no}`,
                      amount: recommended.amount,
                    })
                  }
                >
                  ใช้คำแนะนำ
                </Button>
              </div>
            )}
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={handleSaveClassification} disabled={updateClassification.isPending}>
              บันทึกกลุ่ม/อัตรา
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ผลตรวจคุณสมบัติ/หลักฐาน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={verification.qualification_ok}
              onCheckedChange={(val) =>
                setVerification((prev) => ({ ...prev, qualification_ok: !!val }))
              }
            />
            ผ่านคุณสมบัติ
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={verification.evidence_ok}
              onCheckedChange={(val) =>
                setVerification((prev) => ({ ...prev, evidence_ok: !!val }))
              }
            />
            หลักฐานครบถ้วน
          </label>
          <div className="flex justify-end">
            <Button onClick={handleSaveChecks}>บันทึกผลตรวจสอบ</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">มอบหมายงานให้เจ้าหน้าที่อื่น</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={reassignTarget} onValueChange={setReassignTarget}>
            <SelectTrigger>
              <SelectValue placeholder="เลือกเจ้าหน้าที่" />
            </SelectTrigger>
            <SelectContent>
              {(availableOfficers ?? []).map((officer) => (
                <SelectItem key={officer.id} value={String(officer.id)}>
                  {officer.name} (งานค้าง {officer.workload})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={reassignReason}
            onChange={(e) => setReassignReason(e.target.value)}
            placeholder="เหตุผลการมอบหมาย"
          />
          <div className="flex justify-end">
            <Button onClick={handleReassign} disabled={reassignMutation.isPending}>
              มอบหมายงาน
            </Button>
          </div>
          {reassignHistory && reassignHistory.length > 0 && (
            <div className="mt-4 space-y-2 text-sm">
              {reassignHistory.map((item) => (
                <div key={item.actionId} className="rounded border p-2">
                  {item.actorName} · {item.reason ?? "-"} ·{" "}
                  {new Date(item.reassignedAt).toLocaleString("th-TH")}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ปรับวันลา (กรณีพิเศษ)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>วันที่เริ่ม</Label>
            <Input
              type="date"
              value={leaveAdjust.manual_start_date}
              onChange={(e) =>
                setLeaveAdjust((prev) => ({ ...prev, manual_start_date: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>วันที่สิ้นสุด</Label>
            <Input
              type="date"
              value={leaveAdjust.manual_end_date}
              onChange={(e) =>
                setLeaveAdjust((prev) => ({ ...prev, manual_end_date: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>จำนวนวัน</Label>
            <Input
              type="number"
              value={leaveAdjust.manual_duration_days}
              onChange={(e) =>
                setLeaveAdjust((prev) => ({ ...prev, manual_duration_days: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>หมายเหตุ</Label>
            <Input
              value={leaveAdjust.remark}
              onChange={(e) => setLeaveAdjust((prev) => ({ ...prev, remark: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={handleAdjustLeave} disabled={adjustLeave.isPending}>
              บันทึกการปรับวันลา
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ความเห็นผู้อนุมัติ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="flex min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="ระบุความเห็น (ถ้ามี)"
          />
          <div className="flex flex-wrap gap-2">
            <ConfirmDialog
              trigger={
                <Button
                  disabled={
                    !canAct ||
                    processAction.isPending ||
                    (effectiveSignatureMode === "SAVED" && !hasSavedSignature) ||
                    (effectiveSignatureMode === "NEW" && !hasNewSignature)
                  }
                >
                  อนุมัติ
                </Button>
              }
              title="ยืนยันการอนุมัติ"
              description="ต้องการอนุมัติคำขอนี้หรือไม่?"
              confirmLabel="อนุมัติ"
              onConfirm={() => handleAction("APPROVE")}
            />
            <ConfirmDialog
              trigger={
                <Button variant="outline" disabled={!canAct || processAction.isPending}>
                  ส่งกลับแก้ไข
                </Button>
              }
              title="ส่งกลับแก้ไข"
              description="ต้องการส่งกลับคำขอเพื่อแก้ไขหรือไม่?"
              confirmLabel="ส่งกลับ"
              onConfirm={() => handleAction("RETURN")}
            />
            <ConfirmDialog
              trigger={
                <Button variant="destructive" disabled={!canAct || processAction.isPending}>
                  ไม่อนุมัติ
                </Button>
              }
              title="ไม่อนุมัติคำขอ"
              description="ยืนยันการไม่อนุมัติคำขอนี้?"
              confirmLabel="ไม่อนุมัติ"
              onConfirm={() => handleAction("REJECT")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ลายเซ็นผู้อนุมัติ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="signature-mode"
                value="SAVED"
                checked={effectiveSignatureMode === "SAVED"}
                onChange={() => setSignatureMode("SAVED")}
                disabled={!hasSavedSignature}
              />
              ใช้ลายเซ็นที่บันทึกไว้
              {!hasSavedSignature && " (ยังไม่มีลายเซ็นในระบบ)"}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="signature-mode"
                value="NEW"
                checked={effectiveSignatureMode === "NEW"}
                onChange={() => setSignatureMode("NEW")}
              />
              ลงลายเซ็นใหม่
            </label>
          </div>

          {effectiveSignatureMode === "SAVED" ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              {hasSavedSignature
                ? "จะใช้ลายเซ็นที่บันทึกไว้"
                : "ยังไม่มีลายเซ็นในระบบ"}
            </div>
          ) : (
            <Card className="border-2 border-dashed border-muted-foreground/20 overflow-hidden">
              <CardContent className="p-0">
                <SignaturePad
                  onSave={(data) => setSignature(data)}
                  clearLabel="ล้างลายเซ็น"
                  placeholder="เซ็นชื่อในช่องนี้"
                />
              </CardContent>
            </Card>
          )}

          {effectiveSignatureMode === "SAVED" && signatureData?.data_url && (
            <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
              ลายเซ็นที่บันทึกไว้พร้อมใช้งาน
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        <Link href="/dashboard/pts-officer/verification" className="underline">
          กลับไปยังรายการคำขอ
        </Link>
      </div>
    </div>
  )
}
