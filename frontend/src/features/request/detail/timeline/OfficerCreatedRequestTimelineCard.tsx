'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RequestWithDetails } from '@/types/request.types';
import { formatThaiDateTime } from '@/features/request/detail/utils';
import { TimelineStepItem } from './TimelineStepItem';

type OfficerCreatedStepState = 'approved' | 'pending' | 'waiting';

type OfficerCreatedStep = {
  key: string;
  label: string;
  description: string;
  status: OfficerCreatedStepState;
  at?: string | null;
};

const buildOfficerCreatedSteps = (request: RequestWithDetails): OfficerCreatedStep[] => {
  const submitAction = (request.actions ?? []).find((action) => action.action === 'SUBMIT');
  const createdAt = request.created_at ?? null;
  const submittedAt = submitAction?.action_date ?? null;
  const completedAt = request.updated_at ?? null;

  const isDraft = request.status === 'DRAFT';
  const isSubmitted = request.status !== 'DRAFT' && request.status !== 'CANCELLED';
  const isCompleted = request.status === 'APPROVED';

  return [
    {
      key: 'draft',
      label: 'บันทึกคำขอแทนบุคลากร',
      description: 'เจ้าหน้าที่ พ.ต.ส. จัดทำคำขอจากข้อมูลบุคลากรในระบบ',
      status: isDraft ? 'pending' : 'approved',
      at: createdAt,
    },
    {
      key: 'submit',
      label: 'ส่งคำขอโดยเจ้าหน้าที่ พ.ต.ส.',
      description: 'คำขอถูกส่งเข้าสู่ระบบโดยไม่ผ่านสายอนุมัติปกติ',
      status: isSubmitted ? 'approved' : 'waiting',
      at: submittedAt,
    },
    {
      key: 'approved',
      label: 'อนุมัติแล้ว',
      description: 'สิทธิถูกสร้างและพร้อมใช้งานในระบบผู้มีสิทธิ',
      status: isCompleted ? 'approved' : isSubmitted ? 'pending' : 'waiting',
      at: isCompleted ? completedAt : null,
    },
  ];
};

export function OfficerCreatedRequestTimelineCard({ request }: { request: RequestWithDetails }) {
  const steps = buildOfficerCreatedSteps(request);

  // คำนวณขั้นตอนปัจจุบันเพื่อนำไปแสดงใน Badge
  const pendingIndex = steps.findIndex((step) => step.status === 'pending');
  const currentStepDisplayIndex = pendingIndex >= 0 ? pendingIndex + 1 : steps.length;
  const isAllApproved = steps.every((step) => step.status === 'approved');

  return (
    <Card className="shadow-sm border-slate-200 overflow-hidden bg-white">
      {/* Header สไตล์ Enterprise UI (ตรงกับ ApprovalTimelineCard) */}
      <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50 px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2.5 tracking-tight">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
              <Clock className="w-4 h-4" />
            </div>
            ลำดับการดำเนินการ
          </CardTitle>
          <Badge
            variant="outline"
            className={`px-3 py-1 font-medium text-xs border shadow-sm ${
              isAllApproved
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {isAllApproved
              ? 'ดำเนินการเสร็จสิ้น'
              : `ขั้นตอนที่ ${currentStepDisplayIndex} จาก ${steps.length}`}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="relative p-5">
        {/* Timeline Track Line (ปรับระยะให้ตรงกับวงกลม) */}
        <div
          className="absolute left-[39px] sm:left-[43px] top-7 bottom-7 w-0.5 bg-slate-100"
          aria-hidden="true"
        />

        <div className="space-y-0 relative z-10">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;

            return (
              <TimelineStepItem
                key={step.key}
                number={index + 1}
                title={step.label}
                status={step.status}
                actionDate={step.at ? formatThaiDateTime(step.at) : null}
                isLast={isLast}
                description={step.description}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
