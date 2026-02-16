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
import { Bell, Clock, AlertCircle, Settings2, History } from 'lucide-react';
import { toast } from 'sonner';
import {
  usePendingWithSla,
  useSendSlaReminders,
  useSlaConfigs,
  useUpdateSlaConfig,
} from '@/features/sla/hooks';
import { Progress } from '@/components/ui/progress';

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
  business_days_elapsed?: number; // Assume API provides this or calculate it
};

export default function SLAConfigPage() {
  // --- Hooks ---
  const configsQuery = useSlaConfigs();
  const pendingQuery = usePendingWithSla();
  const updateMutation = useUpdateSlaConfig();
  const reminderMutation = useSendSlaReminders();

  // --- State ---
  const [isEditOpen, setIsEditOpen] = useState(false);
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

    // Basic Validation
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
      toast.success('บันทึกการตั้งค่าสำเร็จ');
      setIsEditOpen(false);
      configsQuery.refetch();
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'บันทึกข้อมูลไม่สำเร็จ');
      setActionError(message);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  const handleSendReminders = async () => {
    setActionError(null);
    try {
      const result = await reminderMutation.mutateAsync();
      toast.success(`ส่งแจ้งเตือนสำเร็จ (${result?.sentCount || 0} รายการ)`);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'ส่งแจ้งเตือนไม่สำเร็จ');
      setActionError(message);
      toast.error('เกิดข้อผิดพลาดในการส่งแจ้งเตือน');
    }
  };

  // Helper to get SLA days for a step
  const getSlaLimit = (stepNo: number) => {
    const config = configs.find((c) => c.step_no === stepNo);
    return config ? config.sla_days : 0;
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" /> ตั้งค่ากำหนดเวลา
          </h1>
          <p className="text-muted-foreground mt-1">
            กำหนดระยะเวลามาตรฐาน (ข้อตกลงระดับการให้บริการ) และการแจ้งเตือนสำหรับแต่ละขั้นตอน
          </p>
        </div>
        <Button
          variant="default"
          onClick={handleSendReminders}
          disabled={reminderMutation.isPending}
          className="gap-2"
        >
          <Bell className={`h-4 w-4 ${reminderMutation.isPending ? 'animate-swing' : ''}`} />
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
          className={`border-l-4 ${overdueCount > 0 ? 'border-l-destructive shadow-sm bg-destructive/5' : 'border-l-border'}`}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  รายการเกินกำหนด
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={`text-3xl font-bold ${overdueCount > 0 ? 'text-destructive' : 'text-foreground'}`}
                  >
                    {overdueCount}
                  </span>
                  <span className="text-sm text-muted-foreground">รายการ</span>
                </div>
              </div>
              <div
                className={`p-3 rounded-full ${overdueCount > 0 ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'}`}
              >
                <AlertCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-l-4 ${warningCount > 0 ? 'border-l-amber-500 shadow-sm bg-amber-50' : 'border-l-border'}`}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ใกล้ครบกำหนด</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={`text-3xl font-bold ${warningCount > 0 ? 'text-amber-600' : 'text-foreground'}`}
                  >
                    {warningCount}
                  </span>
                  <span className="text-sm text-muted-foreground">รายการ</span>
                </div>
              </div>
              <div
                className={`p-3 rounded-full ${warningCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-secondary text-muted-foreground'}`}
              >
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLA Config Table */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">ตารางกำหนดเวลา</CardTitle>
          <CardDescription>การตั้งค่าระยะเวลามาตรฐานแยกตามบทบาทและขั้นตอน</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[100px]">ขั้นตอน</TableHead>
                <TableHead>ผู้รับผิดชอบ (บทบาท)</TableHead>
                <TableHead className="text-center">SLA (วัน)</TableHead>
                <TableHead className="text-center">เตือนก่อน (วัน)</TableHead>
                <TableHead className="text-center">เตือนหลัง (วัน)</TableHead>
                <TableHead className="text-right w-[100px]">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="h-4 w-8 bg-muted animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="h-4 w-8 bg-muted animate-pulse rounded mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="h-4 w-8 bg-muted animate-pulse rounded mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="h-4 w-8 bg-muted animate-pulse rounded mx-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="h-8 w-16 bg-muted animate-pulse rounded ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : configs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    ไม่พบข้อมูลการตั้งค่า
                  </TableCell>
                </TableRow>
              ) : (
                configs.map((row) => (
                  <TableRow key={row.step_no} className="hover:bg-muted/20 group">
                    <TableCell className="font-medium">
                      <Badge variant="outline">ขั้นตอน {row.step_no}</Badge>
                    </TableCell>
                    <TableCell>{row.role_name}</TableCell>
                    <TableCell className="text-center font-mono font-medium">
                      {row.sla_days}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {row.reminder_before_days}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {row.reminder_after_days}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(row)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Settings2 className="h-4 w-4 mr-1" /> แก้ไข
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Items Table */}
      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" /> รายการที่ต้องติดตาม
            </CardTitle>
            <CardDescription>เฉพาะรายการที่ใกล้ถึงกำหนดหรือเกินกำหนดแล้ว</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trackedPending.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <CheckCircleIcon className="h-10 w-10 mx-auto text-emerald-500/50 mb-2" />
                <p>ยอดเยี่ยม! ไม่มีงานค้างที่ต้องติดตามเป็นพิเศษ</p>
              </div>
            ) : (
              trackedPending.slice(0, 10).map((item) => {
                const slaLimit = getSlaLimit(item.current_step);
                const progress =
                  slaLimit > 0 ? ((item.business_days_elapsed || 0) / slaLimit) * 100 : 0;

                return (
                  <div
                    key={item.request_id}
                    className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{item.request_no}</span>
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            ขั้นตอน {item.current_step}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.is_overdue ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" /> เกิน {item.days_overdue} วัน
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-amber-600 border-amber-200 bg-amber-50 gap-1"
                          >
                            <Clock className="h-3 w-3" /> เหลือ {item.days_until_sla} วัน
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>ระยะเวลาที่ใช้: {item.business_days_elapsed || 0} วัน</span>
                        <span>เป้าหมาย: {slaLimit} วัน</span>
                      </div>
                      <Progress
                        value={Math.min(progress, 100)}
                        className={`h-2 ${item.is_overdue ? '[&>div]:bg-destructive' : '[&>div]:bg-amber-500'}`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>แก้ไขค่า SLA</DialogTitle>
            <DialogDescription>
              {editing ? `ขั้นตอนที่ ${editing.step_no} - ${editing.role_name}` : ''}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="sla_days" className="text-right">
                  ระยะเวลา SLA (วันทำการ)
                </Label>
                <Input
                  id="sla_days"
                  type="number"
                  min="0"
                  className="col-span-3"
                  value={editing.sla_days}
                  onChange={(e) =>
                    setEditing({ ...editing, sla_days: parseInt(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="remind_before" className="text-xs text-muted-foreground">
                    เตือนก่อน (วัน)
                  </Label>
                  <Input
                    id="remind_before"
                    type="number"
                    min="0"
                    value={editing.reminder_before_days}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        reminder_before_days: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="remind_after" className="text-xs text-muted-foreground">
                    เตือนหลัง (วัน)
                  </Label>
                  <Input
                    id="remind_after"
                    type="number"
                    min="0"
                    value={editing.reminder_after_days}
                    onChange={(e) =>
                      setEditing({ ...editing, reminder_after_days: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
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
