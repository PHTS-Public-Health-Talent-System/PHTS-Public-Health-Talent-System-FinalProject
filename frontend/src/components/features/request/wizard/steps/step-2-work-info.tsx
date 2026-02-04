"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent } from "@/components/ui/card"
import { RequestFormData } from "@/types/request.types"
import { usePrefill } from "@/features/request/hooks"

interface Step2Props {
  data: RequestFormData
  updateData: (key: keyof RequestFormData, value: unknown) => void
}

export function Step2WorkInfo({ data, updateData }: Step2Props) {
  const { data: prefill } = usePrefill()

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h3 className="text-lg font-medium text-primary">รายละเอียดการปฏิบัติงาน</h3>
        <p className="text-sm text-muted-foreground">
          กรุณาระบุลักษณะงานที่ท่านรับผิดชอบเพื่อใช้ประกอบการพิจารณา
        </p>
      </div>

      {/* Section 1: Request Type */}
      <Card className="border border-muted shadow-sm">
        <CardContent className="pt-6">
          <Label className="text-base mb-4 block font-semibold">ประเภทการยื่นคำขอ</Label>
          <RadioGroup
            value={data.requestType}
            onValueChange={(val) => updateData("requestType", val)}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <Label
              htmlFor="new"
              className={`flex items-center space-x-3 border p-4 rounded-xl cursor-pointer transition-all hover:bg-accent/50 ${
                data.requestType === "NEW"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border"
              }`}
            >
              <RadioGroupItem value="NEW" id="new" />
              <span className="font-medium">ยื่นคำขอใหม่</span>
            </Label>

            <Label
              htmlFor="edit"
              className={`flex items-center space-x-3 border p-4 rounded-xl cursor-pointer transition-all hover:bg-accent/50 ${
                data.requestType === "EDIT"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border"
              }`}
            >
              <RadioGroupItem value="EDIT" id="edit" />
              <span className="font-medium">แก้ไขข้อมูล (อัตราเดิม)</span>
            </Label>

            <Label
              htmlFor="change"
              className={`flex items-center space-x-3 border p-4 rounded-xl cursor-pointer transition-all hover:bg-accent/50 ${
                data.requestType === "CHANGE_RATE"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border"
              }`}
            >
              <RadioGroupItem value="CHANGE_RATE" id="change" />
              <span className="font-medium">แก้ไข (เปลี่ยนอัตรา)</span>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Section 4: Work Details */}
      <div className="space-y-4">
        {prefill?.department && (
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            สังกัดจากระบบบุคลากร: {prefill.department}
            {prefill.sub_department ? ` / ${prefill.sub_department}` : ""}
          </div>
        )}
        {/* Mission Group */}
        <div className="space-y-2">
          <Label htmlFor="mission" className="font-medium">หน้าที่ความรับผิดชอบหลัก (Mission Group)</Label>
          <Input
            id="mission"
            placeholder="เช่น ให้การพยาบาลผู้ป่วยวิกฤต, ตรวจวิเคราะห์สิ่งส่งตรวจ"
            value={data.missionGroup}
            onChange={(e) => updateData("missionGroup", e.target.value)}
            className="h-12"
          />
        </div>

        {/* Work Attributes Checkboxes */}
        <div className="space-y-3">
          <Label className="font-medium text-base text-muted-foreground">ลักษณะงานที่ปฏิบัติ (กำหนดเป็นมาตรฐาน 4 ข้อ)</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-80 pointer-events-none">
            <Label
              htmlFor="attr_ops"
              className={`flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4 shadow-sm transition-all ${
                data.workAttributes.operation ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
              }`}
            >
              <Checkbox
                id="attr_ops"
                checked={true}
                disabled
              />
              <div className="space-y-1 leading-none">
                <span className="font-semibold block">งานปฏิบัติการ (Operation)</span>
                <p className="text-sm text-muted-foreground">
                  ปฏิบัติงานเทคนิค/วิชาชีพโดยตรงกับผู้ป่วย
                </p>
              </div>
            </Label>

            <Label
              htmlFor="attr_plan"
              className={`flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4 shadow-sm transition-all ${
                data.workAttributes.planning ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
              }`}
            >
              <Checkbox
                id="attr_plan"
                checked={true}
                disabled
              />
              <div className="space-y-1 leading-none">
                <span className="font-semibold block">งานวางแผน (Planning)</span>
                <p className="text-sm text-muted-foreground">
                  วางแผนระบบงาน พัฒนาคุณภาพ หรือนโยบาย
                </p>
              </div>
            </Label>

            <Label
              htmlFor="attr_coord"
              className={`flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4 shadow-sm transition-all ${
                data.workAttributes.coordination ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
              }`}
            >
              <Checkbox
                id="attr_coord"
                checked={true}
                disabled
              />
              <div className="space-y-1 leading-none">
                <span className="font-semibold block">งานประสานงาน (Coordination)</span>
                <p className="text-sm text-muted-foreground">
                  ประสานงานกับหน่วยงานภายในและภายนอก
                </p>
              </div>
            </Label>

            <Label
              htmlFor="attr_service"
              className={`flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4 shadow-sm transition-all ${
                data.workAttributes.service ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
              }`}
            >
              <Checkbox
                id="attr_service"
                checked={true}
                disabled
              />
              <div className="space-y-1 leading-none">
                <span className="font-semibold block">งานบริการ (Service)</span>
                <p className="text-sm text-muted-foreground">
                  ให้บริการวิชาการ หรือสนับสนุนบริการทางการแพทย์
                </p>
              </div>
            </Label>
          </div>
        </div>
      </div>
    </div>
  )
}
