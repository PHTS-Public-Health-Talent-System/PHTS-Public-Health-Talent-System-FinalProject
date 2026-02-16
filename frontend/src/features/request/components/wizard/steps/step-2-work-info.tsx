'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { RequestFormData } from '@/types/request.types';
import { FilePlus, Edit, RefreshCw, Briefcase, CheckCircle2 } from 'lucide-react';

interface Step2Props {
  data: RequestFormData;
  updateData: (key: keyof RequestFormData, value: unknown) => void;
}

export function Step2WorkInfo({ data, updateData }: Step2Props) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-primary">รายละเอียดการปฏิบัติงาน</h3>
        <p className="text-muted-foreground">ระบุประเภทคำขอและลักษณะงานที่รับผิดชอบ</p>
      </div>

      {/* Request Type Cards */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">ประเภทการยื่นคำขอ</Label>
        <RadioGroup
          value={data.requestType}
          onValueChange={(val) => updateData('requestType', val)}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {[
            { id: 'NEW', label: 'ยื่นคำขอใหม่', desc: 'สำหรับผู้ยื่นครั้งแรก', icon: FilePlus },
            {
              id: 'EDIT',
              label: 'แก้ไขข้อมูล',
              desc: 'ตำแหน่ง/สังกัดเปลี่ยน (อัตราเดิม)',
              icon: Edit,
            },
            {
              id: 'CHANGE_RATE',
              label: 'เปลี่ยนอัตรา',
              desc: 'ปรับเพิ่ม/ลด อัตราเงิน พ.ต.ส.',
              icon: RefreshCw,
            },
          ].map((option) => (
            <Label
              key={option.id}
              htmlFor={option.id}
              className={`relative flex flex-col items-center justify-center p-6 rounded-xl border-2 cursor-pointer transition-all hover:bg-accent/40 ${
                data.requestType === option.id
                  ? 'border-primary bg-primary/5 text-primary shadow-sm'
                  : 'border-muted bg-background text-muted-foreground hover:border-primary/50'
              }`}
            >
              <RadioGroupItem value={option.id} id={option.id} className="sr-only" />
              <option.icon
                className={`w-8 h-8 mb-3 ${data.requestType === option.id ? 'text-primary' : 'text-muted-foreground/70'}`}
              />
              <span className="font-semibold text-sm md:text-base">{option.label}</span>
              <span className="text-xs text-center mt-1 opacity-80 font-normal">{option.desc}</span>
              {data.requestType === option.id && (
                <div className="absolute top-3 right-3 text-primary animate-in zoom-in">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
            </Label>
          ))}
        </RadioGroup>
      </div>

      {/* Work Details */}
      <div className="grid gap-6 p-6 border rounded-xl bg-slate-50/50">
        <div className="space-y-2">
          <Label htmlFor="mission" className="font-medium flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" /> หน้าที่ความรับผิดชอบหลัก
          </Label>
          <Input
            id="mission"
            placeholder="เช่น ปฏิบัติการพยาบาลผู้ป่วยวิกฤต, ตรวจวิเคราะห์ทางห้องปฏิบัติการ"
            value={data.missionGroup}
            onChange={(e) => updateData('missionGroup', e.target.value)}
            className="h-12 bg-white"
          />
        </div>

        <div className="space-y-3">
          <Label className="font-medium text-base">ลักษณะงานที่ปฏิบัติ (มาตรฐาน 4 ด้าน)</Label>
          <p className="text-xs text-muted-foreground -mt-2 mb-2">
            ระบบกำหนดให้เลือกครบทั้ง 4 ด้านตามเกณฑ์มาตรฐาน
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                key: 'operation',
                label: 'งานปฏิบัติการ (Operation)',
                desc: 'ปฏิบัติงานเทคนิค/วิชาชีพโดยตรง',
              },
              { key: 'planning', label: 'งานวางแผน (Planning)', desc: 'วางแผนระบบงาน พัฒนาคุณภาพ' },
              {
                key: 'coordination',
                label: 'งานประสานงาน (Coordination)',
                desc: 'ประสานงานหน่วยงานภายใน/ภายนอก',
              },
              { key: 'service', label: 'งานบริการ (Service)', desc: 'ให้บริการวิชาการ/สนับสนุน' },
            ].map((attr) => (
              <div
                key={attr.key}
                className="flex items-start space-x-3 p-4 rounded-lg border bg-white shadow-sm opacity-80"
              >
                <Checkbox
                  id={`attr_${attr.key}`}
                  checked={true}
                  disabled
                  className="mt-1 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
                <div className="space-y-1">
                  <label
                    htmlFor={`attr_${attr.key}`}
                    className="text-sm font-semibold cursor-default block"
                  >
                    {attr.label}
                  </label>
                  <p className="text-xs text-muted-foreground">{attr.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
