"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { RequestFormData, PERSONNEL_TYPE_LABELS } from "@/types/request.types"

interface Step1Props {
  data: RequestFormData
  updateData: (key: keyof RequestFormData, value: unknown) => void
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

export function Step1PersonalInfo({ data, updateData, prefillOriginal }: Step1Props) {
  const showSkeleton =
    !data.firstName &&
    !data.lastName &&
    !data.positionName &&
    !data.department &&
    !data.subDepartment &&
    !data.citizenId

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-medium">ข้อมูลผู้ยื่นคำขอ</h3>
        <p className="text-sm text-muted-foreground">
          ระบบเติมข้อมูลให้อัตโนมัติจาก HRMS แต่สามารถแก้ไขได้ตามจริง
        </p>
      </div>
      <Separator />

      {showSkeleton ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* คำนำหน้า */}
          <div className="space-y-2">
            <Label>คำนำหน้า</Label>
            <Input
              value={data.title}
              onChange={(e) => updateData("title", e.target.value)}
              placeholder="เช่น นาย, นาง, นางสาว"
            />
            {isChanged(data.title, prefillOriginal?.title) && (
              <Badge variant="secondary">แก้ไขจาก HRMS</Badge>
            )}
          </div>

          {/* ชื่อ */}
          <div className="space-y-2">
            <Label>ชื่อ</Label>
            <Input
              value={data.firstName}
              onChange={(e) => updateData("firstName", e.target.value)}
              placeholder="ชื่อจริง"
            />
            {isChanged(data.firstName, prefillOriginal?.first_name) && (
              <Badge variant="secondary">แก้ไขจาก HRMS</Badge>
            )}
          </div>

          {/* นามสกุล */}
          <div className="space-y-2">
            <Label>นามสกุล</Label>
            <Input
              value={data.lastName}
              onChange={(e) => updateData("lastName", e.target.value)}
              placeholder="นามสกุล"
            />
            {isChanged(data.lastName, prefillOriginal?.last_name) && (
              <Badge variant="secondary">แก้ไขจาก HRMS</Badge>
            )}
          </div>

          {/* เลขบัตรประชาชน */}
          <div className="space-y-2">
            <Label>เลขบัตรประชาชน</Label>
            <Input
              value={data.citizenId}
              onChange={(e) => updateData("citizenId", e.target.value)}
            />
            {isChanged(data.citizenId, prefillOriginal?.citizen_id) && (
              <Badge variant="secondary">แก้ไขจาก HRMS</Badge>
            )}
          </div>

          {/* ประเภทบุคลากร */}
          <div className="space-y-2 md:col-span-2">
            <Label>ประเภทบุคลากร</Label>
            <RadioGroup
              value={data.employeeType}
              onValueChange={(val) => updateData("employeeType", val)}
              className="grid grid-cols-1 md:grid-cols-4 gap-4"
            >
              {Object.entries(PERSONNEL_TYPE_LABELS).map(([key, label]) => (
                <Label
                  key={key}
                  htmlFor={`emp-${key}`}
                  className={`flex items-center space-x-2 border p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent/50 ${
                    data.employeeType === key ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <RadioGroupItem value={key} id={`emp-${key}`} />
                  <span>{label}</span>
                </Label>
              ))}
            </RadioGroup>
            {isChanged(data.employeeType, prefillOriginal?.employee_type) && (
              <Badge variant="secondary">แก้ไขจาก HRMS</Badge>
            )}
          </div>

          {/* ตำแหน่ง + เลขตำแหน่ง */}
          <div className="space-y-2">
            <Label>ตำแหน่ง</Label>
            <Input
              value={data.positionName}
              onChange={(e) => updateData("positionName", e.target.value)}
            />
            {isChanged(data.positionName, prefillOriginal?.position_name) && (
              <Badge variant="secondary">แก้ไขจาก HRMS</Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label>เลขตำแหน่ง</Label>
            <Input
              value={data.positionNumber}
              onChange={(e) => updateData("positionNumber", e.target.value)}
            />
            {isChanged(data.positionNumber, prefillOriginal?.position_number) && (
              <Badge variant="secondary">แก้ไขจาก HRMS</Badge>
            )}
          </div>

          {/* สังกัด/หน่วยงาน */}
          <div className="space-y-2">
            <Label>กลุ่มงาน (Department)</Label>
            <Input
              value={data.department}
              onChange={(e) => updateData("department", e.target.value)}
            />
            {isChanged(data.department, prefillOriginal?.department) && (
              <Badge variant="secondary">แก้ไขจาก HRMS</Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label>หน่วยงาน (Sub-Department)</Label>
            <Input
              value={data.subDepartment}
              onChange={(e) => updateData("subDepartment", e.target.value)}
            />
            {isChanged(data.subDepartment, prefillOriginal?.sub_department) && (
              <Badge variant="secondary">แก้ไขจาก HRMS</Badge>
            )}
          </div>

          {/* ส่วนกลาง/ส่วนภูมิภาค */}
          <div className="space-y-2 md:col-span-2">
            <Label>ปฏิบัติงานในราชการ</Label>
            <RadioGroup value={data.employmentRegion} className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2 border p-3 rounded-lg opacity-60">
                <RadioGroupItem value="CENTRAL" id="region-central" disabled />
                <Label htmlFor="region-central">ส่วนกลาง</Label>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-lg">
                <RadioGroupItem value="REGIONAL" id="region-regional" disabled />
                <Label htmlFor="region-regional">ส่วนภูมิภาค (ล็อคตามนโยบาย)</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mt-4">
        <p className="text-sm text-blue-800">
          ℹ️ ข้อมูลส่วนใหญ่ถูกดึงจาก HRMS และสามารถแก้ไขได้หากมีความคลาดเคลื่อน
        </p>
      </div>
    </div>
  )
}
