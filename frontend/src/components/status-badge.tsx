'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  RotateCcw,
  Banknote,
  FileText,
  Loader2,
  Info,
  AlertTriangle,
  Ban,
} from 'lucide-react';

// --- Main Status Badge ---

export type StatusType =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'paid'
  | 'cancelled'
  | 'draft'
  | 'processing'
  | 'completed'
  | 'overdue'
  | 'warning'
  | 'normal'
  | 'success'
  | 'error'
  | 'info';

type StatusConfig = {
  label: string;
  className: string;
  icon: React.ElementType;
};

const statusConfig: Record<StatusType, StatusConfig> = {
  pending: {
    label: 'รอดำเนินการ',
    className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    icon: Clock,
  },
  approved: {
    label: 'อนุมัติแล้ว',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'ไม่อนุมัติ',
    className: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    icon: XCircle,
  },
  returned: {
    label: 'ส่งกลับแก้ไข',
    className: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    icon: RotateCcw,
  },
  paid: {
    label: 'จ่ายเงินแล้ว',
    className: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    icon: Banknote,
  },
  cancelled: {
    label: 'ยกเลิก',
    className: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200',
    icon: Ban,
  },
  draft: {
    label: 'ฉบับร่าง',
    className: 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100',
    icon: FileText,
  },
  processing: {
    label: 'กำลังดำเนินการ',
    className: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    icon: Loader2, // Optional: You might want to animate-spin this in specific contexts
  },
  completed: {
    label: 'เสร็จสิ้น',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    icon: CheckCircle2,
  },
  overdue: {
    label: 'เกินกำหนด',
    className: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    icon: AlertCircle,
  },
  warning: {
    label: 'ใกล้ครบกำหนด',
    className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    icon: AlertTriangle,
  },
  normal: {
    label: 'ปกติ',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    icon: CheckCircle2,
  },
  success: {
    label: 'สำเร็จ',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    icon: CheckCircle2,
  },
  error: {
    label: 'ผิดพลาด',
    className: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    icon: XCircle,
  },
  info: {
    label: 'ข้อมูล',
    className: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
    icon: Info,
  },
};

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, label, className, showIcon = true }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn('gap-1.5 font-normal', config.className, className)}>
      {showIcon && <Icon className="h-3.5 w-3.5" />}
      {label || config.label}
    </Badge>
  );
}

// --- SLA Status Badge ---

export type SlaStatusType = 'normal' | 'warning' | 'danger' | 'overdue';

const slaStatusConfig: Record<SlaStatusType, StatusConfig> = {
  normal: {
    label: 'ปกติ',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    icon: CheckCircle2,
  },
  warning: {
    label: 'ใกล้ครบกำหนด',
    className: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    icon: Clock,
  },
  danger: {
    label: 'เร่งด่วน',
    className: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    icon: AlertTriangle,
  },
  overdue: {
    label: 'เกินกำหนด',
    className: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    icon: AlertCircle,
  },
};

interface SlaBadgeProps {
  status: SlaStatusType;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export function SlaBadge({ status, label, className, showIcon = true }: SlaBadgeProps) {
  const config = slaStatusConfig[status] || slaStatusConfig.normal;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn('gap-1.5 font-normal', config.className, className)}>
      {showIcon && <Icon className="h-3.5 w-3.5" />}
      {label || config.label}
    </Badge>
  );
}
