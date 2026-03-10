'use client';

import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  XCircle,
  User,
  MessageSquare,
  Clock,
  Loader2,
} from 'lucide-react';

type TimelineStepStatus =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'returned'
  | 'waiting'
  | 'cancelled';

// จัดการสีและสไตล์ทั้งหมดไว้ที่เดียว เพื่อความง่ายในการดูแล (Design Tokens)
const STATUS_META: Record<
  TimelineStepStatus,
  {
    label: string;
    badgeClassName: string;
    circleClassName: string;
    icon?: React.ElementType;
  }
> = {
  approved: {
    label: 'ผ่านแล้ว',
    badgeClassName: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    circleClassName: 'bg-emerald-500 border-emerald-500 text-white shadow-sm',
    icon: CheckCircle2,
  },
  pending: {
    label: 'กำลังดำเนินการ',
    badgeClassName: 'bg-blue-50 text-blue-700 border-blue-200',
    circleClassName: 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-50 shadow-sm',
    icon: Loader2, // ใช้ Loader เพื่อสื่อถึงการ "กำลังรอ" ทำงาน
  },
  rejected: {
    label: 'ไม่อนุมัติ',
    badgeClassName: 'bg-red-50 text-red-700 border-red-200',
    circleClassName: 'bg-red-500 border-red-500 text-white shadow-sm',
    icon: XCircle,
  },
  returned: {
    label: 'ส่งกลับแก้ไข',
    badgeClassName: 'bg-orange-50 text-orange-700 border-orange-200',
    circleClassName: 'bg-orange-500 border-orange-500 text-white shadow-sm',
    icon: AlertCircle,
  },
  waiting: {
    label: 'รอดำเนินการ',
    badgeClassName: 'bg-slate-100 text-slate-500 border-slate-200',
    circleClassName: 'bg-slate-100 border-slate-200 text-slate-400',
    icon: Clock,
  },
  cancelled: {
    label: 'ยกเลิกแล้ว',
    badgeClassName: 'bg-red-50 text-red-700 border-red-200',
    circleClassName: 'bg-red-500 border-red-500 text-white shadow-sm',
    icon: XCircle,
  },
};

export function TimelineStepItem({
  number,
  title,
  status,
  actorName,
  actionDate,
  startedAt,
  comment,
  isLast = false,
  description,
}: {
  number: number;
  title: string;
  status: TimelineStepStatus;
  actorName?: string | null;
  actionDate?: string | null;
  startedAt?: string | null;
  comment?: string | null;
  isLast?: boolean;
  description?: string | null;
}) {
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;

  return (
    <div className={`relative flex gap-5 pb-8 ${isLast ? 'pb-0' : ''}`}>
      {/* 1. Circle Node */}
      <div
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300 ${meta.circleClassName}`}
      >
        {status === 'approved' ? <CheckCircle2 className="h-4 w-4" /> : number}
      </div>

      {/* 2. Content Area */}
      <div className="flex-1 pt-1">
        {/* Title & Badge */}
        <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
          <p
            className={`text-sm font-bold tracking-tight ${
              status === 'waiting' ? 'text-slate-400' : 'text-slate-800'
            }`}
          >
            {title}
          </p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badgeClassName}`}
          >
            {StatusIcon && (
              <StatusIcon className={`h-3 w-3 ${status === 'pending' ? 'animate-spin' : ''}`} />
            )}
            {meta.label}
          </span>
        </div>

        {/* Description */}
        {description && (
          <p
            className={`text-xs mb-3 ${status === 'waiting' ? 'text-slate-400' : 'text-slate-500'}`}
          >
            {description}
          </p>
        )}

        {/* Action Metadata (Actor & Dates) - จัดเป็นกลุ่มให้อ่านง่าย */}
        {(actorName || actionDate || startedAt) && (
          <div className="mt-2.5 flex flex-col gap-1.5">
            {actorName && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  ดำเนินการโดย: <span className="font-semibold text-slate-700">{actorName}</span>
                </span>
              </div>
            )}
            {actionDate && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>อนุมัติเมื่อ: {actionDate}</span>
              </div>
            )}
            {startedAt && !actionDate && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>เริ่มขั้นตอนเมื่อ: {startedAt}</span>
              </div>
            )}
          </div>
        )}

        {/* Comment Box - สไตล์ Left-Accent */}
        {comment && (
          <div className="mt-3.5 relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50/80 p-3 pr-4 transition-all hover:bg-slate-50">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300" />
            <div className="flex gap-2.5 items-start pl-2">
              <MessageSquare className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  หมายเหตุ
                </p>
                <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap font-medium">
                  {comment}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
