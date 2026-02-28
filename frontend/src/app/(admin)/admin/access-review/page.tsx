'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RefreshCw,
  ShieldCheck,
  Filter,
  Search,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  UserCog,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  ArrowRight,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useAccessReviewQueue,
  useResolveAccessReviewQueueItem,
} from '@/features/access-review/hooks';
import type { AccessReviewQueueRow, AccessReviewQueueStatus } from '@/features/access-review/api';
import { useUpdateUserRole } from '@/features/system/hooks';
import { formatThaiDateTime, formatThaiNumber } from '@/shared/utils/thai-locale';
import { getRoleLabel, ROLE_OPTIONS } from '@/shared/utils/role-label';
import { cn } from '@/lib/utils';

const LIMIT_OPTIONS = [10, 20, 50] as const;

type RoleChangeDialogState = {
  row: AccessReviewQueueRow;
  nextRole: string;
  reason: string;
  hasError?: boolean;
} | null;

const PAYLOAD_LABELS: Record<string, string> = {
  expected_role: 'บทบาทที่ควรเป็น',
  current_role: 'บทบาทปัจจุบัน',
  previous_role: 'บทบาทเดิม',
  employee_status: 'สถานะบุคลากร',
  status_code: 'รหัสสถานะ',
  expected_is_active: 'สถานะบัญชีที่ควรเป็น',
  current_is_active: 'สถานะบัญชีปัจจุบัน',
  profile_changed_fields: 'ฟิลด์ที่เปลี่ยน',
  source: 'แหล่งที่มา',
  sync_batch_id: 'รอบซิงก์',
  reason: 'เหตุผล',
};

const getQueueReasonLabel = (reasonCode: string) => {
  switch (reasonCode) {
    case 'NEW_USER': return 'ผู้ใช้ใหม่จากรอบซิงก์';
    case 'ROLE_MISMATCH': return 'บทบาทไม่ตรงกติกา';
    case 'PROFILE_CHANGED': return 'ข้อมูลบุคลากรเปลี่ยน';
    case 'INACTIVE_BUT_ACTIVE': return 'บุคลากรไม่พร้อมใช้งาน แต่บัญชีเปิดอยู่';
    default: return reasonCode;
  }
};

const getQueueStatusBadge = (status: AccessReviewQueueStatus) => {
  switch (status) {
    case 'OPEN': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1"><AlertTriangle className="h-3 w-3" /> ค้างตรวจ</Badge>;
    case 'IN_REVIEW': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">กำลังตรวจ</Badge>;
    case 'RESOLVED': return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="h-3 w-3" /> ปิดแล้ว</Badge>;
    case 'DISMISSED': return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">ยกเลิกเคส</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

const formatPayloadValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.map((item) => formatPayloadValue(item)).join(', ');
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่ใช่';
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${formatPayloadValue(v)}`).join(' | ');
  return String(value);
};

const getPayloadEntries = (payload?: Record<string, unknown> | null) => {
  if (!payload) return [];
  return Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      key,
      label: PAYLOAD_LABELS[key] ?? key,
      value: formatPayloadValue(value),
    }));
};

export default function AccessReviewPage() {
  const [queuePage, setQueuePage] = useState(1);
  const [queueLimit, setQueueLimit] = useState<number>(10);

  // Filters
  const [queueStatusFilter, setQueueStatusFilter] = useState<'all' | AccessReviewQueueStatus>('OPEN');
  const [queueReasonFilter, setQueueReasonFilter] = useState<string>('all');
  const [queueRoleFilter, setQueueRoleFilter] = useState<string>('all');
  const [queueActiveFilter, setQueueActiveFilter] = useState<'all' | '1' | '0'>('all');
  const [queueBatchFilter, setQueueBatchFilter] = useState<string>('');
  const [queueSearchFilter, setQueueSearchFilter] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [expandedQueueIds, setExpandedQueueIds] = useState<number[]>([]);
  const [queueRoleDraft, setQueueRoleDraft] = useState<Record<number, string>>({});
  const [roleChangeDialog, setRoleChangeDialog] = useState<RoleChangeDialogState>(null);

  const queueQuery = useAccessReviewQueue({
    page: queuePage,
    limit: queueLimit,
    status: queueStatusFilter === 'all' ? undefined : queueStatusFilter,
    reason_code: queueReasonFilter === 'all' ? undefined : queueReasonFilter,
    current_role: queueRoleFilter === 'all' ? undefined : queueRoleFilter,
    is_active: queueActiveFilter === 'all' ? undefined : (Number(queueActiveFilter) as 0 | 1),
    batch_id: queueBatchFilter.trim().length > 0 && !Number.isNaN(Number(queueBatchFilter)) ? Number(queueBatchFilter) : undefined,
    search: queueSearchFilter.trim().length > 0 ? queueSearchFilter.trim() : undefined,
  });

  const resolveQueueMutation = useResolveAccessReviewQueueItem();
  const updateUserRoleMutation = useUpdateUserRole();

  const queueResponse = queueQuery.data;
  const queueRows = (queueResponse?.rows ?? []) as AccessReviewQueueRow[];
  const queueReasonOptions = queueResponse?.reason_options ?? [];
  const queueTotalPages = Math.max(1, Math.ceil(Number(queueResponse?.total ?? 0) / Number(queueResponse?.limit ?? queueLimit)));

  const activeFilterChips = [
    queueRoleFilter !== 'all' ? { key: 'role', label: `บทบาท: ${getRoleLabel(queueRoleFilter)}`, clear: () => { setQueueRoleFilter('all'); setQueuePage(1); } } : null,
    queueReasonFilter !== 'all' ? { key: 'reason', label: `เหตุผล: ${getQueueReasonLabel(queueReasonFilter)}`, clear: () => { setQueueReasonFilter('all'); setQueuePage(1); } } : null,
    queueActiveFilter !== 'all' ? { key: 'active', label: `สถานะบัญชี: ${queueActiveFilter === '1' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}`, clear: () => { setQueueActiveFilter('all'); setQueuePage(1); } } : null,
    queueBatchFilter.trim() ? { key: 'batch', label: `Batch #${queueBatchFilter.trim()}`, clear: () => { setQueueBatchFilter(''); setQueuePage(1); } } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const getDraftRole = (row: AccessReviewQueueRow): string => queueRoleDraft[row.queue_id] ?? row.current_role;
  const isExpanded = (queueId: number) => expandedQueueIds.includes(queueId);
  const toggleExpanded = (queueId: number) => {
    setExpandedQueueIds((prev) => prev.includes(queueId) ? prev.filter((id) => id !== queueId) : [...prev, queueId]);
  };

  const handleRoleDraftChange = (queueId: number, role: string) => {
    setQueueRoleDraft((prev) => ({ ...prev, [queueId]: role }));
  };

  const handleResolveQueue = async (queueId: number, action: 'RESOLVE' | 'DISMISS') => {
    try {
      await resolveQueueMutation.mutateAsync({ id: queueId, payload: { action } });
      toast.success(action === 'RESOLVE' ? 'ปิดเคสเรียบร้อยแล้ว' : 'ยกเลิกเคสเรียบร้อยแล้ว');
      await queueQuery.refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'อัปเดตคิวไม่สำเร็จ');
    }
  };

  const handleFixRoleAndResolve = async (row: AccessReviewQueueRow) => {
    if (row.status !== 'OPEN') return toast.error('แก้ไขสิทธิ์ได้เฉพาะเคสที่ยังค้างตรวจเท่านั้น');

    const nextRole = getDraftRole(row);
    if (!nextRole || nextRole === row.current_role) return toast.error('กรุณาเลือกบทบาทใหม่ที่แตกต่างจากเดิม');

    setRoleChangeDialog({ row, nextRole, reason: '' });
  };

  const submitRoleChangeAndResolve = async () => {
    if (!roleChangeDialog) return;
    const { row, nextRole, reason } = roleChangeDialog;

    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      setRoleChangeDialog({ ...roleChangeDialog, hasError: true });
      toast.error('กรุณาระบุเหตุผลการเปลี่ยนสิทธิ์');
      return;
    }

    try {
      await updateUserRoleMutation.mutateAsync({ userId: row.user_id, payload: { role: nextRole }});
      await resolveQueueMutation.mutateAsync({
        id: row.queue_id,
        payload: { action: 'RESOLVE', note: `ROLE_UPDATED ${row.current_role} -> ${nextRole} | ${normalizedReason}` },
      });
      toast.success('อัปเดตสิทธิ์และปิดเคสเรียบร้อย');
      setRoleChangeDialog(null);
      await queueQuery.refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'แก้ไขสิทธิ์ไม่สำเร็จ');
    }
  };

  const clearFilters = () => {
    setQueueStatusFilter('OPEN');
    setQueueReasonFilter('all');
    setQueueRoleFilter('all');
    setQueueActiveFilter('all');
    setQueueBatchFilter('');
    setQueueSearchFilter('');
    setQueuePage(1);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> ตรวจสอบสิทธิ์การใช้งาน (Access Review)
          </h1>
          <p className="text-muted-foreground mt-1">
            จัดการคิวแจ้งเตือนความผิดปกติของสิทธิ์ผู้ใช้งานที่ตรวจพบหลังจากการซิงก์ข้อมูล
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-2 bg-background shadow-sm" onClick={() => queueQuery.refetch()} disabled={queueQuery.isFetching}>
          <RefreshCw className={cn("h-4 w-4 text-muted-foreground", queueQuery.isFetching && "animate-spin")} /> ดึงข้อมูลล่าสุด
        </Button>
      </div>

      <Card className="border-border shadow-sm flex flex-col">
        <CardHeader className="border-b bg-muted/5 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg">คิวตรวจสอบปัจจุบัน</CardTitle>
              <CardDescription>รายการความขัดแย้งของข้อมูลที่ต้องการการตัดสินใจจากผู้ดูแลระบบ</CardDescription>
            </div>

            {/* Clean Status Summary Badges */}
            <div className="flex bg-background border rounded-lg p-1 shadow-sm overflow-hidden">
              <div className="px-3 py-1 flex flex-col items-center border-r">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">ค้างตรวจ</span>
                <span className="font-bold text-amber-600">{formatThaiNumber(queueResponse?.summary?.open_count ?? 0)}</span>
              </div>
              <div className="px-3 py-1 flex flex-col items-center border-r">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">กำลังตรวจ</span>
                <span className="font-bold text-blue-600">{formatThaiNumber(queueResponse?.summary?.in_review_count ?? 0)}</span>
              </div>
              <div className="px-3 py-1 flex flex-col items-center">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">ปิดแล้ว</span>
                <span className="font-bold text-emerald-600">{formatThaiNumber(queueResponse?.summary?.resolved_count ?? 0)}</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 flex flex-col">
          {/* Smart Filter Bar */}
          <div className="p-4 border-b bg-muted/10 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาด้วยชื่อ หรือเลขบัตรประชาชน..."
                  value={queueSearchFilter}
                  onChange={(e) => { setQueueSearchFilter(e.target.value); setQueuePage(1); }}
                  className="pl-9 h-9 bg-background"
                />
              </div>

              <div className="flex gap-2 shrink-0">
                <Select value={queueStatusFilter} onValueChange={(v: 'all' | AccessReviewQueueStatus) => { setQueueStatusFilter(v); setQueuePage(1); }}>
                  <SelectTrigger className="h-9 w-[130px] bg-background text-xs"><SelectValue placeholder="สถานะ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสถานะ</SelectItem>
                    <SelectItem value="OPEN">ค้างตรวจ</SelectItem>
                    <SelectItem value="IN_REVIEW">กำลังตรวจ</SelectItem>
                    <SelectItem value="RESOLVED">ปิดแล้ว</SelectItem>
                    <SelectItem value="DISMISSED">ยกเลิกเคส</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant={showAdvancedFilters ? "secondary" : "outline"} size="sm" className="h-9 px-3 gap-2 bg-background shadow-sm" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
                  <Filter className="h-3.5 w-3.5" /> <span className="hidden sm:inline">ตัวกรองอื่น</span>
                </Button>
              </div>
            </div>

            {/* Collapsible Advanced Filters */}
            {showAdvancedFilters && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 animate-in slide-in-from-top-2">
                <Select value={queueReasonFilter} onValueChange={(v) => { setQueueReasonFilter(v); setQueuePage(1); }}>
                  <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="เหตุผลการแจ้งเตือน" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกเหตุผล</SelectItem>
                    {queueReasonOptions.map((code) => <SelectItem key={code} value={code}>{getQueueReasonLabel(code)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={queueRoleFilter} onValueChange={(v) => { setQueueRoleFilter(v); setQueuePage(1); }}>
                  <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="บทบาทปัจจุบัน" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกบทบาท</SelectItem>
                    {ROLE_OPTIONS.map((role) => <SelectItem key={role} value={role}>{getRoleLabel(role)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={queueActiveFilter} onValueChange={(v: 'all' | '1' | '0') => { setQueueActiveFilter(v); setQueuePage(1); }}>
                  <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="สถานะบัญชี" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสถานะบัญชี</SelectItem>
                    <SelectItem value="1">บัญชีเปิดใช้งาน</SelectItem>
                    <SelectItem value="0">บัญชีปิดใช้งาน</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="ค้นหาด้วย Batch ID" value={queueBatchFilter} onChange={(e) => { setQueueBatchFilter(e.target.value); setQueuePage(1); }} className="h-8 text-xs bg-background" />
                <Button size="sm" variant="ghost" onClick={clearFilters} className="h-8 text-xs text-muted-foreground hover:text-foreground">ล้างตัวกรองทั้งหมด</Button>
              </div>
            )}

            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {activeFilterChips.map((chip) => (
                  <Badge key={chip.key} variant="secondary" className="gap-1 rounded-full px-2.5 py-1 bg-background border">
                    <span className="font-normal text-muted-foreground">{chip.label.split(':')[0]}:</span>
                    <span className="font-medium text-foreground">{chip.label.split(':')[1]}</span>
                    <button
                      type="button"
                      onClick={chip.clear}
                      className="rounded-full p-0.5 ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Clean Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground border-b border-border/60">
                <tr>
                  <th className="px-4 py-3 font-medium whitespace-nowrap w-[25%]">ผู้ใช้งาน</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap w-[25%]">รายละเอียดปัญหา</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">ข้อมูลปัจจุบัน</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">เวลาตรวจพบ</th>
                  <th className="px-4 py-3 font-medium text-right whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {queueQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="p-4"><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div></td>
                      <td className="p-4"><div className="space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-5 w-20 rounded-full" /></div></td>
                      <td className="p-4"><div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" /></div></td>
                      <td className="p-4"><Skeleton className="h-4 w-28" /></td>
                      <td className="p-4 text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></td>
                    </tr>
                  ))
                ) : queueRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-48 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShieldCheck className="h-10 w-10 text-muted-foreground/30 mb-2" />
                        <p>ไม่พบคิวค้างตรวจตามเงื่อนไขที่กำหนด</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  queueRows.map((row) => (
                    <>
                      <tr key={row.queue_id} className={cn("hover:bg-muted/30 group transition-colors", isExpanded(row.queue_id) && "bg-muted/10")}>
                        <td className="p-4 align-top">
                          <div className="flex items-start gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mt-0.5 h-7 w-7 shrink-0 text-muted-foreground md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                              onClick={() => toggleExpanded(row.queue_id)}
                              aria-label={isExpanded(row.queue_id) ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                            >
                              {isExpanded(row.queue_id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold text-foreground">{row.user_name || 'ไม่ระบุชื่อ'}</span>
                              <span className="text-xs text-muted-foreground font-mono bg-muted/50 w-fit px-1.5 py-0.5 rounded">{row.citizen_id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          <div className="flex flex-col items-start gap-2">
                            <span className="font-medium text-sm text-foreground">{getQueueReasonLabel(row.reason_code)}</span>
                            {getQueueStatusBadge(row.status)}
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium">{getRoleLabel(row.current_role)}</span>
                            <div className="flex items-center gap-1.5">
                              <div className={cn("h-1.5 w-1.5 rounded-full", row.is_active === 1 ? "bg-emerald-500" : "bg-slate-300")} />
                              <span className={cn("text-xs", row.is_active === 1 ? "text-foreground" : "text-muted-foreground")}>
                                {row.is_active === 1 ? 'บัญชีเปิดใช้งาน' : 'บัญชีปิดใช้งาน'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="text-foreground">{formatThaiDateTime(row.last_detected_at, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            <span className="text-muted-foreground" title={`First seen: Batch #${row.source_batch_id}`}>Batch: #{row.last_seen_batch_id ?? '-'}</span>
                          </div>
                        </td>
                        <td className="p-4 align-top text-right">
                          <div className="flex justify-end gap-2 items-center">
                            {/* Inline Edit Role Only if OPEN */}
                            {row.status === 'OPEN' && (
                              <Select value={getDraftRole(row)} onValueChange={(val) => handleRoleDraftChange(row.queue_id, val)} disabled={resolveQueueMutation.isPending || updateUserRoleMutation.isPending}>
                                <SelectTrigger className="h-8 w-[140px] text-xs bg-background"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {ROLE_OPTIONS.map((role) => <SelectItem key={role} value={role}>{getRoleLabel(role)}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild>
                                  <Link href={`/admin/users/${row.user_id}`} className="cursor-pointer">
                                    <Eye className="mr-2 h-4 w-4 text-muted-foreground" /> ดูรายละเอียดผู้ใช้นี้
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleExpanded(row.queue_id)}>
                                  {isExpanded(row.queue_id) ? <ChevronUp className="mr-2 h-4 w-4 text-muted-foreground" /> : <ChevronDown className="mr-2 h-4 w-4 text-muted-foreground" />}
                                  {isExpanded(row.queue_id) ? 'ซ่อนรายละเอียดเคส' : 'ดูรายละเอียดเคส'}
                                </DropdownMenuItem>

                                {row.status === 'OPEN' ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleFixRoleAndResolve(row)} className="text-primary focus:text-primary font-medium">
                                      <UserCog className="mr-2 h-4 w-4" /> บันทึกสิทธิ์ + ปิดเคส
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleResolveQueue(row.queue_id, 'RESOLVE')} className="text-emerald-600 focus:text-emerald-600">
                                      <CheckCircle2 className="mr-2 h-4 w-4" /> ปิดเคส (ข้อมูลถูกแล้ว)
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleResolveQueue(row.queue_id, 'DISMISS')} className="text-muted-foreground">
                                      <XCircle className="mr-2 h-4 w-4" /> ยกเลิกเคสนี้
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded Detail Row */}
                      {isExpanded(row.queue_id) && (
                        <tr className="bg-muted/10 border-b">
                          <td colSpan={5} className="px-14 py-5">
                            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                              {/* Left detail column */}
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Database className="h-3 w-3" /> ข้อมูลเปรียบเทียบจากระบบตรวจจับ (Payload)</p>
                                  {getPayloadEntries(row.payload_json).length > 0 ? (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {getPayloadEntries(row.payload_json).map((entry) => (
                                        <div key={entry.key} className="rounded-md border bg-background px-3 py-2 shadow-sm">
                                          <p className="text-[10px] text-muted-foreground">{entry.label}</p>
                                          <p className="mt-0.5 break-words text-sm font-medium text-foreground">{entry.value}</p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="rounded-lg border border-dashed bg-background px-3 py-4 text-sm text-muted-foreground text-center">
                                      ไม่มีรายละเอียดเพิ่มเติมจาก Payload ของคิวนี้
                                    </div>
                                  )}
                                </div>

                                {row.note && (
                                  <div>
                                     <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> หมายเหตุเพิ่มเติม</p>
                                     <div className="rounded-md border bg-amber-50/50 px-3 py-2 shadow-sm text-sm text-amber-800">
                                       {row.note}
                                     </div>
                                  </div>
                                )}
                              </div>

                              {/* Right recommendation column */}
                              <div className="space-y-3">
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> แนวทางจัดการ</p>
                                  <ul className="mt-2.5 space-y-2.5 text-sm text-foreground/80 list-outside pl-4">
                                    <li className="leading-relaxed">หากบทบาทปัจจุบัน <span className="font-semibold text-foreground">ไม่ถูกต้อง</span> ให้เลือกบทบาทใหม่ใน Dropdown ด้านบน แล้วกด <strong>“บันทึกสิทธิ์ + ปิดเคส”</strong> </li>
                                    <li className="leading-relaxed">หากตรวจสอบแล้วข้อมูลปัจจุบัน <span className="font-semibold text-foreground">ถูกต้องอยู่แล้ว</span> ให้กดปุ่ม 3 จุด เลือก <strong>“ปิดเคส (ข้อมูลถูกแล้ว)”</strong></li>
                                    <li className="leading-relaxed text-muted-foreground text-xs">หากเคสนี้เป็นข้อมูลซ้ำซ้อนให้ใช้ “ยกเลิกเคสนี้” (Dismiss)</li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination */}
          <div className="border-t bg-muted/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">แสดงผล</span>
              <Select value={String(queueLimit)} onValueChange={(v) => { setQueueLimit(Number(v)); setQueuePage(1); }}>
                <SelectTrigger className="h-8 w-[70px] text-xs bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIMIT_OPTIONS.map(v => <SelectItem key={v} value={String(v)}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">จากทั้งหมด <span className="font-medium text-foreground">{formatThaiNumber(queueResponse?.total ?? 0)}</span> รายการ</span>
            </div>

            <div className="flex gap-2 items-center">
              <Button variant="outline" size="sm" className="h-8 px-2 bg-background" onClick={() => setQueuePage(p => Math.max(1, p - 1))} disabled={queuePage <= 1 || queueQuery.isLoading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium px-2">หน้า {queuePage} / {queueTotalPages}</span>
              <Button variant="outline" size="sm" className="h-8 px-2 bg-background" onClick={() => setQueuePage(p => Math.min(queueTotalPages, p + 1))} disabled={queuePage >= queueTotalPages || queueQuery.isLoading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Change Confirmation Dialog */}
      <Dialog open={!!roleChangeDialog} onOpenChange={(open) => { if (!open) setRoleChangeDialog(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <UserCog className="h-5 w-5" /> ยืนยันการแก้สิทธิ์และปิดเคส
            </DialogTitle>
            <DialogDescription>
              ใช้สำหรับเคสที่ตรวจสอบแล้วว่าจำเป็นต้องเปลี่ยนบทบาทของผู้ใช้ (Role) และปิดคิวการแจ้งเตือนนี้
            </DialogDescription>
          </DialogHeader>

          {roleChangeDialog && (
            <div className="space-y-5 py-2">
              <div className="rounded-lg border bg-muted/20 p-3 text-sm flex flex-col items-center text-center shadow-sm">
                 <p className="font-semibold text-foreground text-base">{roleChangeDialog.row.user_name || 'ไม่ระบุชื่อ'}</p>
                 <span className="text-xs text-muted-foreground font-mono mt-0.5">{roleChangeDialog.row.citizen_id}</span>
                 <Badge variant="secondary" className="mt-3 font-normal bg-background border">{getQueueReasonLabel(roleChangeDialog.row.reason_code)}</Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] items-center bg-muted/10 p-4 rounded-lg border">
                <div className="space-y-1.5 text-center">
                  <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">บทบาทปัจจุบัน</Label>
                  <div className="h-9 rounded-md border border-dashed bg-background px-3 text-sm font-medium text-muted-foreground flex items-center justify-center">
                    {getRoleLabel(roleChangeDialog.row.current_role)}
                  </div>
                </div>
                <div className="flex justify-center text-muted-foreground/30">
                   <ArrowRight className="h-5 w-5 rotate-90 sm:rotate-0" />
                </div>
                <div className="space-y-1.5 text-center">
                  <Label className="text-[10px] uppercase text-primary tracking-wider font-semibold">บทบาทใหม่</Label>
                  <div className="h-9 rounded-md border-primary/30 bg-primary/5 text-primary px-3 text-sm font-semibold flex items-center justify-center shadow-sm">
                    {getRoleLabel(roleChangeDialog.nextRole)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role-change-reason" className={cn("flex justify-between", roleChangeDialog.hasError && "text-destructive")}>
                  <span>เหตุผลการแก้ไขสิทธิ์ <span className="text-destructive">*</span></span>
                </Label>
                <Textarea
                  id="role-change-reason"
                  value={roleChangeDialog.reason}
                  onChange={(event) => setRoleChangeDialog((prev) => prev ? { ...prev, reason: event.target.value, hasError: false } : prev)}
                  rows={3}
                  placeholder="เช่น ปรับสิทธิ์ตามตำแหน่งใหม่ในระบบ HRMS..."
                  className={cn("resize-none", roleChangeDialog.hasError && "border-destructive focus-visible:ring-destructive/20")}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" onClick={() => setRoleChangeDialog(null)}>
              ยกเลิก
            </Button>
            <Button
              onClick={submitRoleChangeAndResolve}
              disabled={resolveQueueMutation.isPending || updateUserRoleMutation.isPending}
              className="gap-2 shadow-sm"
            >
              {resolveQueueMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              บันทึกสิทธิ์และปิดเคส
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
