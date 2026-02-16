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
  XCircle,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Check,
  X,
  RotateCcw,
  UserPlus,
  FileText,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { AxiosError } from 'axios';
import {
  useAvailableOfficers,
  usePendingApprovals,
  useProcessAction,
  useReassignRequest,
} from '@/features/request/hooks';
import type { RequestWithDetails } from '@/types/request.types';
import { toRequestDisplayId } from '@/shared/utils/public-id';
import { formatThaiNumber } from '@/shared/utils/thai-locale';

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'returned';

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
}

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

function getStatusBadge(status: RequestStatus) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1.5">
          <Clock className="h-3 w-3" />
          รออนุมัติ
        </Badge>
      );
    case 'approved':
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1.5"
        >
          <CheckCircle2 className="h-3 w-3" />
          อนุมัติแล้ว
        </Badge>
      );
    case 'returned':
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1.5"
        >
          <RefreshCw className="h-3 w-3" />
          ส่งกลับแก้ไข
        </Badge>
      );
    case 'rejected':
      return (
        <Badge
          variant="outline"
          className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5"
        >
          <XCircle className="h-3 w-3" />
          ไม่อนุมัติ
        </Badge>
      );
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
  const [filterStatus, setFilterStatus] = useState<RequestStatus | 'all'>('all');

  const { data: requestsData, isLoading } = usePendingApprovals();
  const processAction = useProcessAction();
  const { data: availableOfficers = [], isLoading: isLoadingOfficers } = useAvailableOfficers();
  const reassignMutation = useReassignRequest();

  const requests = useMemo<Request[]>(() => {
    if (!Array.isArray(requestsData)) return [];
    return (requestsData as RequestWithDetails[]).map((req) => {
      const submission = parseSubmissionData(req.submission_data);
      const requesterName =
        req.requester?.first_name || req.requester?.last_name
          ? `${req.requester?.first_name ?? ''} ${req.requester?.last_name ?? ''}`.trim()
          : undefined;
      const name =
        requesterName ||
        (pickSubmissionValue(submission, 'first_name', 'firstName') ||
        pickSubmissionValue(submission, 'last_name', 'lastName')
          ? `${String(pickSubmissionValue(submission, 'first_name', 'firstName') ?? '')} ${String(
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

      return {
        id: req.request_id,
        requestNo: req.request_no ?? toRequestDisplayId(req.request_id, req.created_at),
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
      };
    });
  }, [requestsData]);

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.requestNo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
    return matchesSearch && matchesStatus;
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

  const openActionDialog = (request: Request, action: 'approve' | 'reject' | 'return') => {
    setSelectedRequest(request);
    setActionType(action);
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
          icon={AlertCircle}
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
              <Inbox className="h-5 w-5 text-muted-foreground" />
              รายการคำขอ
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
              <Select
                value={filterStatus}
                onValueChange={(value) => setFilterStatus(value as RequestStatus | 'all')}
              >
                <SelectTrigger className="w-full sm:w-[140px] bg-background h-9">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="pending">รออนุมัติ</SelectItem>
                  <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
                  <SelectItem value="returned">ส่งกลับแก้ไข</SelectItem>
                  <SelectItem value="rejected">ไม่อนุมัติ</SelectItem>
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
                  <TableHead className="font-semibold text-center">สถานะ</TableHead>
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
                      ไม่พบรายการคำขอ
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((request) => (
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
                        {getStatusBadge(request.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            asChild
                          >
                            <Link href={`/pts-officer/requests/${request.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
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
                                    className="text-emerald-600 focus:text-emerald-700 cursor-pointer"
                                    onClick={() => openActionDialog(request, 'approve')}
                                  >
                                    <Check className="mr-2 h-4 w-4" /> อนุมัติ
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-amber-600 focus:text-amber-700 cursor-pointer"
                                    onClick={() => openActionDialog(request, 'return')}
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" /> ส่งกลับแก้ไข
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive cursor-pointer"
                                    onClick={() => openActionDialog(request, 'reject')}
                                  >
                                    <X className="mr-2 h-4 w-4" /> ไม่อนุมัติ
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => openReassignDialog(request)}
                                  >
                                    <UserPlus className="mr-2 h-4 w-4" /> โยกงาน (Reassign)
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
              className={
                actionType === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : actionType === 'reject'
                    ? 'bg-destructive hover:bg-destructive/90'
                    : 'bg-amber-500 hover:bg-amber-600'
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
            <DialogTitle>โยกงาน (Reassign)</DialogTitle>
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
