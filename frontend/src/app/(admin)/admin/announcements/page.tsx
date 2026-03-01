'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Megaphone,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  EyeOff,
  Inbox,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useActivateAnnouncement,
  useCreateAnnouncement,
  useDeactivateAnnouncement,
  useUpdateAnnouncement,
} from '@/features/announcement/management';
import { useAllAnnouncements } from '@/features/announcement/listing';
import type { AnnouncementPriority } from '@/features/announcement/shared';
import { Switch } from '@/components/ui/switch';
import { formatThaiDate as formatThaiDateValue } from '@/shared/utils/thai-locale';
import { ROLE_OPTIONS } from '@/shared/utils/role-label';
import { cn } from '@/lib/utils';

// --- Types ---
type FormState = {
  title: string;
  body: string;
  priority: AnnouncementPriority;
  startAt: string;
  endAt: string;
};

// --- Constants ---
const ROLE_SCOPE = ROLE_OPTIONS;

// --- Helpers ---
const toDateInput = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const toThaiDate = (value?: string | null) => {
  if (!value) return '-';
  return formatThaiDateValue(value);
};

const getPriorityBadgeColor = (priority: string) => {
  switch (priority) {
    case 'HIGH':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'NORMAL':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'LOW':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-50 text-slate-700';
  }
};

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'HIGH':
      return 'สำคัญมาก';
    case 'NORMAL':
      return 'ทั่วไป';
    case 'LOW':
      return 'แจ้งทราบ';
    default:
      return priority;
  }
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export default function AnnouncementsPage() {
  // --- Hooks ---
  const { data = [], isLoading } = useAllAnnouncements();
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const activateMutation = useActivateAnnouncement();
  const deactivateMutation = useDeactivateAnnouncement();

  // --- State ---
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    title: '',
    body: '',
    priority: 'NORMAL',
    startAt: '',
    endAt: '',
  });

  // --- Data Processing ---
  const announcements = useMemo(() => {
    return [...data].sort((a, b) => {
      const ta = new Date(a.created_at ?? 0).getTime();
      const tb = new Date(b.created_at ?? 0).getTime();
      return tb - ta;
    });
  }, [data]);

  const stats = useMemo(() => {
    const active = announcements.filter((a) => a.is_active).length;
    const inactive = announcements.length - active;

    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    const expiringSoon = announcements.filter((a) => {
      if (!a.is_active || !a.end_at) return false;
      const endDate = new Date(a.end_at);
      return endDate > now && endDate <= nextWeek;
    }).length;

    return { active, inactive, expiringSoon };
  }, [announcements]);

  // --- Handlers ---
  const resetForm = () =>
    setForm({
      title: '',
      body: '',
      priority: 'NORMAL',
      startAt: '',
      endAt: '',
    });

  const openEdit = (item: (typeof announcements)[number]) => {
    setFormError(null);
    setEditingId(item.id);
    setForm({
      title: item.title,
      body: item.body,
      priority: item.priority,
      startAt: toDateInput(item.start_at),
      endAt: toDateInput(item.end_at),
    });
    setIsEditOpen(true);
  };

  const buildPayload = (isActive: boolean) => ({
    title: form.title.trim(),
    body: form.body.trim(),
    priority: form.priority,
    is_active: isActive,
    roles: ROLE_SCOPE,
    start_at: form.startAt ? new Date(`${form.startAt}T00:00:00.000Z`).toISOString() : undefined,
    end_at: form.endAt ? new Date(`${form.endAt}T23:59:59.000Z`).toISOString() : undefined,
  });

  const validateForm = () => {
    if (!form.title.trim() || !form.body.trim()) {
      setFormError('กรุณากรอกหัวข้อและเนื้อหาประกาศให้ครบถ้วน');
      return false;
    }
    if (form.startAt && form.endAt && form.startAt > form.endAt) {
      setFormError('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    setFormError(null);
    if (!validateForm()) return;

    try {
      await createMutation.mutateAsync(buildPayload(true));
      toast.success('สร้างประกาศสำเร็จ');
      setIsCreateOpen(false);
      resetForm();
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, 'ไม่สามารถสร้างประกาศได้'));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setFormError(null);
    if (!validateForm()) return;

    try {
      await updateMutation.mutateAsync({
        id: editingId,
        payload: buildPayload(true),
      });
      toast.success('บันทึกการแก้ไขสำเร็จ');
      setIsEditOpen(false);
      setEditingId(null);
      resetForm();
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, 'ไม่สามารถบันทึกข้อมูลได้'));
    }
  };

  const handleToggleActive = async (id: number, currentActive: boolean) => {
    try {
      if (currentActive) {
        await deactivateMutation.mutateAsync(id);
        toast.success('ปิดการแสดงประกาศแล้ว');
      } else {
        await activateMutation.mutateAsync(id);
        toast.success('เปิดการแสดงประกาศแล้ว');
      }
    } catch {
      toast.error('ไม่สามารถเปลี่ยนสถานะได้');
    }
  };

  // Shared Form Component Render
  const renderFormContent = () => (
    <div className="space-y-5 py-4">
      {formError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-foreground">
            หัวข้อประกาศ <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, title: e.target.value }));
              if (formError) setFormError(null);
            }}
            placeholder="เช่น แจ้งปิดปรับปรุงระบบชั่วคราว"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body" className="text-foreground">
            เนื้อหา <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="body"
            rows={5}
            value={form.body}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, body: e.target.value }));
              if (formError) setFormError(null);
            }}
            placeholder="รายละเอียดและวัตถุประสงค์ของประกาศ..."
            className="resize-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="priority" className="text-foreground">
              ระดับความสำคัญ
            </Label>
            <Select
              value={form.priority}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, priority: value as AnnouncementPriority }))
              }
            >
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">ต่ำ (แจ้งทราบ)</SelectItem>
                <SelectItem value="NORMAL">ปกติ (ทั่วไป)</SelectItem>
                <SelectItem value="HIGH">สูง (สำคัญมาก)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 p-4 bg-muted/30 border rounded-lg">
          <div className="space-y-2">
            <Label htmlFor="startAt" className="text-xs text-muted-foreground">
              วันที่เริ่มแสดง (เว้นว่างเพื่อแสดงทันที)
            </Label>
            <Input
              id="startAt"
              type="date"
              value={form.startAt}
              onChange={(e) => setForm((prev) => ({ ...prev, startAt: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endAt" className="text-xs text-muted-foreground">
              วันที่สิ้นสุด (เว้นว่างเพื่อแสดงตลอด)
            </Label>
            <Input
              id="endAt"
              type="date"
              value={form.endAt}
              onChange={(e) => setForm((prev) => ({ ...prev, endAt: e.target.value }))}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" /> จัดการประกาศ
          </h1>
          <p className="text-muted-foreground mt-1">
            สร้างและจัดการข้อมูลแจ้งเตือน เพื่อสื่อสารไปยังบุคลากรในระบบ
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setFormError(null);
            setIsCreateOpen(true);
          }}
          className="gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          สร้างประกาศใหม่
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">กำลังแสดงผล (Active)</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ปิดการแสดงผล (Inactive)</p>
                <p className="text-2xl font-bold text-muted-foreground mt-1">{stats.inactive}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground border border-border">
                <EyeOff className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            'border-border shadow-sm transition-colors',
            stats.expiringSoon > 0 && 'border-amber-200 bg-amber-50/30',
          )}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ใกล้หมดอายุ (ใน 7 วัน)</p>
                <p
                  className={cn(
                    'text-2xl font-bold mt-1',
                    stats.expiringSoon > 0 ? 'text-amber-600' : 'text-foreground',
                  )}
                >
                  {stats.expiringSoon}
                </p>
              </div>
              <div
                className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center border',
                  stats.expiringSoon > 0
                    ? 'bg-amber-100 text-amber-600 border-amber-200'
                    : 'bg-secondary text-muted-foreground border-border',
                )}
              >
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Announcements Table */}
      <Card className="border-border shadow-sm">
        <CardHeader className="border-b bg-muted/10 py-4 px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground">
              รายการประกาศทั้งหมด
            </CardTitle>
            <Badge variant="secondary" className="font-normal">
              {announcements.length} รายการ
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[45%]">หัวข้อ / เนื้อหา</TableHead>
                <TableHead>ช่วงเวลาแสดงผล</TableHead>
                <TableHead>ความสำคัญ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-3 w-[350px]" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-[100px]" />
                        <Skeleton className="h-3 w-[100px]" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-[60px] rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-[80px]" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-8 ml-auto rounded-md" />
                    </TableCell>
                  </TableRow>
                ))
              ) : announcements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                    <Inbox className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p>ยังไม่มีประกาศในระบบ</p>
                  </TableCell>
                </TableRow>
              ) : (
                announcements.map((announcement) => (
                  <TableRow key={announcement.id} className="group hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5 border border-primary/20">
                          <Megaphone className="h-4 w-4" />
                        </div>
                        <div className="space-y-1 pr-4">
                          <p
                            className="font-medium text-sm text-foreground line-clamp-1"
                            title={announcement.title}
                          >
                            {announcement.title}
                          </p>
                          <p
                            className="text-xs text-muted-foreground line-clamp-2"
                            title={announcement.body}
                          >
                            {announcement.body}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>เริ่ม: {toThaiDate(announcement.start_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-5">
                          <span className="text-border">|</span>
                          <span>สิ้นสุด: {toThaiDate(announcement.end_at)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`font-normal px-2 py-0 h-5 ${getPriorityBadgeColor(announcement.priority)}`}
                      >
                        {getPriorityLabel(announcement.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={announcement.is_active}
                          onCheckedChange={() =>
                            handleToggleActive(announcement.id, announcement.is_active)
                          }
                          disabled={activateMutation.isPending || deactivateMutation.isPending}
                        />
                        <span
                          className={cn(
                            'text-xs font-medium w-[50px]',
                            announcement.is_active ? 'text-emerald-600' : 'text-muted-foreground',
                          )}
                        >
                          {announcement.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
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
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            ตัวเลือกจัดการ
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openEdit(announcement)}
                            className="cursor-pointer"
                          >
                            <Pencil className="mr-2 h-4 w-4" /> แก้ไขประกาศ
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>สร้างประกาศใหม่</DialogTitle>
            <DialogDescription>
              เพิ่มข่าวสารหรือแจ้งเตือนเพื่อให้ผู้ใช้งานในระบบรับทราบ
            </DialogDescription>
          </DialogHeader>
          {renderFormContent()}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'กำลังบันทึก...' : 'ยืนยันการสร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>แก้ไขประกาศ</DialogTitle>
            <DialogDescription>ปรับปรุงข้อมูลรายละเอียดของประกาศที่มีอยู่เดิม</DialogDescription>
          </DialogHeader>
          {renderFormContent()}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
