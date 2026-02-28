'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Clock, AlertCircle, Settings2, History, Pencil, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  usePendingWithSla,
  useSendSlaReminders,
  useSlaConfigs,
  useUpdateSlaConfig,
} from '@/features/sla/hooks';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// --- Types ---
type SlaConfig = {
  step_no: number;
  role_name: string;
  sla_days: number;
  reminder_before_days: number;
  reminder_after_days: number;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

type PendingSla = {
  request_id: number;
  request_no: string;
  current_step: number;
  is_overdue: boolean;
  is_approaching_sla: boolean;
  days_overdue: number;
  days_until_sla: number;
  business_days_elapsed?: number;
};

export default function SLAConfigPage() {
  // --- Hooks ---
  const configsQuery = useSlaConfigs();
  const pendingQuery = usePendingWithSla();
  const updateMutation = useUpdateSlaConfig();
  const reminderMutation = useSendSlaReminders();

  // --- State ---
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConfirmReminderOpen, setIsConfirmReminderOpen] = useState(false);
  const [editing, setEditing] = useState<SlaConfig | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // --- Data Processing ---
  const configs = useMemo(() => {
    const rows = (configsQuery.data ?? []) as Array<SlaConfig & { role?: string }>;
    return rows
      .map((row) => ({
        ...row,
        role_name: row.role_name || row.role || '-',
      }))
      .sort((a, b) => a.step_no - b.step_no);
  }, [configsQuery.data]);

  const pending = useMemo(() => (pendingQuery.data ?? []) as PendingSla[], [pendingQuery.data]);

  const trackedPending = useMemo(
    () => pending.filter((item) => item.is_overdue || item.is_approaching_sla),
    [pending],
  );

  const overdueCount = useMemo(() => pending.filter((p) => p.is_overdue).length, [pending]);
  const warningCount = useMemo(
    () => pending.filter((p) => p.is_approaching_sla && !p.is_overdue).length,
    [pending],
  );

  // --- Handlers ---
  const handleEdit = (row: SlaConfig) => {
    setActionError(null);
    setEditing({ ...row });
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setActionError(null);

    if (
      editing.sla_days < 0 ||
      editing.reminder_before_days < 0 ||
      editing.reminder_after_days < 0
    ) {
      setActionError('ค่าจำนวนวันต้องไม่ติดลบ');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        stepNo: editing.step_no,
        payload: {
          slaDays: Number(editing.sla_days),
          reminderBeforeDays: Number(editing.reminder_before_days),
          reminderAfterDays: Number(editing.reminder_after_days),
        },
      });
      toast.success('บันทึกการตั้งค่า SLA สำเร็จ');
      setIsEditOpen(false);
      configsQuery.refetch();
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'บันทึกข้อมูลไม่สำเร็จ');
      setActionError(message);
    }
  };

  const handleSendReminders = async () => {
    setIsConfirmReminderOpen(false);
    setActionError(null);
    try {
      const result = await reminderMutation.mutateAsync();
      toast.success(`ส่งแจ้งเตือนสำเร็จ (${result?.sentCount || 0} รายการ)`);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'ส่งแจ้งเตือนไม่สำเร็จ');
      setActionError(message);
    }
  };

  const getSlaLimit = (stepNo: number) => {
    const config = configs.find((c) => c.step_no === stepNo);
    return config ? config.sla_days : 0;
  };

  // Prevent invalid input in number fields
  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>, field: keyof SlaConfig) => {
    if (!editing) return;
    const val = parseInt(e.target.value);
    setEditing({ ...editing, [field]: isNaN(val) ? 0 : Math.max(0, val) });
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" /> ตั้งค่ากำหนดเวลา (SLA)
          </h1>
          <p className="text-muted-foreground mt-1">
            กำหนดระยะเวลามาตรฐานและการแจ้งเตือนสำหรับแต่ละขั้นตอนการทำงาน
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setIsConfirmReminderOpen(true)}
          disabled={reminderMutation.isPending || trackedPending.length === 0}
          className="gap-2 bg-background shadow-sm"
        >
          <Bell
            className={cn('h-4 w-4 text-primary', reminderMutation.isPending && 'animate-swing')}
          />
          {reminderMutation.isPending ? 'กำลังส่ง...' : 'ส่งการแจ้งเตือนทันที'}
        </Button>
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>เกิดข้อผิดพลาด</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card
          className={cn(
            'border-l-4 shadow-sm',
            overdueCount > 0 ? 'border-l-destructive bg-destructive/5' : 'border-l-border',
          )}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  รายการเกินกำหนด (Overdue)
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={cn(
                      'text-3xl font-bold',
                      overdueCount > 0 ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    {overdueCount}
                  </span>
                  <span className="text-sm text-muted-foreground">รายการ</span>
                </div>
              </div>
              <div
                className={cn(
                  'p-3 rounded-full',
                  overdueCount > 0
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                <AlertCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'border-l-4 shadow-sm',
            warningCount > 0 ? 'border-l-amber-500 bg-amber-50' : 'border-l-border',
          )}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  ใกล้ครบกำหนด (Approaching)
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={cn(
                      'text-3xl font-bold',
                      warningCount > 0 ? 'text-amber-600' : 'text-foreground',
                    )}
                  >
                    {warningCount}
                  </span>
                  <span className="text-sm text-muted-foreground">รายการ</span>
                </div>
              </div>
              <div
                className={cn(
                  'p-3 rounded-full',
                  warningCount > 0
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* SLA Config Table */}
        <div className="lg:col-span-7">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">ตารางกำหนดเวลา</CardTitle>
              <CardDescription>การตั้งค่าระยะเวลามาตรฐานแยกตามบทบาทและขั้นตอน</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[90px]">ขั้นตอน</TableHead>
                      <TableHead>บทบาทผู้รับผิดชอบ</TableHead>
                      <TableHead className="text-center w-[80px]">SLA</TableHead>
                      <TableHead className="text-center">แจ้งเตือน (วัน)</TableHead>
                      <TableHead className="text-right w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configsQuery.isLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Skeleton className="h-5 w-16" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-5 w-32" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-5 w-10 mx-auto" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-5 w-20 mx-auto" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-8 w-16 ml-auto" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : configs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          ไม่พบข้อมูลการตั้งค่า
                        </TableCell>
                      </TableRow>
                    ) : (
                      configs.map((row) => (
                        <TableRow key={row.step_no} className="hover:bg-muted/30">
                          <TableCell className="font-medium">
                            <Badge variant="outline" className="bg-background">
                              ขั้นที่ {row.step_no}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{row.role_name}</TableCell>
                          <TableCell className="text-center font-mono font-medium text-primary">
                            {row.sla_days}{' '}
                            <span className="text-[10px] text-muted-foreground font-sans">วัน</span>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            <div className="flex items-center justify-center gap-1.5">
                              <span title="เตือนก่อนกำหนด">ก่อน: {row.reminder_before_days}</span>
                              <span className="text-border">|</span>
                              <span title="เตือนหลังกำหนด">หลัง: {row.reminder_after_days}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {/* แสดงปุ่มแก้ไขให้ชัดเจนขึ้น แต่อ่อนลงเพื่อไม่ให้แย่งความสนใจ */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(row)}
                              className="h-8 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" /> แก้ไข
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Items Tracker */}
        <div className="lg:col-span-5">
          <Card className="border-border shadow-sm flex flex-col h-full">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" /> รายการที่ต้องติดตาม
              </CardTitle>
              <CardDescription>รายการที่ใกล้ถึงกำหนดหรือเกินกำหนด</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-3">
                {pendingQuery.isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))
                ) : trackedPending.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground border border-dashed rounded-lg bg-muted/10">
                    <CheckCircleIcon className="h-10 w-10 mx-auto text-emerald-500/40 mb-3" />
                    <p className="text-sm">ยอดเยี่ยม! ไม่มีงานค้างที่ต้องติดตามเป็นพิเศษ</p>
                  </div>
                ) : (
                  trackedPending.slice(0, 10).map((item) => {
                    const slaLimit = getSlaLimit(item.current_step);
                    const progress =
                      slaLimit > 0 ? ((item.business_days_elapsed || 0) / slaLimit) * 100 : 0;

                    return (
                      <div
                        key={item.request_id}
                        className="p-3.5 rounded-lg border bg-card hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="font-semibold text-sm text-foreground">
                              {item.request_no}
                            </span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              รอที่ขั้นตอน {item.current_step}
                            </p>
                          </div>
                          {item.is_overdue ? (
                            <Badge variant="destructive" className="gap-1 px-1.5 py-0 text-[10px]">
                              <AlertCircle className="h-3 w-3" /> เกิน {item.days_overdue} วัน
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-amber-600 border-amber-200 bg-amber-50 gap-1 px-1.5 py-0 text-[10px]"
                            >
                              <Clock className="h-3 w-3" /> เหลือ {item.days_until_sla} วัน
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1.5 mt-3">
                          <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                            <span>ใช้เวลาไป: {item.business_days_elapsed || 0} วัน</span>
                            <span>SLA: {slaLimit} วัน</span>
                          </div>
                          <Progress
                            value={Math.min(progress, 100)}
                            className={cn(
                              'h-1.5',
                              item.is_overdue ? '[&>div]:bg-destructive' : '[&>div]:bg-amber-500',
                            )}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Config Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>แก้ไขข้อตกลง (SLA)</DialogTitle>
            <DialogDescription>
              {editing ? (
                <>
                  ขั้นตอนที่ <strong className="text-foreground">{editing.step_no}</strong> :{' '}
                  {editing.role_name}
                </>
              ) : (
                'กำลังโหลดข้อมูล...'
              )}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="grid gap-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="sla_days" className="text-foreground">
                  ระยะเวลาดำเนินการมาตรฐาน
                </Label>
                <div className="relative">
                  <Input
                    id="sla_days"
                    type="number"
                    min="0"
                    className="font-mono text-lg font-semibold pl-4 pr-16 h-12"
                    value={editing.sla_days}
                    onChange={(e) => handleNumberInput(e, 'sla_days')}
                  />
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-muted-foreground text-sm">
                    วันทำการ
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" /> การตั้งค่าแจ้งเตือน
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="remind_before" className="text-xs text-muted-foreground">
                      เตือนล่วงหน้า (วัน)
                    </Label>
                    <Input
                      id="remind_before"
                      type="number"
                      min="0"
                      className="font-mono"
                      value={editing.reminder_before_days}
                      onChange={(e) => handleNumberInput(e, 'reminder_before_days')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="remind_after" className="text-xs text-muted-foreground">
                      เตือนเมื่อเกิน (วัน)
                    </Label>
                    <Input
                      id="remind_after"
                      type="number"
                      min="0"
                      className="font-mono"
                      value={editing.reminder_after_days}
                      onChange={(e) => handleNumberInput(e, 'reminder_after_days')}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Send Reminders */}
      <Dialog open={isConfirmReminderOpen} onOpenChange={setIsConfirmReminderOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full mb-4 w-fit">
              <Send className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">ยืนยันส่งการแจ้งเตือน?</DialogTitle>
            <DialogDescription className="text-center">
              ระบบจะทำการส่งอีเมลแจ้งเตือนไปยังผู้รับผิดชอบ <br />
              สำหรับรายการที่เกินกำหนดและใกล้ครบกำหนดทั้งหมด
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsConfirmReminderOpen(false)}
              className="w-full sm:w-auto"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSendReminders}
              disabled={reminderMutation.isPending}
              className="w-full sm:w-auto"
            >
              ยืนยันการส่ง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
