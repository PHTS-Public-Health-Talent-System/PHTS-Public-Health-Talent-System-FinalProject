'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Eye,
  FileText,
  AlertTriangle,
  AlertCircle,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { usePendingApprovals, useProcessAction } from '@/features/request/hooks';
import { usePendingWithSla } from '@/features/sla/hooks';
import { mapRequestToFormData } from '@/features/request/components/hooks/request-form-mapper';
import type { RequestWithDetails } from '@/types/request.types';
import {
  normalizeRateMapping,
  resolveRateMappingDisplay,
} from '@/features/request/detail/requestDetail.rateMapping';
import { useRateHierarchy } from '@/features/master-data/hooks';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatThaiDate, formatThaiNumber } from '@/shared/utils/thai-locale';

// --- Helpers & Types ---

function getSlaStatusBadge(status: string, remaining: number) {
  switch (status) {
    case 'normal':
      return (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 font-normal gap-1"
        >
          <Clock className="w-3 h-3" /> {remaining} วัน
        </Badge>
      );
    case 'warning':
      return (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200 font-normal gap-1"
        >
          <AlertTriangle className="w-3 h-3" /> เหลือ {remaining} วัน
        </Badge>
      );
    case 'danger':
      return (
        <Badge variant="destructive" className="font-normal gap-1">
          <AlertCircle className="w-3 h-3" /> เกิน {Math.abs(remaining)} วัน
        </Badge>
      );
    default:
      return <span className="text-muted-foreground">-</span>;
  }
}

type SlaInfo = {
  request_id: number;
  is_approaching_sla: boolean;
  is_overdue: boolean;
  days_until_sla: number;
  days_overdue: number;
};

type RequestRow = {
  id: number;
  requestNo: string;
  name: string;
  position: string;
  department: string;
  groupNo: string;
  itemNo: string;
  subItemNo?: string;
  mappingDisplay: string;
  rateItemHint?: string;
  amount: number;
  submittedDate: string;
  slaStatus: 'normal' | 'warning' | 'danger' | 'unknown';
  slaRemaining: number | null;
  raw: RequestWithDetails;
};

const sanitizeRatePart = (value: unknown): string => {
  const text = String(value ?? '').trim();
  if (!text || text === '__NONE__' || text === 'NONE' || text === 'null' || text === 'undefined') {
    return '-';
  }
  return text;
};

const formatDate = (value?: string | Date | null) => {
  return formatThaiDate(value);
};

// Helper Component for Stats
type StatCardProps = {
  title: string;
  value: number;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
};

const StatCard = ({ title, value, icon: Icon, colorClass, bgClass }: StatCardProps) => (
  <Card className="border-border shadow-sm">
    <CardContent className="p-6 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</div>
      </div>
      <div
        className={`p-3 rounded-full ${bgClass} ${colorClass.replace('text-', 'bg-').replace('text-', 'bg-').split(' ')[0]}/10`}
      >
        <Icon className="h-6 w-6" />
      </div>
    </CardContent>
  </Card>
);

type HeadScopeRequestsPageProps = {
  basePath: string;
  approverTitle: string;
  approverDescription: string;
};

export function HeadScopeRequestsPage({
  basePath,
  approverTitle,
  approverDescription,
}: HeadScopeRequestsPageProps) {
  const [selectedRequest, setSelectedRequest] = useState<RequestRow | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [comment, setComment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [slaFilter, setSlaFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingQuery = usePendingApprovals();
  const slaQuery = usePendingWithSla();
  const rateHierarchyQuery = useRateHierarchy();
  const actionMutation = useProcessAction();

  const slaMap = useMemo(() => {
    const map = new Map<number, SlaInfo>();
    const data = (slaQuery.data as SlaInfo[] | undefined) ?? [];
    for (const row of data) {
      map.set(row.request_id, row);
    }
    return map;
  }, [slaQuery.data]);

  const rows = useMemo<RequestRow[]>(() => {
    const pending = (pendingQuery.data ?? []) as RequestWithDetails[];
    return pending.map((request) => {
      const formData = mapRequestToFormData(request);
      const rateMapping = normalizeRateMapping(request.submission_data ?? null);
      const rateDisplay = rateMapping
        ? resolveRateMappingDisplay(rateMapping, rateHierarchyQuery.data)
        : null;
      const criteriaLabel = rateDisplay?.criteriaLabel;
      const subCriteriaLabel = rateDisplay?.subCriteriaLabel;
      const name =
        [formData.title, formData.firstName, formData.lastName].filter(Boolean).join(' ').trim() ||
        request.citizen_id;
      const position =
        formData.positionName || (request as { position_name?: string }).position_name || '-';
      const department =
        formData.subDepartment || formData.department || request.current_department || '-';
      const groupNo = sanitizeRatePart(rateMapping?.groupId ?? formData.rateMapping?.groupId);
      const itemId = rateMapping?.itemId ?? formData.rateMapping?.itemId;
      const subItemId = rateMapping?.subItemId ?? formData.rateMapping?.subItemId;
      const amount = formData.rateMapping?.amount ?? request.requested_amount ?? 0;
      const itemNo = sanitizeRatePart(itemId);
      const subItemNo = sanitizeRatePart(subItemId);
      const mappingDisplay = subItemNo !== '-' ? `${groupNo}/${itemNo}/${subItemNo}` : `${groupNo}/${itemNo}`;
      const requestNo = request.request_no ?? String(request.request_id);
      const sla = slaMap.get(request.request_id);
      let slaStatus: RequestRow['slaStatus'] = 'unknown';
      let slaRemaining: number | null = null;
      if (sla) {
        if (sla.is_overdue) {
          slaStatus = 'danger';
          slaRemaining = -Math.abs(sla.days_overdue);
        } else if (sla.is_approaching_sla) {
          slaStatus = 'warning';
          slaRemaining = sla.days_until_sla;
        } else {
          slaStatus = 'normal';
          slaRemaining = sla.days_until_sla;
        }
      }
      return {
        id: request.request_id,
        requestNo,
        name,
        position,
        department,
        groupNo,
        itemNo,
        subItemNo: subItemNo === '-' ? undefined : subItemNo,
        mappingDisplay,
        rateItemHint: [criteriaLabel, subCriteriaLabel].filter(Boolean).join(' / ') || undefined,
        amount,
        submittedDate: formatDate(request.created_at),
        slaStatus,
        slaRemaining,
        raw: request,
      };
    });
  }, [pendingQuery.data, slaMap, rateHierarchyQuery.data]);

  const filteredRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !keyword ||
        row.requestNo.toLowerCase().includes(keyword) ||
        row.name.toLowerCase().includes(keyword);
      const matchesSla =
        slaFilter === 'all' ||
        (slaFilter === 'normal' && row.slaStatus === 'normal') ||
        (slaFilter === 'warning' && row.slaStatus === 'warning') ||
        (slaFilter === 'danger' && row.slaStatus === 'danger');
      const matchesGroup = groupFilter === 'all' || row.groupNo === groupFilter;
      return matchesSearch && matchesSla && matchesGroup;
    });
  }, [rows, searchTerm, slaFilter, groupFilter]);

  const summaryCounts = useMemo(() => {
    const base = { total: rows.length, normal: 0, warning: 0, danger: 0 };
    return rows.reduce((acc, row) => {
      if (row.slaStatus === 'normal') acc.normal += 1;
      if (row.slaStatus === 'warning') acc.warning += 1;
      if (row.slaStatus === 'danger') acc.danger += 1;
      return acc;
    }, base);
  }, [rows]);

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;
    const trimmed = comment.trim();
    const isCommentRequired = actionType !== 'approve';
    if (isCommentRequired && !trimmed) {
      setActionError('กรุณาระบุเหตุผลก่อนดำเนินการ');
      return;
    }
    setActionError(null);
    const actionMap = {
      approve: 'APPROVE',
      reject: 'REJECT',
      return: 'RETURN',
    } as const;
    try {
      await actionMutation.mutateAsync({
        id: selectedRequest.id,
        payload: { action: actionMap[actionType], comment: trimmed || undefined },
      });
      toast.success('บันทึกผลการพิจารณาเรียบร้อยแล้ว');
      setSelectedRequest(null);
      setActionType(null);
      setComment('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถดำเนินการได้';
      toast.error(message);
      setActionError(message);
    }
  };

  const isLoading = pendingQuery.isLoading || slaQuery.isLoading;
  const isError = pendingQuery.isError;
  const errorMessage =
    pendingQuery.error instanceof Error ? pendingQuery.error.message : 'ไม่สามารถโหลดรายการคำขอได้';

  return (
    <div className="p-8 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {approverTitle}
        </h1>
        <p className="text-muted-foreground">{approverDescription}</p>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="ทั้งหมด"
          value={summaryCounts.total}
          icon={FileText}
          colorClass="text-primary"
          bgClass="bg-primary/10"
        />
        <StatCard
          title="ปกติ (ตามกำหนดเวลา)"
          value={summaryCounts.normal}
          icon={CheckCircle2}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-500/10"
        />
        <StatCard
          title="ใกล้ครบกำหนด"
          value={summaryCounts.warning}
          icon={AlertTriangle}
          colorClass="text-amber-600"
          bgClass="bg-amber-500/10"
        />
        <StatCard
          title="เกินกำหนด"
          value={summaryCounts.danger}
          icon={XCircle}
          colorClass="text-destructive"
          bgClass="bg-destructive/10"
        />
      </div>

      {/* Main Content */}
      <Card className="border-border shadow-sm">
        <CardHeader className="py-4 px-6 border-b bg-muted/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              รายการรอดำเนินการ
            </CardTitle>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ, เลขที่คำขอ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-background pl-9 h-9"
                />
              </div>
              <Select value={slaFilter} onValueChange={setSlaFilter}>
                <SelectTrigger className="w-full sm:w-[160px] bg-background h-9">
                  <SelectValue placeholder="สถานะกำหนดเวลา" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะกำหนดเวลา</SelectItem>
                  <SelectItem value="normal">ปกติ</SelectItem>
                  <SelectItem value="warning">ใกล้ครบกำหนด</SelectItem>
                  <SelectItem value="danger">เกินกำหนด</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-full sm:w-[160px] bg-background h-9">
                  <SelectValue placeholder="กลุ่มตำแหน่ง" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกกลุ่มตำแหน่ง</SelectItem>
                  <SelectItem value="1">กลุ่มที่ 1</SelectItem>
                  <SelectItem value="2">กลุ่มที่ 2</SelectItem>
                  <SelectItem value="3">กลุ่มที่ 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isError && (
            <div className="p-8 text-center text-destructive">
              <AlertCircle className="mx-auto h-8 w-8 mb-2" />
              <p>{errorMessage}</p>
            </div>
          )}

          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-semibold w-[150px]">เลขที่คำขอ</TableHead>
                  <TableHead className="font-semibold min-w-[200px]">ชื่อ-สกุล / ตำแหน่ง</TableHead>
                  <TableHead className="font-semibold">หน่วยงาน</TableHead>
                  <TableHead className="font-semibold text-center">กลุ่ม/ข้อ</TableHead>
                  <TableHead className="font-semibold text-right">อัตรา (บาท)</TableHead>
                  <TableHead className="font-semibold text-center">กำหนดเวลา</TableHead>
                  <TableHead className="font-semibold text-right w-[140px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      ไม่พบรายการคำขอ
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((request) => (
                    <TableRow
                      key={request.id}
                      className="group hover:bg-muted/30 border-border transition-colors"
                    >
                      <TableCell className="font-mono text-sm">{request.requestNo}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{request.name}</span>
                          <span
                            className="text-xs text-muted-foreground truncate max-w-[200px]"
                            title={request.position}
                          >
                            {request.position}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {request.department}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        <Badge
                          variant="secondary"
                          className="font-normal"
                          title={request.rateItemHint}
                        >
                          {request.mappingDisplay}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-foreground">
                        {formatThaiNumber(request.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {request.slaStatus === 'unknown' || request.slaRemaining === null ? (
                          <span className="text-muted-foreground text-xs">-</span>
                        ) : (
                          getSlaStatusBadge(request.slaStatus, request.slaRemaining)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`${basePath}/requests/${request.id}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-emerald-600 focus:text-emerald-700 cursor-pointer"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setActionType('approve');
                                  setActionError(null);
                                }}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" /> อนุมัติ
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-amber-600 focus:text-amber-700 cursor-pointer"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setActionType('return');
                                  setActionError(null);
                                }}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" /> ส่งกลับแก้ไข
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive cursor-pointer"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setActionType('reject');
                                  setActionError(null);
                                }}
                              >
                                <XCircle className="mr-2 h-4 w-4" /> ไม่อนุมัติ
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end border-t bg-muted/5 px-4 py-3 text-xs text-muted-foreground">
            แสดง {filteredRows.length} รายการ
          </div>
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog
        open={!!selectedRequest && !!actionType}
        onOpenChange={() => {
          setSelectedRequest(null);
          setActionType(null);
          setComment('');
          setActionError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle
              className={`flex items-center gap-2 ${
                actionType === 'approve'
                  ? 'text-emerald-600'
                  : actionType === 'return'
                    ? 'text-amber-600'
                    : 'text-destructive'
              }`}
            >
              {actionType === 'approve' && <CheckCircle2 className="h-5 w-5" />}
              {actionType === 'reject' && <XCircle className="h-5 w-5" />}
              {actionType === 'return' && <RefreshCw className="h-5 w-5" />}

              {actionType === 'approve' && 'ยืนยันการอนุมัติ'}
              {actionType === 'reject' && 'ยืนยันการไม่อนุมัติ'}
              {actionType === 'return' && 'ยืนยันการส่งกลับแก้ไข'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <div className="mt-3 rounded-md bg-secondary/50 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">คำขอเลขที่:</span>
                    <span className="font-mono font-medium">{selectedRequest.requestNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ผู้ยื่น:</span>
                    <span className="font-medium">{selectedRequest.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">จำนวนเงิน:</span>
                    <span className="font-medium">
                      {formatThaiNumber(selectedRequest.amount)} บาท
                    </span>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {actionType === 'approve' ? 'หมายเหตุ (ไม่บังคับ)' : 'เหตุผลการดำเนินการ'}
                {actionType !== 'approve' && <span className="text-destructive ml-1">*</span>}
              </label>
              <Textarea
                placeholder={
                  actionType === 'approve'
                    ? 'ระบุหมายเหตุเพิ่มเติม (ถ้ามี)'
                    : actionType === 'reject'
                      ? 'โปรดระบุเหตุผลที่ไม่อนุมัติ...'
                      : 'โปรดระบุสิ่งที่ต้องแก้ไข...'
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="resize-none min-h-[100px]"
              />
              {actionError && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" /> {actionError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRequest(null);
                setActionType(null);
                setComment('');
              }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleAction}
              disabled={actionMutation.isPending}
              className={
                actionType === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : actionType === 'reject'
                    ? 'bg-destructive hover:bg-destructive/90 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
              }
            >
              {actionMutation.isPending ? 'กำลังบันทึก...' : 'ยืนยัน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
