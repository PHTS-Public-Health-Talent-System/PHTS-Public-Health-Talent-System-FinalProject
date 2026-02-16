"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Megaphone,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";
import {
  useActivateAnnouncement,
  useAllAnnouncements,
  useCreateAnnouncement,
  useDeactivateAnnouncement,
  useUpdateAnnouncement,
} from "@/features/announcement/hooks";
import type { AnnouncementPriority } from "@/features/announcement/api";
import { Switch } from "@/components/ui/switch";
import { formatThaiDate as formatThaiDateValue } from "@/shared/utils/thai-locale";

// --- Types ---
type FormState = {
  title: string;
  body: string;
  priority: AnnouncementPriority;
  startAt: string;
  endAt: string;
};

// --- Constants ---
const ROLE_SCOPE = [
  "USER", "HEAD_WARD", "HEAD_DEPT", "PTS_OFFICER",
  "HEAD_HR", "HEAD_FINANCE", "FINANCE_OFFICER", "DIRECTOR", "ADMIN",
];

// --- Helpers ---
const toDateInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const toThaiDate = (value?: string | null) => {
  return formatThaiDateValue(value);
};

const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
        case "HIGH": return "bg-red-100 text-red-700 border-red-200";
        case "NORMAL": return "bg-blue-50 text-blue-700 border-blue-200";
        case "LOW": return "bg-slate-100 text-slate-600 border-slate-200";
        default: return "bg-slate-50 text-slate-700";
    }
}

const getPriorityLabel = (priority: string) => {
    switch (priority) {
        case "HIGH": return "สำคัญมาก";
        case "NORMAL": return "ทั่วไป";
        case "LOW": return "แจ้งทราบ";
        default: return priority;
	}
}

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
    title: "",
    body: "",
    priority: "NORMAL",
    startAt: "",
    endAt: "",
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
    // Check if end_at is within next 7 days and is active
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
      title: "",
      body: "",
      priority: "NORMAL",
      startAt: "",
      endAt: "",
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
    roles: ROLE_SCOPE, // Default to all roles for now
    start_at: form.startAt ? new Date(`${form.startAt}T00:00:00.000Z`).toISOString() : undefined,
    end_at: form.endAt ? new Date(`${form.endAt}T23:59:59.000Z`).toISOString() : undefined,
  });

  const handleCreate = async () => {
    setFormError(null);
    if (!form.title.trim() || !form.body.trim()) {
      setFormError("กรุณากรอกหัวข้อและเนื้อหาประกาศ");
      return;
    }
    if (form.startAt && form.endAt && form.startAt > form.endAt) {
      setFormError("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด");
      return;
    }
    try {
      await createMutation.mutateAsync(buildPayload(true));
      toast.success("สร้างประกาศสำเร็จ");
      setIsCreateOpen(false);
      resetForm();
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, "ไม่สามารถสร้างประกาศได้"));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setFormError(null);
    if (!form.title.trim() || !form.body.trim()) {
      setFormError("กรุณากรอกหัวข้อและเนื้อหาประกาศ");
      return;
    }
    if (form.startAt && form.endAt && form.startAt > form.endAt) {
      setFormError("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: editingId,
        payload: buildPayload(true),
      });
      toast.success("บันทึกการแก้ไขสำเร็จ");
      setIsEditOpen(false);
      setEditingId(null);
      resetForm();
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, "ไม่สามารถบันทึกข้อมูลได้"));
    }
  };

  const handleToggleActive = async (id: number, currentActive: boolean) => {
    try {
      if (currentActive) {
        await deactivateMutation.mutateAsync(id);
        toast.success("ปิดการแสดงประกาศแล้ว");
      } else {
        await activateMutation.mutateAsync(id);
        toast.success("เปิดการแสดงประกาศแล้ว");
      }
    } catch {
      toast.error("ไม่สามารถเปลี่ยนสถานะได้");
    }
  };

  const announcementForm = (
    <div className="space-y-4 py-2">
        {formError && (
            <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{formError}</AlertDescription>
            </Alert>
        )}
        <div className="space-y-2">
            <Label htmlFor="title">หัวข้อประกาศ <span className="text-red-500">*</span></Label>
            <Input
            id="title"
            value={form.title}
            onChange={(e) => {
                setForm((prev) => ({ ...prev, title: e.target.value }));
                setFormError(null);
            }}
            placeholder="เช่น ปิดปรับปรุงระบบ, แจ้งกำหนดการส่งเอกสาร"
            />
        </div>
        <div className="space-y-2">
            <Label htmlFor="body">เนื้อหา <span className="text-red-500">*</span></Label>
            <Textarea
            id="body"
            rows={4}
            value={form.body}
            onChange={(e) => {
                setForm((prev) => ({ ...prev, body: e.target.value }));
                setFormError(null);
            }}
            placeholder="รายละเอียดของประกาศ..."
            />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
                <Label htmlFor="priority">ระดับความสำคัญ</Label>
                <Select
                    value={form.priority}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value as AnnouncementPriority }))}
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
        <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
                <Label htmlFor="startAt">วันที่เริ่มแสดง (Optional)</Label>
                <Input
                    id="startAt"
                    type="date"
                    value={form.startAt}
                    onChange={(e) => setForm((prev) => ({ ...prev, startAt: e.target.value }))}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="endAt">วันที่สิ้นสุด (Optional)</Label>
                <Input
                    id="endAt"
                    type="date"
                    value={form.endAt}
                    onChange={(e) => setForm((prev) => ({ ...prev, endAt: e.target.value }))}
                />
            </div>
        </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">จัดการประกาศ (Announcements)</h1>
          <p className="text-muted-foreground mt-1">
            สร้างข่าวสารและแจ้งเตือนไปยังผู้ใช้งานในระบบ
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setFormError(null);
            setIsCreateOpen(true);
          }}
          className="gap-2"
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
                <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
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
                <p className="text-2xl font-bold text-muted-foreground">{stats.inactive}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                <EyeOff className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ใกล้หมดอายุ (ใน 7 วัน)</p>
                <p className={`text-2xl font-bold ${stats.expiringSoon > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{stats.expiringSoon}</p>
              </div>
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stats.expiringSoon > 0 ? "bg-amber-100 text-amber-600" : "bg-secondary text-muted-foreground"}`}>
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
                <CardTitle className="text-base font-semibold">รายการประกาศทั้งหมด</CardTitle>
                <Badge variant="secondary" className="font-normal">{announcements.length} รายการ</Badge>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[40%]">หัวข้อ / เนื้อหา</TableHead>
                <TableHead>ช่วงเวลาแสดงผล</TableHead>
                <TableHead>ความสำคัญ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>วันที่สร้าง</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><div className="h-4 w-3/4 bg-muted animate-pulse rounded mb-2" /><div className="h-3 w-1/2 bg-muted animate-pulse rounded" /></TableCell>
                        <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                        <TableCell><div className="h-5 w-16 bg-muted animate-pulse rounded" /></TableCell>
                        <TableCell><div className="h-5 w-12 bg-muted animate-pulse rounded" /></TableCell>
                        <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                        <TableCell className="text-right"><div className="h-8 w-8 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                    </TableRow>
                ))
              ) : announcements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    ยังไม่มีประกาศในระบบ
                  </TableCell>
                </TableRow>
              ) : (
                announcements.map((announcement) => (
                  <TableRow key={announcement.id} className="group hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                          <Megaphone className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-sm text-foreground line-clamp-1">{announcement.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1 max-w-[300px]">
                            {announcement.body}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {toThaiDate(announcement.start_at)}</span>
                        <span className="ml-4">ถึง {toThaiDate(announcement.end_at)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-normal ${getPriorityBadgeColor(announcement.priority)}`}>
                        {getPriorityLabel(announcement.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={announcement.is_active}
                                onCheckedChange={() => handleToggleActive(announcement.id, announcement.is_active)}
                                disabled={activateMutation.isPending || deactivateMutation.isPending}
                            />
                            <span className={`text-xs ${announcement.is_active ? "text-emerald-600" : "text-muted-foreground"}`}>
                                {announcement.is_active ? "Active" : "Inactive"}
                            </span>
                        </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                        {toThaiDate(announcement.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>ตัวเลือก</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEdit(announcement)} className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4 text-muted-foreground" /> แก้ไขข้อมูล
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
            <DialogDescription>เพิ่มข่าวสารหรือแจ้งเตือนเพื่อให้ผู้ใช้งานรับทราบ</DialogDescription>
          </DialogHeader>
          {announcementForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "กำลังสร้าง..." : "ยืนยันการสร้าง"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>แก้ไขประกาศ</DialogTitle>
            <DialogDescription>ปรับปรุงข้อมูลประกาศที่มีอยู่เดิม</DialogDescription>
          </DialogHeader>
          {announcementForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
