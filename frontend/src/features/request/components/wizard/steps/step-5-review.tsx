'use client';

import {
  User,
  Briefcase,
  CreditCard,
  PenTool,
  AlertTriangle,
  FileCheck,
  ShieldCheck,
} from 'lucide-react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCheckSignature, useMySignature } from '@/features/signature/hooks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import SignaturePad from '@/components/common/signature-pad';
import { RequestFormData, PERSONNEL_TYPE_LABELS } from '@/types/request.types';
import { useEffect } from 'react';
import { formatThaiNumber } from '@/shared/utils/thai-locale';

interface Step5Props {
  data: RequestFormData;
  updateData: (key: keyof RequestFormData, value: unknown) => void;
  onGoToStep?: (step: number) => void;
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

export function Step5Review({ data, updateData, onGoToStep, prefillOriginal }: Step5Props) {
  const { data: signature, isLoading: isSignatureLoading } = useMySignature();
  const { data: signatureCheck } = useCheckSignature();
  const hasSavedSignature = !!signatureCheck?.has_signature;

  const missing: { label: string; step: number }[] = [];
  const hasAttachments = data.files.length > 0 || (data.attachments ?? []).length > 0;

  if (!hasAttachments) missing.push({ label: 'เอกสารแนบ', step: 3 });
  if (!data.rateMapping?.groupId || !data.rateMapping?.itemId) {
    missing.push({ label: 'กลุ่ม/รายการเบิก', step: 4 });
  }

  const signatureOk = data.signatureMode === 'SAVED' ? hasSavedSignature : !!data.signature;
  if (!signatureOk) missing.push({ label: 'ลายเซ็น', step: 5 });

  useEffect(() => {
    if (data.signatureMode) return;
    updateData('signatureMode', hasSavedSignature ? 'SAVED' : 'NEW');
  }, [hasSavedSignature, data.signatureMode, updateData]);

  // Create labels for selected attributes
  const workAttributesLabel = Object.entries(data.workAttributes || {})
    .filter(([, value]) => value === true)
    .map(([key]) => {
      const labels: Record<string, string> = {
        operation: 'งานปฏิบัติการ',
        planning: 'งานวางแผน',
        coordination: 'งานประสานงาน',
        service: 'งานบริการ',
      };
      return labels[key];
    });

  const fullName = `${data.title} ${data.firstName} ${data.lastName}`.trim() || '-';
  const positionName = data.positionName || '-';
  const subDepartment = data.subDepartment || '-';
  const department = data.department || '-';
  const employeeTypeLabel = data.employeeType ? PERSONNEL_TYPE_LABELS[data.employeeType] : '-';

  const groupDisplay = data.rateMapping?.groupId
    ? (data.rateMapping.groupId.match(/\d+/)?.[0] ?? data.rateMapping.groupId)
    : '-';
  const itemDisplay = data.rateMapping?.itemId
    ? data.rateMapping.itemId === '__NONE__'
      ? '-'
      : data.rateMapping.itemId.replace('item', '').replace('_', '.')
    : '-';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-primary">ตรวจสอบความถูกต้องและลงนาม</h3>
        <p className="text-muted-foreground">
          กรุณาตรวจสอบข้อมูลทั้งหมดอีกครั้งก่อนกดยืนยันการส่งคำขอ
        </p>
      </div>

      {missing.length > 0 && (
        <Alert className="bg-destructive/5 border-destructive/20 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-semibold">ข้อมูลยังไม่ครบถ้วน:</span>{' '}
            {missing.map((item) => item.label).join(', ')}
            {onGoToStep && (
              <div className="mt-2 flex flex-wrap gap-2">
                {missing.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="text-xs font-medium underline underline-offset-2 hover:text-destructive/80"
                    onClick={() => onGoToStep(item.step)}
                  >
                    กลับไปแก้ไข {item.label}
                  </button>
                ))}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 md:grid-cols-12">
        {/* Left Column: Summary */}
        <div className="md:col-span-7 lg:col-span-8 space-y-6">
          {/* Section 1: Personal & Dept Info */}
          <Card className="border border-border/60 shadow-sm overflow-hidden">
            <div className="bg-secondary/30 p-4 border-b border-border/60 flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">ข้อมูลผู้ยื่นและสังกัด</h4>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <span className="block text-muted-foreground text-xs mb-1">ชื่อ-นามสกุล</span>
                <div className="font-medium flex items-center gap-2">
                  {fullName}
                  {isChanged(
                    fullName,
                    prefillOriginal
                      ? `${prefillOriginal.title ?? ''} ${prefillOriginal.first_name ?? ''} ${prefillOriginal.last_name ?? ''}`.trim()
                      : '',
                  ) && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      แก้ไข
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <span className="block text-muted-foreground text-xs mb-1">เลขบัตรประชาชน</span>
                <div className="font-medium flex items-center gap-2">
                  {data.citizenId || '-'}
                  {isChanged(data.citizenId, prefillOriginal?.citizen_id) && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      แก้ไข
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <span className="block text-muted-foreground text-xs mb-1">ตำแหน่ง</span>
                <div className="font-medium flex items-center gap-2">
                  {positionName}
                  {isChanged(positionName, prefillOriginal?.position_name) && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      แก้ไข
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <span className="block text-muted-foreground text-xs mb-1">เลขตำแหน่ง</span>
                <div className="font-medium flex items-center gap-2">
                  {data.positionNumber || '-'}
                  {isChanged(data.positionNumber, prefillOriginal?.position_number) && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      แก้ไข
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <span className="block text-muted-foreground text-xs mb-1">หน่วยงาน</span>
                <div className="font-medium flex items-center gap-2">
                  {subDepartment}
                  {isChanged(subDepartment, prefillOriginal?.sub_department) && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      แก้ไข
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <span className="block text-muted-foreground text-xs mb-1">กลุ่มงาน</span>
                <div className="font-medium flex items-center gap-2">
                  {department}
                  {isChanged(department, prefillOriginal?.department) && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      แก้ไข
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <span className="block text-muted-foreground text-xs mb-1">ประเภทบุคลากร</span>
                <div className="font-medium flex items-center gap-2">
                  {employeeTypeLabel}
                  {isChanged(employeeTypeLabel, prefillOriginal?.employee_type) && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      แก้ไข
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <span className="block text-muted-foreground text-xs mb-1">ปฏิบัติงานในราชการ</span>
                <div className="font-medium">
                  {data.employmentRegion === 'REGIONAL' ? 'ส่วนภูมิภาค' : 'ส่วนกลาง'}
                </div>
              </div>
            </div>
          </Card>

          {/* Section 2: Work Details */}
          <Card className="border border-border/60 shadow-sm overflow-hidden">
            <div className="bg-secondary/30 p-4 border-b border-border/60 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">รายละเอียดงาน</h4>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-muted-foreground text-xs mb-1">หน้าที่ความรับผิดชอบหลัก</p>
                <p className="font-medium">{data.missionGroup || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-2">ลักษณะงานที่ปฏิบัติ</p>
                <div className="flex flex-wrap gap-2">
                  {workAttributesLabel.length > 0 ? (
                    workAttributesLabel.map((label) => (
                      <Badge
                        key={label}
                        variant="outline"
                        className="bg-primary/5 text-primary border-primary/20"
                      >
                        {label}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm italic">
                      ไม่ได้ระบุลักษณะงาน
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Section 3: Requested Amount */}
          <Card className="border border-primary/20 bg-primary/5 shadow-sm overflow-hidden">
            <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-primary">อัตราเงิน พ.ต.ส. ที่ขอเบิก</h4>
                  <p className="text-sm text-muted-foreground">
                    กลุ่ม {groupDisplay} | ข้อ {itemDisplay}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary tabular-nums">
                  {formatThaiNumber(data.rateMapping?.amount ?? 0)}{' '}
                  <span className="text-sm font-normal text-muted-foreground">บาท</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  วันที่มีผล: {data.effectiveDate || '-'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Signature */}
        <div className="md:col-span-5 lg:col-span-4 space-y-6">
          <div className="space-y-4 sticky top-6">
            <Card className="border-border shadow-md overflow-hidden">
              <div className="bg-secondary/80 p-4 border-b border-border/60 flex items-center gap-2">
                <PenTool className="h-5 w-5 text-foreground" />
                <h4 className="font-semibold text-foreground">ลงลายมือชื่อ</h4>
              </div>
              <div className="p-4 space-y-4">
                <Tabs
                  value={data.signatureMode ?? (hasSavedSignature ? 'SAVED' : 'NEW')}
                  onValueChange={(val) => updateData('signatureMode', val)}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger
                      value="SAVED"
                      disabled={!hasSavedSignature}
                      className="data-[state=active]:border data-[state=active]:border-primary/25 data-[state=active]:shadow-none"
                    >
                      ลายเซ็นเดิม
                    </TabsTrigger>
                    <TabsTrigger
                      value="NEW"
                      className="data-[state=active]:border data-[state=active]:border-primary/25 data-[state=active]:shadow-none"
                    >
                      เซ็นใหม่
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="SAVED" className="mt-0">
                    <div className="rounded-lg border border-border/60 bg-muted/10 p-6 flex flex-col items-center justify-center min-h-[160px]">
                      {isSignatureLoading ? (
                        <div className="text-sm text-muted-foreground animate-pulse">
                          กำลังโหลด...
                        </div>
                      ) : signature?.data_url ? (
                        <Image
                          src={signature.data_url}
                          alt="ลายเซ็น"
                          width={200}
                          height={100}
                          className="max-h-[100px] w-auto object-contain"
                          unoptimized
                        />
                      ) : (
                        <div className="text-sm text-muted-foreground text-center">
                          ไม่พบลายเซ็นในระบบ
                          <br />
                          กรุณาเลือก &quot;เซ็นใหม่&quot;
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      <ShieldCheck className="w-3 h-3 inline mr-1" />
                      ยืนยันตัวตนด้วยลายเซ็นดิจิทัล
                    </p>
                  </TabsContent>

                  <TabsContent value="NEW" className="mt-0">
                    <div className="rounded-lg border border-border/60 bg-muted/5 p-3">
                      <SignaturePad
                        onSave={(signatureData: string) => {
                          updateData('signatureMode', 'NEW');
                          updateData('signature', signatureData);
                        }}
                        clearLabel="ล้าง"
                        placeholder="เซ็นชื่อที่นี่"
                        className="space-y-3"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </Card>

            <Alert className="bg-amber-50 border-amber-200 text-amber-900">
              <FileCheck className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs leading-relaxed">
                ข้าพเจ้าขอรับรองว่าข้อมูลข้างต้นเป็นความจริงทุกประการ และเอกสารแนบถูกต้องสมบูรณ์
                หากมีการเปลี่ยนแปลงใดๆ จะแจ้งให้ทราบทันที
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
}
