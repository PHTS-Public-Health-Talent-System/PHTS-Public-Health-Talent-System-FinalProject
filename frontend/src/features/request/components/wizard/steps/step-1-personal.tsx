'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Briefcase, MapPin, Database } from 'lucide-react';
import { RequestFormData, PERSONNEL_TYPE_LABELS } from '@/types/request.types';

interface Step1Props {
  data: RequestFormData;
  updateData: (key: keyof RequestFormData, value: unknown) => void;
  prefillOriginal?: {
    title?: string;
    first_name?: string;
    last_name?: string;
    citizen_id?: string;
    position_name?: string;
    position_number?: string;
    department?: string;
    sub_department?: string;
    employee_type?: string;
    first_entry_date?: string;
  } | null;
}

const isChanged = (current?: string, original?: string) => {
  if (!original) return false;
  return String(current ?? '').trim() !== String(original ?? '').trim();
};

export function Step1PersonalInfo({ data, updateData, prefillOriginal }: Step1Props) {
  const showSkeleton =
    !data.firstName &&
    !data.lastName &&
    !data.positionName &&
    !data.department &&
    !data.subDepartment &&
    !data.citizenId;

  if (showSkeleton) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-primary">ข้อมูลผู้ยื่นคำขอ</h3>
        <p className="text-muted-foreground">กรุณาตรวจสอบและแก้ไขข้อมูลส่วนตัวให้ถูกต้อง</p>
      </div>

      <div className="grid gap-6">
        {/* 1. ข้อมูลส่วนตัว */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary/80 font-medium pb-2 border-b">
            <User className="w-5 h-5" /> ข้อมูลพื้นฐาน
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="title">คำนำหน้า</Label>
              <Input
                id="title"
                value={data.title}
                onChange={(e) => updateData('title', e.target.value)}
                placeholder="นาย/นาง/นางสาว"
              />
            </div>
            <div className="md:col-span-5 space-y-2">
              <Label htmlFor="firstName">ชื่อ</Label>
              <div className="relative">
                <Input
                  id="firstName"
                  value={data.firstName}
                  onChange={(e) => updateData('firstName', e.target.value)}
                />
                {isChanged(data.firstName, prefillOriginal?.first_name) && (
                  <Badge variant="secondary" className="absolute right-2 top-2 text-[10px] h-5">
                    แก้ไข
                  </Badge>
                )}
              </div>
            </div>
            <div className="md:col-span-5 space-y-2">
              <Label htmlFor="lastName">นามสกุล</Label>
              <div className="relative">
                <Input
                  id="lastName"
                  value={data.lastName}
                  onChange={(e) => updateData('lastName', e.target.value)}
                />
                {isChanged(data.lastName, prefillOriginal?.last_name) && (
                  <Badge variant="secondary" className="absolute right-2 top-2 text-[10px] h-5">
                    แก้ไข
                  </Badge>
                )}
              </div>
            </div>
            <div className="md:col-span-6 space-y-2">
              <Label htmlFor="citizenId">เลขบัตรประชาชน</Label>
              <Input
                id="citizenId"
                value={data.citizenId}
                onChange={(e) => updateData('citizenId', e.target.value)}
                className="font-mono tracking-wide"
              />
            </div>
            <div className="md:col-span-12 space-y-3 pt-2">
              <Label>ประเภทบุคลากร</Label>
              <RadioGroup
                value={data.employeeType}
                onValueChange={(val) => updateData('employeeType', val)}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
              >
                {Object.entries(PERSONNEL_TYPE_LABELS).map(([key, label]) => (
                  <Label
                    key={key}
                    htmlFor={`emp-${key}`}
                    className={`flex items-center space-x-3 border p-3 rounded-lg cursor-pointer transition-all hover:bg-accent/50 ${
                      data.employeeType === key
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border'
                    }`}
                  >
                    <RadioGroupItem value={key} id={`emp-${key}`} className="text-primary" />
                    <span className="text-sm font-medium">{label}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          </div>
        </section>

        {/* 2. ตำแหน่งและสังกัด */}
        <section className="space-y-4 pt-4">
          <div className="flex items-center gap-2 text-primary/80 font-medium pb-2 border-b">
            <Briefcase className="w-5 h-5" /> ตำแหน่งและสังกัด
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="positionName">ตำแหน่ง</Label>
              <Input
                id="positionName"
                value={data.positionName}
                onChange={(e) => updateData('positionName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="positionNumber">เลขตำแหน่ง</Label>
              <Input
                id="positionNumber"
                value={data.positionNumber}
                onChange={(e) => updateData('positionNumber', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">กลุ่มงาน</Label>
              <Input
                id="department"
                value={data.department}
                onChange={(e) => updateData('department', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subDepartment">หน่วยงาน</Label>
              <Input
                id="subDepartment"
                value={data.subDepartment}
                onChange={(e) => updateData('subDepartment', e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* 3. พื้นที่ปฏิบัติงาน */}
        <section className="space-y-4 pt-4">
          <div className="flex items-center gap-2 text-primary/80 font-medium pb-2 border-b">
            <MapPin className="w-5 h-5" /> พื้นที่ปฏิบัติงาน
          </div>
          <RadioGroup
            value={data.employmentRegion}
            onValueChange={(val) => updateData('employmentRegion', val)}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <label
              htmlFor="region-central"
              className={`flex items-center space-x-3 border p-4 rounded-xl cursor-pointer transition-all ${data.employmentRegion === 'CENTRAL' ? 'border-primary bg-primary/5' : 'opacity-60 grayscale'}`}
            >
              <RadioGroupItem value="CENTRAL" id="region-central" disabled />
              <div className="space-y-1">
                <span className="font-semibold block">ส่วนกลาง</span>
                <span className="text-xs text-muted-foreground block">
                  ปฏิบัติงานในหน่วยงานส่วนกลาง
                </span>
              </div>
            </label>

            <label
              htmlFor="region-regional"
              className={`flex items-center space-x-3 border p-4 rounded-xl cursor-pointer transition-all ${data.employmentRegion === 'REGIONAL' ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`}
            >
              <RadioGroupItem value="REGIONAL" id="region-regional" disabled />
              <div className="space-y-1">
                <span className="font-semibold block">ส่วนภูมิภาค</span>
                <span className="text-xs text-muted-foreground block">
                  โรงพยาบาลอุตรดิตถ์ (ค่าเริ่มต้น)
                </span>
              </div>
            </label>
          </RadioGroup>
        </section>
      </div>

      <Alert className="bg-blue-50 border-blue-100 text-blue-800 mt-6">
        <Database className="h-4 w-4" />
        <AlertDescription>
          ข้อมูลเบื้องต้นถูกดึงมาจากฐานข้อมูล HRMS หากพบข้อมูลไม่ถูกต้อง ท่านสามารถแก้ไขได้ในหน้านี้
        </AlertDescription>
      </Alert>
    </div>
  );
}
