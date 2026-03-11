'use client';
export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Clock,
  CheckCircle2,
  Eye,
  UserPlus,
  FileText,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import { TableRowMoreActionsTrigger, TableRowViewAction } from '@/components/common';
import { getOnBehalfMetadata } from '@/features/request';
import {
  useAvailableOfficers,
  usePendingApprovals,
  useProcessAction,
  useReassignRequest,
} from '@/features/request';
import { usePendingWithSla } from '@/features/sla/hooks';
import type { RequestWithDetails } from '@/types/request.types';
import { formatThaiNumber } from '@/shared/utils/thai-locale';

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'returned';
const SHOW_CREATE_ON_BEHALF_BUTTON = true;

interface Request {
  id: number;
  requestNo: string;
  name: string;
  position: string;
  department: string;
  status: RequestStatus;
  rateGroup: string;
  rateItem: string;
  rateSubItem?: string;
  rateMappingDisplay: string;
  amount: number;
  hasVerificationSnapshot: boolean;
  isOfficerCreated: boolean;
  slaStatus: 'normal' | 'warning' | 'danger' | 'unknown';
  slaRemaining: number | null;
}

type SlaInfo = {
  request_id: number;
  is_approaching_sla: boolean;
  is_overdue: boolean;
  days_until_sla: number;
  days_overdue: number;
};

// ... (Helper functions: parseSubmissionData, pickSubmissionValue, mapStatus, sanitizeRatePart remain same)
function parseSubmissionData(data: RequestWithDetails['submission_data']) {
  if (!data) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return data as Record<string, unknown>;
}

function pickSubmissionValue(submission: Record<string, unknown> | null, ...keys: string[]) {
  if (!submission) return undefined;
  for (const key of keys) {
    const value = submission[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function mapStatus(status: string): RequestStatus {
  if (status === 'APPROVED') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  if (status === 'RETURNED') return 'returned';
  if (status.startsWith('PENDING')) return 'pending';
  return 'pending';
}

function sanitizeRatePart(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text || text === '__NONE__' || text === 'NONE' || text === 'null' || text === 'undefined') {
    return '-';
  }
  return text;
}

function getSlaStatusBadge(status: Request['slaStatus'], remaining: number) {
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
          <AlertCircle className="w-3 h-3" /> เหลือ {remaining} วัน
        </Badge>
      );
    case 'danger':
      return (
        <Badge variant="destructive" className="font-normal gap-1">
          <AlertCircle className="w-3 h-3" /> เกิน {Math.abs(remaining)} วัน
        </Badge>
      );
    default:
      return <span className="text-muted-foreground text-xs">-</span>;
  }
}

// Helper Component for Stats
type StatCardProps = {
  title: string;
  value: number;
  unit?: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
};

const StatCard = ({ title, value, unit = 'รายการ', icon: Icon, colorClass, bgClass }: StatCardProps) => (
  <Card className="border-border shadow-sm">
    <CardContent className="p-6 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="text-2xl font-bold mt-1">
          {formatThaiNumber(value)}{' '}
          <span className="text-xs font-normal text-muted-foreground">{unit}</span>
        </div>
      </div>
      <div className={`p-3 rounded-full ${bgClass} ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>
    </CardContent>
  </Card>
);

export default function RequestsPage() {
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [comment, setComment] = useState('');
  const [reassignTargetRequest, setReassignTargetRequest] = useState<Request | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState<number | null>(null);
  const [reassignRemark, setReassignRemark] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [slaFilter, setSlaFilter] = useState<'all' | 'normal' | 'warning' | 'danger'>('all');

  const { data: requestsData, isLoading } = usePendingApprovals();
  const { data: slaData } = usePendingWithSla();
  const processAction = useProcessAction();
  const { data: availableOfficers = [], isLoading: isLoadingOfficers } = useAvailableOfficers();
  const reassignMutation = useReassignRequest();

  const slaMap = useMemo(() => {
    const map = new Map<number, SlaInfo>();
    const rows = (slaData as SlaInfo[] | undefined) ?? [];
    for (const row of rows) {
      map.set(row.request_id, row);
    }
    return map;
  }, [slaData]);

  const requests = useMemo<Request[]>(() => {
    if (!Array.isArray(requestsData)) return [];
    return (requestsData as RequestWithDetails[]).map((req) => {
      const submission = parseSubmissionData(req.submission_data);
      const requesterTitle =
        (pickSubmissionValue(submission, 'title') as string | undefined) ||
        ((req.requester as { title?: string } | undefined)?.title ?? '');
      const requesterName =
        req.requester?.first_name || req.requester?.last_name
          ? `${requesterTitle} ${req.requester?.first_name ?? ''} ${req.requester?.last_name ?? ''}`.trim()
          : undefined;
      const name =
        requesterName ||
        (pickSubmissionValue(submission, 'first_name', 'firstName') ||
        pickSubmissionValue(submission, 'last_name', 'lastName')
          ? `${String(pickSubmissionValue(submission, 'title') ?? '')} ${String(
              pickSubmissionValue(submission, 'first_name', 'firstName') ?? '',
            )} ${String(
              pickSubmissionValue(submission, 'last_name', 'lastName') ?? '',
            )}`.trim()
          : undefined) ||
        (submission?.fullName as string | undefined) ||
        'ไม่ระบุ';

      const rateMapping = (pickSubmissionValue(submission, 'rate_mapping', 'rateMapping') ?? {}) as
        | {
            groupId?: string;
            itemId?: string;
            subItemId?: string;
            group_no?: number;
            item_no?: string;
            sub_item_no?: string;
          }
        | undefined;

      const rateGroup = sanitizeRatePart(rateMapping?.group_no ?? rateMapping?.groupId ?? '-');
      const rateItem = sanitizeRatePart(rateMapping?.item_no ?? rateMapping?.itemId ?? '-');
      const rateSubItem = sanitizeRatePart(rateMapping?.sub_item_no ?? rateMapping?.subItemId ?? '-');
      const rateMappingDisplay =
        rateSubItem !== '-' ? `${rateGroup}/${rateItem}/${rateSubItem}` : `${rateGroup}/${rateItem}`;
      const onBehalfMeta = getOnBehalfMetadata(submission);
      const sla = slaMap.get(req.request_id);
      let slaStatus: Request['slaStatus'] = 'unknown';
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
        id: req.request_id,
        requestNo: req.request_no ?? '-',
        name,
        position:
          (pickSubmissionValue(submission, 'position_name', 'positionName') as
            | string
            | undefined) ||
          req.requester?.position ||
          '-',
        department:
          req.current_department ||
          (pickSubmissionValue(submission, 'department') as string | undefined) ||
          '-',
        status: mapStatus(req.status),
        rateGroup,
        rateItem,
        rateSubItem: rateSubItem === '-' ? undefined : rateSubItem,
        rateMappingDisplay,
        amount: Number(req.requested_amount ?? 0),
        hasVerificationSnapshot: Boolean(req.has_verification_snapshot),
        isOfficerCreated: onBehalfMeta.isOfficerCreated,
        slaStatus,
        slaRemaining,
      };
    });
  }, [requestsData, slaMap]);

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.requestNo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSla =
      slaFilter === 'all' ||
      (slaFilter === 'normal' && request.slaStatus === 'normal') ||
      (slaFilter === 'warning' && request.slaStatus === 'warning') ||
      (slaFilter === 'danger' && request.slaStatus === 'danger');
    return matchesSearch && matchesSla;
  });

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;

    try {
      const action =
        actionType === 'approve' ? 'APPROVE' : actionType === 'reject' ? 'REJECT' : 'RETURN';
      await processAction.mutateAsync({
        id: selectedRequest.id,
        payload: { action, comment: comment.trim() },
      });
      toast.success('ดำเนินการคำขอเรียบร้อย');
      setSelectedRequest(null);
      setActionType(null);
      setComment('');
    } catch {
      toast.error('ไม่สามารถดำเนินการคำขอได้');
    }
  };

  const openReassignDialog = (request: Request) => {
    setReassignTargetRequest(request);
    setSelectedOfficerId(null);
    setReassignRemark('');
  };

  const handleReassign = async () => {
    if (!reassignTargetRequest) return;
    if (!selectedOfficerId) {
      toast.error('กรุณาเลือกเจ้าหน้าที่ปลายทาง');
      return;
    }
    if (!reassignRemark.trim()) {
      toast.error('กรุณาระบุเหตุผลการโยกงาน');
      return;
    }

    try {
      await reassignMutation.mutateAsync({
        id: reassignTargetRequest.id,
        payload: {
          target_officer_id: selectedOfficerId,
          remark: reassignRemark.trim(),
        },
      });
      toast.success('โยกงานสำเร็จ');
      setReassignTargetRequest(null);
      setSelectedOfficerId(null);
      setReassignRemark('');
    } catch (error: unknown) {
      const apiError = error as AxiosError<{ error?: string; message?: string }>;
      const apiMessage = apiError.response?.data?.error || apiError.response?.data?.message;
      toast.error(apiMessage || 'ไม่สามารถโยกงานได้');
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const verifiedCount = requests.filter((r) => r.hasVerificationSnapshot).length;
  const pendingVerificationCount = requests.filter((r) => !r.hasVerificationSnapshot).length;
  const totalAmount = requests.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">คำขอรออนุมัติ</h1>
          <p className="text-muted-foreground mt-1">ตรวจสอบและอนุมัติคำขอรับเงิน พ.ต.ส.</p>
        </div>
        {SHOW_CREATE_ON_BEHALF_BUTTON && (
          <Button asChild className="gap-2">
            <Link href="/pts-officer/requests/new">
              <UserPlus className="h-4 w-4" />
              สร้างคำขอแทนบุคลากร
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="รอดำเนินการ"
          value={pendingCount}
          icon={Clock}
          colorClass="text-primary"
          bgClass="bg-primary/10"
        />
        <StatCard
          title="ตรวจแล้ว"
          value={verifiedCount}
          icon={CheckCircle2}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-500/10"
        />
        <StatCard
          title="ยังไม่ได้ตรวจ"
          value={pendingVerificationCount}
          icon={AlertTriangle}
          colorClass="text-amber-600"
          bgClass="bg-amber-500/10"
        />
        <StatCard
          title="ยอดเงินรวมที่รอ"
          value={totalAmount}
          unit="บาท"
          icon={FileText}
          colorClass="text-blue-600"
          bgClass="bg-blue-500/10"
        />
      </div>

      {/* Main Content */}
      <Card className="border-border shadow-sm">
        <CardHeader className="py-4 px-6 border-b bg-muted/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              รายการคำขอที่รอดำเนินการ
            </CardTitle>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ, เลขที่คำขอ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-background pl-9 h-9"
                />
              </div>
              <Select value={slaFilter} onValueChange={(value) => setSlaFilter(value as typeof slaFilter)}>
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
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
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
                  <TableHead className="font-semibold text-right w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </TableCell>
                  </TableRow>
                ) : filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      ไม่พบรายการคำขอที่รอดำเนินการ
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((request) => (
                    <TableRow
                      key={request.id}
                      className="group hover:bg-muted/30 border-border transition-colors"
                    >
                      <TableCell className="font-mono text-sm">
                        <Link
                          href={`/pts-officer/requests/${request.id}`}
                          className="text-primary hover:underline"
                        >
                          {request.requestNo}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">{request.name}</span>
                            {request.isOfficerCreated ? (
                              <Badge
                                variant="outline"
                                className="border-primary/20 bg-primary/5 text-primary"
                              >
                                เจ้าหน้าที่สร้างแทน
                              </Badge>
                            ) : null}
                          </div>
                          <span
                            className="text-xs text-muted-foreground truncate max-w-[200px]"
                            title={request.position}
                          >
                            {request.position}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{request.department}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-normal">
                          {request.rateMappingDisplay}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
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
                          <TableRowViewAction href={`/pts-officer/requests/${request.id}`} />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <TableRowMoreActionsTrigger />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/pts-officer/requests/${request.id}`}
                                  className="cursor-pointer"
                                >
                                  <Eye className="mr-2 h-4 w-4" /> ดูรายละเอียด
                                </Link>
                              </DropdownMenuItem>
                              {request.status === 'pending' && (
                                <>
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => openReassignDialog(request)}
                                  >
                                    <UserPlus className="mr-2 h-4 w-4" /> โยกงานให้เจ้าหน้าที่คนอื่น
                                  </DropdownMenuItem>
                                </>
                              )}
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
            แสดง {filteredRequests.length} รายการ
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
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'ยืนยันการอนุมัติ'}
              {actionType === 'reject' && 'ยืนยันการไม่อนุมัติ'}
              {actionType === 'return' && 'ยืนยันการส่งกลับแก้ไข'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <span className="block mt-2 space-y-1">
                  <span className="block">
                    คำขอ:{' '}
                    <span className="font-mono text-foreground">{selectedRequest.requestNo}</span>
                  </span>
                  <span className="block">
                    ผู้ยื่น:{' '}
                    <span className="font-medium text-foreground">{selectedRequest.name}</span>
                  </span>
                  <span className="block">
                    จำนวนเงิน:{' '}
                    <span className="font-medium text-foreground">
                      {formatThaiNumber(selectedRequest.amount)}
                    </span>{' '}
                    บาท/เดือน
                  </span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-foreground mb-2 block">
              หมายเหตุ {actionType !== 'approve' && <span className="text-destructive">*</span>}
            </label>
            <Textarea
              placeholder={actionType === 'approve' ? 'หมายเหตุ (ถ้ามี)' : 'ระบุเหตุผล...'}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none"
              rows={3}
            />
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
              disabled={actionType !== 'approve' && !comment.trim()}
              variant={
                actionType === 'approve'
                  ? 'success'
                  : actionType === 'reject'
                    ? 'destructive'
                    : 'warning'
              }
            >
              {actionType === 'approve' && 'อนุมัติ'}
              {actionType === 'reject' && 'ไม่อนุมัติ'}
              {actionType === 'return' && 'ส่งกลับแก้ไข'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!reassignTargetRequest}
        onOpenChange={(open) => {
          if (!open) {
            setReassignTargetRequest(null);
            setSelectedOfficerId(null);
            setReassignRemark('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>โยกงาน</DialogTitle>
            <DialogDescription>
              {reassignTargetRequest ? (
                <span>
                  คำขอ:{' '}
                  <span className="font-mono text-foreground">
                    {reassignTargetRequest.requestNo}
                  </span>
                </span>
              ) : (
                'เลือกเจ้าหน้าที่ปลายทาง'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-medium mb-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> เงื่อนไขการโยกงาน
              </p>
              <ul className="list-disc list-inside space-y-0.5 opacity-90">
                <li>คำขอต้องมีสถานะ `PENDING` และอยู่ขั้น `PTS_OFFICER`</li>
                <li>ระบบต้องมีเจ้าหน้าที่ `PTS_OFFICER` ที่ active อย่างน้อย 2 คน</li>
                <li>ห้ามโยกงานให้ตัวเอง</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                เลือกเจ้าหน้าที่ปลายทาง <span className="text-destructive">*</span>
              </label>
              <Select
                value={selectedOfficerId ? String(selectedOfficerId) : ''}
                onValueChange={(val) => setSelectedOfficerId(Number(val))}
                disabled={isLoadingOfficers || reassignMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- เลือกเจ้าหน้าที่ --" />
                </SelectTrigger>
                <SelectContent>
                  {availableOfficers.map((officer) => (
                    <SelectItem key={officer.id} value={String(officer.id)}>
                      {officer.name} (ภาระงาน: {officer.workload})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                เหตุผลการโยกงาน <span className="text-destructive">*</span>
              </label>
              <Textarea
                rows={3}
                placeholder="ระบุเหตุผล เช่น ภาระงานสูง/มอบหมายใหม่"
                value={reassignRemark}
                onChange={(e) => setReassignRemark(e.target.value)}
                disabled={reassignMutation.isPending}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReassignTargetRequest(null);
                setSelectedOfficerId(null);
                setReassignRemark('');
              }}
            >
              ยกเลิก
            </Button>
            <Button onClick={handleReassign} disabled={reassignMutation.isPending}>
              ยืนยันโยกงาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
