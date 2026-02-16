'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  FileText,
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Filter,
  FilePen,
  List,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useMyRequests, useSubmitRequest, useCancelRequest } from '@/features/request/hooks';
import type { RequestWithDetails } from '@/types/request.types';
import { toRequestDisplayId } from '@/shared/utils/public-id';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatThaiDate, formatThaiNumber } from '@/shared/utils/thai-locale';

// Helper: Status Icons & Colors
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return <FilePen className="h-4 w-4" />;
    case 'PENDING':
      return <Clock className="h-4 w-4" />;
    case 'APPROVED':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'REJECTED':
      return <XCircle className="h-4 w-4" />;
    case 'RETURNED':
      return <AlertCircle className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return 'bg-secondary text-muted-foreground border-border';
    case 'PENDING':
      return 'bg-amber-500/10 text-amber-600 border-amber-200';
    case 'APPROVED':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
    case 'REJECTED':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'RETURNED':
      return 'bg-orange-500/10 text-orange-600 border-orange-200';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return 'แบบร่าง';
    case 'PENDING':
      return 'รอดำเนินการ';
    case 'APPROVED':
      return 'อนุมัติแล้ว';
    case 'PAID':
      return 'จ่ายเงินแล้ว';
    case 'RETURNED':
      return 'ถูกส่งกลับ';
    case 'REJECTED':
      return 'ไม่อนุมัติ';
    default:
      return status;
  }
};

const getPendingStepLabel = (step?: number | null) => {
  switch (step) {
    case 1:
      return 'รอหัวหน้าตึก/หัวหน้างาน';
    case 2:
      return 'รอหัวหน้ากลุ่มงาน';
    case 3:
      return 'รอเจ้าหน้าที่ พ.ต.ส.';
    case 4:
      return 'รอหัวหน้ากลุ่มงานทรัพยากรบุคคล';
    case 5:
      return 'รอหัวหน้าการเงิน';
    case 6:
      return 'รอผู้อำนวยการ';
    default:
      return 'รอดำเนินการ';
  }
};

const statusOptions = [
  { value: 'all', label: 'สถานะ: ทั้งหมด' },
  { value: 'DRAFT', label: 'แบบร่าง' },
  { value: 'PENDING', label: 'รอดำเนินการ' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว' },
  { value: 'RETURNED', label: 'ถูกส่งกลับ' },
  { value: 'REJECTED', label: 'ไม่อนุมัติ' },
];

// Helper Component: Stat Card
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

type HeadScopeMyRequestsPageProps = {
  basePath: string;
};

export function HeadScopeMyRequestsPage({ basePath }: HeadScopeMyRequestsPageProps) {
  const { data, isLoading } = useMyRequests();
  const submitRequest = useSubmitRequest();
  const cancelRequest = useCancelRequest();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  const requests = useMemo(() => {
    return (data ?? []).map((request: RequestWithDetails) => ({
      id: String(request.request_id),
      displayId: request.request_no ?? toRequestDisplayId(request.request_id, request.created_at),
      amount: request.requested_amount,
      status: request.status,
      current_step: request.current_step,
      created_at: request.created_at,
    }));
  }, [data]);

  const filteredRequests = useMemo(() => {
    const needle = searchTerm.toLowerCase();
    return requests.filter((request) => {
      const matchesSearch =
        request.id.toLowerCase().includes(needle) ||
        request.displayId.toLowerCase().includes(needle);
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);

  const stats = useMemo(
    () => ({
      total: requests.length,
      draft: requests.filter((r) => r.status === 'DRAFT').length,
      pending: requests.filter((r) => r.status === 'PENDING').length,
      approved: requests.filter((r) => r.status === 'APPROVED').length,
    }),
    [requests],
  );

  const handleSubmitRequest = (id: string | number) => {
    submitRequest.mutate(id, {
      onSuccess: () => toast.success('ส่งคำขอสำเร็จ'),
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
        toast.error(message);
      },
    });
  };

  const handleCancelRequest = () => {
    if (!cancelTargetId) return;
    cancelRequest.mutate(cancelTargetId, {
      onSuccess: () => {
        toast.success('ยกเลิกคำขอสำเร็จ');
        setCancelTargetId(null);
      },
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
        toast.error(message);
      },
    });
  };

  return (
    <TooltipProvider>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">คำขอของฉัน</h1>
            <p className="text-muted-foreground mt-1">
              จัดการและติดตามสถานะคำขอเบิกเงิน พ.ต.ส. ของคุณ
            </p>
          </div>
          <Link href={`${basePath}/my-requests/new`}>
            <Button className="shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              สร้างคำขอใหม่
            </Button>
          </Link>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="ทั้งหมด"
            value={stats.total}
            icon={List}
            colorClass="text-primary"
            bgClass="bg-primary/10"
          />
          <StatCard
            title="แบบร่าง"
            value={stats.draft}
            icon={FilePen}
            colorClass="text-muted-foreground"
            bgClass="bg-secondary"
          />
          <StatCard
            title="รอดำเนินการ"
            value={stats.pending}
            icon={Clock}
            colorClass="text-amber-600"
            bgClass="bg-amber-500/10"
          />
          <StatCard
            title="อนุมัติแล้ว"
            value={stats.approved}
            icon={CheckCircle2}
            colorClass="text-emerald-600"
            bgClass="bg-emerald-500/10"
          />
        </div>

        {/* Main Content */}
        <Card className="border-border shadow-sm">
          <CardHeader className="py-4 px-6 border-b bg-muted/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                รายการคำขอ
              </CardTitle>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาเลขที่คำขอ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-background pl-9 h-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] bg-background h-9">
                    <div className="flex items-center gap-2 truncate">
                      <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                      <SelectValue placeholder="สถานะ" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
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
                    <TableHead className="w-[180px] font-semibold">เลขที่คำขอ</TableHead>
                    <TableHead className="font-semibold text-right">จำนวนเงิน (บาท)</TableHead>
                    <TableHead className="font-semibold text-center">สถานะ</TableHead>
                    <TableHead className="font-semibold">ขั้นตอนปัจจุบัน</TableHead>
                    <TableHead className="font-semibold">วันที่สร้าง</TableHead>
                    <TableHead className="text-right font-semibold w-[140px]">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        กำลังโหลดข้อมูล...
                      </TableCell>
                    </TableRow>
                  ) : filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        ไม่พบรายการคำขอ
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map((request) => (
                      <TableRow
                        key={request.id}
                        className="group hover:bg-muted/30 border-border transition-colors"
                      >
                        <TableCell className="font-mono text-sm font-medium">
                          <Link
                            href={`${basePath}/my-requests/${request.id}`}
                            className="hover:underline text-primary transition-colors"
                          >
                            {request.displayId}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatThaiNumber(request.amount ?? 0)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={`gap-1.5 font-normal ${getStatusColor(request.status)}`}
                          >
                            {getStatusIcon(request.status)}
                            {getStatusLabel(request.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {request.status === 'PENDING'
                            ? getPendingStepLabel(request.current_step)
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {request.created_at ? formatThaiDate(request.created_at) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                  asChild
                                >
                                  <Link href={`${basePath}/my-requests/${request.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>ดูรายละเอียด</TooltipContent>
                            </Tooltip>

                            {request.status === 'DRAFT' && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                      asChild
                                    >
                                      <Link href={`${basePath}/my-requests/${request.id}/edit`}>
                                        <Edit className="h-4 w-4" />
                                      </Link>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>แก้ไข</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-primary hover:bg-primary/10"
                                      onClick={() => handleSubmitRequest(request.id)}
                                      disabled={submitRequest.isPending}
                                    >
                                      <Send className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>ส่งคำขอ</TooltipContent>
                                </Tooltip>
                              </>
                            )}

                            {(request.status === 'PENDING' || request.status === 'RETURNED') && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => setCancelTargetId(request.id)}
                                    disabled={cancelRequest.isPending}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>ยกเลิกคำขอ</TooltipContent>
                              </Tooltip>
                            )}
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

        {/* Cancel Confirmation Dialog */}
        <AlertDialog
          open={cancelTargetId !== null}
          onOpenChange={(open) => (!open ? setCancelTargetId(null) : null)}
        >
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการยกเลิกคำขอ</AlertDialogTitle>
              <AlertDialogDescription>
                เมื่อยกเลิกแล้ว จะไม่สามารถส่งคำขอนี้ต่อได้ ต้องการยืนยันหรือไม่?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ปิด</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelRequest}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                ยืนยันยกเลิก
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
