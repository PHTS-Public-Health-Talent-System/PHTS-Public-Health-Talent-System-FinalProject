'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Play, Send, RefreshCw, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAccessReviewCycles,
  useAccessReviewItems,
  useCompleteAccessReviewCycle,
  useCreateAccessReviewCycle,
  useRunAccessReviewAutoDisable,
  useSendAccessReviewReminders,
  useUpdateAccessReviewItem,
} from '@/features/access-review/hooks';
import { formatThaiDate, formatThaiDateTime, formatThaiNumber } from '@/shared/utils/thai-locale';
import { ConfirmActionDialog } from '@/components/common/confirm-action-dialog';

// --- Types ---
type ReviewCycle = {
  cycle_id: number;
  quarter: number;
  year: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  start_date: string;
  due_date: string;
  total_users: number;
  reviewed_users: number;
  disabled_users: number;
};

type ReviewItem = {
  item_id: number;
  user_name: string;
  citizen_id: string;
  current_role: string;
  review_result: 'KEEP' | 'DISABLE' | 'PENDING';
  last_login_at: string | null;
  reviewer_comment?: string;
};

// --- Helpers ---
const getResultBadge = (result: string) => {
  switch (result) {
    case 'KEEP':
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          อนุมัติคงสิทธิ์
        </Badge>
      );
    case 'DISABLE':
      return <Badge variant="destructive">ระงับสิทธิ์</Badge>;
    default:
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          รอตรวจสอบ
        </Badge>
      );
  }
};

export default function AccessReviewPage() {
  // --- State ---
  const [resultFilter, setResultFilter] = useState<'all' | 'PENDING' | 'KEEP' | 'DISABLE'>('all');
  const [selectedCycle, setSelectedCycle] = useState<string>('');

  // --- Hooks ---
  const cyclesQuery = useAccessReviewCycles();

  // Mutations
  const createCycleMutation = useCreateAccessReviewCycle();
  const completeCycleMutation = useCompleteAccessReviewCycle();
  const sendRemindersMutation = useSendAccessReviewReminders();
  const autoDisableMutation = useRunAccessReviewAutoDisable();
  const updateItemMutation = useUpdateAccessReviewItem();

  // --- Data Processing ---
  const cycles = useMemo(() => {
    const data = (cyclesQuery.data ?? []) as ReviewCycle[];
    return data.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.quarter - a.quarter;
    });
  }, [cyclesQuery.data]);

  const activeCycleId = useMemo(() => {
    if (selectedCycle) return Number(selectedCycle);
    return cycles[0]?.cycle_id;
  }, [cycles, selectedCycle]);

  const itemsQuery = useAccessReviewItems(activeCycleId, {
    result: resultFilter === 'all' ? undefined : resultFilter,
  });

  const items = (itemsQuery.data ?? []) as ReviewItem[];
  const activeCycle = cycles.find((c) => c.cycle_id === activeCycleId) ?? null;

  const pendingCount = Math.max(
    0,
    Number(activeCycle?.total_users ?? 0) - Number(activeCycle?.reviewed_users ?? 0),
  );

  const progress = activeCycle
    ? activeCycle.total_users > 0
      ? (activeCycle.reviewed_users / activeCycle.total_users) * 100
      : 0
    : 0;

  // --- Handlers ---
  const handleCreateCycle = async () => {
    try {
      await createCycleMutation.mutateAsync({});
      toast.success('สร้างรอบตรวจสอบสิทธิ์ประจำไตรมาสสำเร็จ');
      cyclesQuery.refetch();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถสร้างรอบใหม่ได้';
      toast.error(message);
    }
  };

  const handleReview = async (itemId: number, result: 'KEEP' | 'DISABLE') => {
    try {
      await updateItemMutation.mutateAsync({
        id: itemId,
        payload: { result },
      });
      toast.success(`บันทึกสถานะ ${result} สำเร็จ`);
      itemsQuery.refetch();
      cyclesQuery.refetch(); // Update progress
    } catch {
      toast.error('บันทึกผลตรวจสอบไม่สำเร็จ');
    }
  };

  const handleCompleteCycle = async (autoKeep: boolean = false) => {
    if (!activeCycleId) return;
    try {
      await completeCycleMutation.mutateAsync({
        id: activeCycleId,
        payload: {
          autoKeepPending: autoKeep,
          note: autoKeep ? 'อนุมัติคงสิทธิ์รายการที่เหลืออัตโนมัติ' : undefined,
        },
      });
      toast.success('ปิดรอบการตรวจสอบสำเร็จ');
      cyclesQuery.refetch();
      itemsQuery.refetch();
    } catch {
      toast.error('ปิดรอบไม่สำเร็จ');
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> ตรวจสอบสิทธิ์
          </h1>
          <p className="text-muted-foreground mt-1">
            บริหารจัดการรอบการตรวจสอบสิทธิ์ผู้ใช้งานประจำไตรมาส
          </p>
        </div>
        <div className="flex gap-2">
          <ConfirmActionDialog
            trigger={
              <Button size="sm" className="gap-2">
                <Play className="h-4 w-4" /> สร้างรอบใหม่
              </Button>
            }
            title="สร้างรอบตรวจสอบสิทธิ์ใหม่?"
            description="ระบบจะสร้างรอบตรวจสอบสำหรับไตรมาสปัจจุบัน และแจ้งเตือนหัวหน้างานให้เริ่มตรวจสอบลูกทีม"
            confirmText="สร้างรอบ"
            onConfirm={handleCreateCycle}
            disabled={createCycleMutation.isPending}
          />
        </div>
      </div>

      {/* Cycle Management Card */}
      <Card className="border-border shadow-sm bg-card">
        <CardHeader className="pb-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg">สถานะรอบปัจจุบัน</CardTitle>
              <CardDescription>
                {activeCycle
                  ? `ไตรมาส ${activeCycle.quarter}/${activeCycle.year} (${formatThaiDate(activeCycle.start_date)} - ${formatThaiDate(activeCycle.due_date)})`
                  : 'กรุณาเลือกหรือสร้างรอบการตรวจสอบ'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">เลือกรอบ:</span>
              <Select value={String(activeCycleId ?? '')} onValueChange={setSelectedCycle}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="เลือกรายการ" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle.cycle_id} value={String(cycle.cycle_id)}>
                      Q{cycle.quarter}/{cycle.year} ({cycle.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        {activeCycle && (
          <CardContent className="pt-6 space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  ความคืบหน้าการตรวจสอบ ({Math.round(progress)}%)
                </span>
                <span className="font-medium">
                  {formatThaiNumber(activeCycle.reviewed_users)} /{' '}
                  {formatThaiNumber(activeCycle.total_users)} คน
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>คงเหลือ: {formatThaiNumber(pendingCount)} คน</span>
                <span>ระงับสิทธิ์ไปแล้ว: {formatThaiNumber(activeCycle.disabled_users)} คน</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendRemindersMutation.mutateAsync()}
                disabled={sendRemindersMutation.isPending || activeCycle.status === 'COMPLETED'}
                className="gap-2"
              >
                <Send className="h-4 w-4" /> ส่งแจ้งเตือน
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => autoDisableMutation.mutateAsync()}
                disabled={autoDisableMutation.isPending}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" /> ระงับสิทธิ์อัตโนมัติ
              </Button>

              <div className="flex-1" />

              {activeCycle.status !== 'COMPLETED' && (
                <>
                  <ConfirmActionDialog
                    trigger={
                      <Button variant="secondary" size="sm">
                        ปิดรอบ + อนุมัติที่เหลือ
                      </Button>
                    }
                    title="ยืนยันการปิดรอบแบบอนุมัติอัตโนมัติ?"
                    description={`ระบบจะอนุมัติคงสิทธิ์ผู้ใช้ที่ยังรอการตรวจสอบทั้งหมด ${formatThaiNumber(pendingCount)} คน และปิดรอบทันที`}
                    confirmText="ยืนยันปิดรอบ"
                    onConfirm={() => handleCompleteCycle(true)}
                    disabled={completeCycleMutation.isPending}
                  />

                  <ConfirmActionDialog
                    trigger={
                      <Button variant="default" size="sm">
                        ปิดรอบ
                      </Button>
                    }
                    title="ยืนยันการปิดรอบ?"
                    description="การปิดรอบจะหยุดรับการตรวจสอบเพิ่มเติม คุณแน่ใจหรือไม่?"
                    confirmText="ยืนยัน"
                    onConfirm={() => handleCompleteCycle(false)}
                    disabled={completeCycleMutation.isPending}
                  />
                </>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Review Items Table */}
      <Card className="border-border shadow-sm">
        <CardHeader className="border-b bg-muted/10 py-4 px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-base font-semibold">รายชื่อผู้ใช้ในรอบนี้</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">สถานะ:</span>
              <Select
                value={resultFilter}
                onValueChange={(v: 'all' | 'PENDING' | 'KEEP' | 'DISABLE') => setResultFilter(v)}
              >
                <SelectTrigger className="w-[150px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="PENDING">รอตรวจสอบ</SelectItem>
                  <SelectItem value="KEEP">อนุมัติแล้ว</SelectItem>
                  <SelectItem value="DISABLE">ระงับสิทธิ์</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>ผู้ใช้งาน</TableHead>
                <TableHead>บทบาทปัจจุบัน</TableHead>
                <TableHead>เข้าใช้ล่าสุด</TableHead>
                <TableHead>ผลการตรวจสอบ</TableHead>
                <TableHead className="text-right">สิทธิ์ผู้ดูแลระบบ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    กำลังโหลดข้อมูล...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    ไม่พบรายการ
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.item_id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.user_name}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {item.citizen_id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {item.current_role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.last_login_at
                        ? formatThaiDateTime(item.last_login_at)
                        : 'ไม่เคยเข้าใช้งาน'}
                    </TableCell>
                    <TableCell>{getResultBadge(item.review_result)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:text-emerald-600"
                          onClick={() => handleReview(item.item_id, 'KEEP')}
                          title="อนุมัติคงสิทธิ์"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:text-destructive"
                          onClick={() => handleReview(item.item_id, 'DISABLE')}
                          title="ระงับสิทธิ์"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
