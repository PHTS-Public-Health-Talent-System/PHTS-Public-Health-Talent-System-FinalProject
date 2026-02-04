"use client"

import { User, Briefcase, CreditCard, PenTool, AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useCheckSignature, useMySignature } from "@/features/signature/hooks"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

import SignaturePad from "@/components/common/signature-pad"
import { RequestFormData } from "@/types/request.types"
import { useEffect } from "react"

interface Step5Props {
  data: RequestFormData
  updateData: (key: keyof RequestFormData, value: unknown) => void
  onGoToStep?: (step: number) => void
  prefillOriginal?: {
    title?: string
    first_name?: string
    last_name?: string
    citizen_id?: string
    position_name?: string
    position_number?: string
    department?: string
    sub_department?: string
    employee_type?: string
    first_entry_date?: string
  } | null
}

const isChanged = (current?: string, original?: string) => {
  if (!original) return false
  return String(current ?? "").trim() !== String(original ?? "").trim()
}

export function Step5Review({ data, updateData, onGoToStep, prefillOriginal }: Step5Props) {
  const { data: signature, isLoading: isSignatureLoading } = useMySignature()
  const { data: signatureCheck } = useCheckSignature()
  const hasSavedSignature = !!signatureCheck?.has_signature
  const missing: { label: string; step: number }[] = []
  const hasAttachments =
    data.files.length > 0 ||
    (data.attachments ?? []).length > 0
  if (!hasAttachments) missing.push({ label: "เอกสารแนบ", step: 3 })
  if (!data.classification?.groupId || !data.classification?.itemId) {
    missing.push({ label: "กลุ่ม/รายการเบิก", step: 4 })
  }
  const signatureOk = data.signatureMode === "SAVED" ? hasSavedSignature : !!data.signature
  if (!signatureOk) missing.push({ label: "ลายเซ็น", step: 5 })

  useEffect(() => {
    if (data.signatureMode) return
    updateData("signatureMode", hasSavedSignature ? "SAVED" : "NEW")
  }, [hasSavedSignature, data.signatureMode, updateData])

  // Create labels for selected attributes
  const workAttributesLabel = Object.entries(data.workAttributes || {})
    .filter(([, value]) => value === true)
    .map(([key]) => {
      const labels: Record<string, string> = {
        operation: "งานปฏิบัติการ",
        planning: "งานวางแผน",
        coordination: "งานประสานงาน",
        service: "งานบริการ"
      }
      return labels[key]
    })

  const fullName = `${data.title} ${data.firstName} ${data.lastName}`.trim() || "-"
  const positionName = data.positionName || "-"
  const subDepartment = data.subDepartment || "-"
  const department = data.department || "-"
  const employeeType = data.employeeType || "-"
  const groupDisplay = data.classification?.groupId
    ? (data.classification.groupId.match(/\d+/)?.[0] ?? data.classification.groupId)
    : "-"
  const itemDisplay = data.classification?.itemId
    ? data.classification.itemId.replace("item", "").replace("_", ".")
    : "-"

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h3 className="text-lg font-medium text-primary">ตรวจสอบความถูกต้องและลงนาม</h3>
        <p className="text-sm text-muted-foreground">
          กรุณาตรวจสอบข้อมูลทั้งหมดอีกครั้งก่อนกดยืนยันการส่งคำขอ
        </p>
      </div>

      {missing.length > 0 && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-800" />
          <AlertDescription>
            ยังขาดข้อมูลสำคัญ: {missing.map((item) => item.label).join(", ")}{" "}
            กรุณาย้อนกลับไปกรอกให้ครบก่อนส่งคำขอ
            {onGoToStep && (
              <div className="mt-2 flex flex-wrap gap-2">
                {missing.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="text-xs underline underline-offset-2"
                    onClick={() => onGoToStep(item.step)}
                  >
                    ไปขั้นตอนที่ {item.step} ({item.label})
                  </button>
                ))}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Summary */}
        <div className="space-y-6">
          {/* Section 1 & 3: Personal & Dept Info */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <User className="h-4 w-4" /> <span>ข้อมูลผู้ยื่นและสังกัด</span>
            </div>
            <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-2 border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ชื่อ-นามสกุล:</span>
                <span className="font-medium">{fullName}</span>
              </div>
              {isChanged(fullName, prefillOriginal ? `${prefillOriginal.title ?? ""} ${prefillOriginal.first_name ?? ""} ${prefillOriginal.last_name ?? ""}`.trim() : "") && (
                <Badge variant="secondary" className="w-fit">แก้ไขจาก HRMS</Badge>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">เลขบัตรประชาชน:</span>
                <span className="font-medium">{data.citizenId || "-"}</span>
              </div>
              {isChanged(data.citizenId, prefillOriginal?.citizen_id) && (
                <Badge variant="secondary" className="w-fit">แก้ไขจาก HRMS</Badge>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">ตำแหน่ง:</span>
                <span className="font-medium">{positionName}</span>
              </div>
              {isChanged(positionName, prefillOriginal?.position_name) && (
                <Badge variant="secondary" className="w-fit">แก้ไขจาก HRMS</Badge>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">เลขตำแหน่ง:</span>
                <span className="font-medium">{data.positionNumber || "-"}</span>
              </div>
              {isChanged(data.positionNumber, prefillOriginal?.position_number) && (
                <Badge variant="secondary" className="w-fit">แก้ไขจาก HRMS</Badge>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">หน่วยงาน:</span>
                <span className="font-medium">{subDepartment}</span>
              </div>
              {isChanged(subDepartment, prefillOriginal?.sub_department) && (
                <Badge variant="secondary" className="w-fit">แก้ไขจาก HRMS</Badge>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">กลุ่มงาน:</span>
                <span className="font-medium">{department}</span>
              </div>
              {isChanged(department, prefillOriginal?.department) && (
                <Badge variant="secondary" className="w-fit">แก้ไขจาก HRMS</Badge>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">ประเภทบุคลากร:</span>
                <span className="font-medium">{employeeType}</span>
              </div>
              {isChanged(employeeType, prefillOriginal?.employee_type) && (
                <Badge variant="secondary" className="w-fit">แก้ไขจาก HRMS</Badge>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">ปฏิบัติงานในราชการ:</span>
                <span className="font-medium">
                  {data.employmentRegion === "REGIONAL" ? "ส่วนภูมิภาค" : "ส่วนกลาง"}
                </span>
              </div>
            </div>
          </section>

          {/* Section 4: Work Details */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Briefcase className="h-4 w-4" /> <span>รายละเอียดงาน</span>
            </div>
            <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-3 border">
              <div>
                <p className="text-muted-foreground mb-1">หน้าที่ความรับผิดชอบหลัก:</p>
                <p className="font-medium">{data.missionGroup || "-"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {workAttributesLabel.length > 0 ? workAttributesLabel.map(label => (
                  <Badge key={label} variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    {label}
                  </Badge>
                )) : <span className="text-muted-foreground text-xs text-italic">ไม่ได้ระบุลักษณะงาน</span>}
              </div>
            </div>
          </section>

          {/* Section 6: Requested Amount */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <CreditCard className="h-4 w-4" /> <span>อัตราเงิน พ.ต.ส. ที่ขอเบิก</span>
            </div>
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
               <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">จำนวนเงินสุทธิ</p>
                  <p className="text-3xl font-bold text-primary">{data.classification?.amount?.toLocaleString() || 0} บาท</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    กลุ่ม {groupDisplay} | ข้อ {itemDisplay}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    วันที่มีผล: {data.effectiveDate || "-"}
                  </p>
               </div>
            </div>
          </section>
        </div>

        {/* Right Column: Signature (Section 7) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <PenTool className="h-4 w-4" /> <span>ลงลายมือชื่ออิเล็กทรอนิกส์</span>
          </div>

          <div className="space-y-3">
            <RadioGroup
              value={data.signatureMode ?? "NEW"}
              onValueChange={(val) => updateData("signatureMode", val)}
              className="grid gap-3"
            >
              <div className="flex items-center space-x-2 border p-3 rounded-lg">
                <RadioGroupItem value="SAVED" id="sig-saved" disabled={!signatureCheck?.has_signature} />
                <Label htmlFor="sig-saved">
                  ใช้ลายเซ็นที่บันทึกไว้
                  {!signatureCheck?.has_signature && " (ยังไม่มีลายเซ็นในระบบ)"}
                </Label>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-lg">
                <RadioGroupItem value="NEW" id="sig-new" />
                <Label htmlFor="sig-new">ลงลายเซ็นใหม่สำหรับคำขอนี้</Label>
              </div>
            </RadioGroup>

            {data.signatureMode === "SAVED" && (
              <Card className="border">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  {isSignatureLoading ? "กำลังโหลดลายเซ็น..." : signature?.data_url ? "จะใช้ลายเซ็นที่บันทึกไว้" : "ยังไม่มีลายเซ็นในระบบ"}
                </CardContent>
              </Card>
            )}

            {data.signatureMode !== "SAVED" && (
              <Card className="border-2 border-dashed border-muted-foreground/20 overflow-hidden">
                <CardContent className="p-0">
                   <SignaturePad
                     onSave={(signatureData) => {
                       updateData("signatureMode", "NEW")
                       updateData("signature", signatureData)
                     }}
                     clearLabel="ล้างลายเซ็น"
                     placeholder="เซ็นชื่อในช่องนี้"
                   />
                </CardContent>
              </Card>
            )}

            {data.signatureMode !== "SAVED" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  id="saveSignature"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={data.saveSignature ?? true}
                  onChange={(e) => updateData("saveSignature", e.target.checked)}
                />
                <Label htmlFor="saveSignature">บันทึกลายเซ็นนี้ไว้ใช้ครั้งถัดไป</Label>
              </div>
            )}
          </div>

          <Alert className="bg-yellow-50 border-yellow-100 text-yellow-800">
             <AlertDescription className="text-xs">
                ข้าพเจ้าขอรับรองว่าข้อความข้างต้นเป็นความจริงทุกประการ และเอกสารที่แนบมาเป็นเอกสารที่ถูกต้องสมบูรณ์
             </AlertDescription>
          </Alert>

          <Alert className="bg-amber-50 border-amber-200 text-amber-800">
            <AlertDescription className="text-xs">
              คำเตือน: หากมีการเปลี่ยนแปลงตำแหน่งหรือหน่วยงาน ผู้มีสิทธิ์ต้องแจ้งให้ HR เพื่อแก้ไขข้อมูลสิทธิให้ถูกต้องและเป็นปัจจุบัน
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  )
}
