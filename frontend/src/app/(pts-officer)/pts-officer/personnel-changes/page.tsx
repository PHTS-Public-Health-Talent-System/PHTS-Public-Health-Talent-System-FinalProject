'use client';
export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import {
  Search,
  Plus,
  Eye,
  Calendar,
  UserX,
  ArrowRightLeft,
  Clock,
  FileText,
  User,
  CalendarClock,
  Edit,
  Trash2,
  CheckCircle,
  History,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PersonPicker } from '@/components/person-picker';
import {
  useCreatePersonnelMovement,
  useCreateRetirement,
  useDeletePersonnelMovement,
  useDeleteRetirement,
  usePersonnelMovements,
  useRetirements,
  useUpdatePersonnelMovement,
  useUpdateRetirement,
} from '@/features/personnel-changes/hooks';
import { useEligibilityList } from '@/features/request/hooks';
import { resolveProfessionLabel } from '@/shared/constants/profession';
import { formatThaiDate } from '@/shared/utils/thai-locale';

type ChangeType = 'retirement' | 'resign' | 'transfer';
type ChangeStatus = 'pending' | 'completed';
type SourceType = 'retirement' | 'movement';

interface PersonnelChange {
  id: string;
  sourceType: SourceType;
  sourceId: number;
  personId: string;
  personName: string;
  personPosition: string;
  personDepartment: string;
  profession: string;
  changeType: ChangeType;
  effectiveDate: string;
  reason?: string;
  transferTo?: string;
  status: ChangeStatus;
  notifiedAt: string;
  processedAt?: string;
  note?: string;
}

const changeTypeConfig: Record<
  ChangeType,
  { label: string; color: string; icon: React.ElementType }
> = {
  retirement: {
    label: 'เกษียณอายุ',
    color: 'bg-purple-500/10 text-purple-600 border-purple-200',
    icon: CalendarClock,
  },
  resign: { label: 'ลาออก', color: 'bg-red-500/10 text-red-600 border-red-200', icon: UserX },
  transfer: {
    label: 'ย้าย',
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
    icon: ArrowRightLeft,
  },
};

const statusConfig: Record<
  ChangeStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: 'รอวันที่มีผล',
    color: 'bg-amber-500/10 text-amber-600 border-amber-200',
    icon: Clock,
  },
  completed: {
    label: 'มีผลแล้ว',
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    icon: CheckCircle,
  },
};

// ... (Helper functions: formatDateDisplay, toDateInputValue, compareDateOnly remain same)
function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '-';
  return formatThaiDate(dateStr);
}

function toDateInputValue(value: string): string {
  if (!value) return '';
  const raw = String(value);
  const ymd = raw.length >= 10 ? raw.slice(0, 10) : raw;
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : '';
}

function compareDateOnly(dateStr: string, now: Date): number {
  const target = new Date(dateStr);
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return dayTarget.getTime() - current.getTime();
}

// Helper Component for Stats
function StatCard({
  title,
  value,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="text-2xl font-bold mt-1">
            {value}{' '}
            <span className="text-xs font-normal text-muted-foreground">รายการ</span>
          </div>
        </div>
        <div className={`p-3 rounded-full ${bgClass} ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PersonnelChangesPage() {
  // ... (State and Hooks remain same)
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedChange, setSelectedChange] = useState<PersonnelChange | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const retirementsQuery = useRetirements();
  const movementsQuery = usePersonnelMovements();
  const eligibilityQuery = useEligibilityList(true);

  const createRetirement = useCreateRetirement();
  const updateRetirement = useUpdateRetirement();
  const deleteRetirement = useDeleteRetirement();
  const createMovement = useCreatePersonnelMovement();
  const updateMovement = useUpdatePersonnelMovement();
  const deleteMovement = useDeletePersonnelMovement();

  // ... (Data processing logic remains same)
  const personnel = useMemo(() => {
    const rows = Array.isArray(eligibilityQuery.data) ? eligibilityQuery.data : [];
    const map = new Map<
      string,
      { id: string; name: string; position: string; department: string; profession: string }
    >();
    rows.forEach((row) => {
      if (!row.citizen_id || map.has(row.citizen_id)) return;
      const name =
        `${row.title ?? ''}${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.citizen_id;
      map.set(row.citizen_id, {
        id: row.citizen_id,
        name,
        position: row.position_name ?? '-',
        department: row.department ?? '-',
        profession: resolveProfessionLabel(row.profession_code, row.position_name ?? '-'),
      });
    });
    return Array.from(map.values());
  }, [eligibilityQuery.data]);

  const personnelByCitizenId = useMemo(() => {
    const map = new Map<string, { position: string; department: string; profession: string }>();
    personnel.forEach((p) => {
      map.set(p.id, {
        position: p.position,
        department: p.department,
        profession: p.profession,
      });
    });
    return map;
  }, [personnel]);

  const personnelChanges = useMemo(() => {
    const now = new Date();
    const retirements = (Array.isArray(retirementsQuery.data) ? retirementsQuery.data : []).map(
      (row) => {
        const fullName = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.citizen_id;
        const profile = personnelByCitizenId.get(row.citizen_id);
        const retireDate = toDateInputValue(String(row.retire_date ?? ''));
        const dayDiff = compareDateOnly(retireDate, now);
        const status: ChangeStatus = dayDiff > 0 ? 'pending' : 'completed';
        return {
          id: `RET-${row.retirement_id}`,
          sourceType: 'retirement' as const,
          sourceId: row.retirement_id,
          personId: row.citizen_id,
          personName: fullName,
          personPosition: row.position_name ?? profile?.position ?? '-',
          personDepartment: row.department ?? profile?.department ?? '-',
          profession:
            profile?.profession ?? resolveProfessionLabel(undefined, row.position_name ?? '-'),
          changeType: 'retirement' as const,
          effectiveDate: retireDate,
          status,
          notifiedAt: row.created_at ? String(row.created_at).slice(0, 10) : retireDate,
          note: row.note ?? undefined,
        };
      },
    );

    const movements = (Array.isArray(movementsQuery.data) ? movementsQuery.data : []).map((row) => {
      const fullName = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.citizen_id;
      const profile = personnelByCitizenId.get(row.citizen_id);
      const effectiveDate = toDateInputValue(String(row.effective_date ?? ''));
      const dayDiff = compareDateOnly(effectiveDate, now);
      const status: ChangeStatus = dayDiff > 0 ? 'pending' : 'completed';
      const changeType: ChangeType = row.movement_type === 'TRANSFER_OUT' ? 'transfer' : 'resign';
      return {
        id: `MOV-${row.movement_id}`,
        sourceType: 'movement' as const,
        sourceId: row.movement_id,
        personId: row.citizen_id,
        personName: fullName,
        personPosition: row.position_name ?? profile?.position ?? '-',
        personDepartment: row.department ?? profile?.department ?? '-',
        profession:
          profile?.profession ?? resolveProfessionLabel(undefined, row.position_name ?? '-'),
        changeType,
        effectiveDate,
        reason: changeType === 'resign' ? (row.remark ?? undefined) : undefined,
        transferTo: changeType === 'transfer' ? (row.remark ?? undefined) : undefined,
        status,
        notifiedAt: effectiveDate,
        processedAt: status === 'completed' ? effectiveDate : undefined,
        note: row.remark ?? undefined,
      };
    });

    return [...retirements, ...movements].sort((a, b) =>
      b.effectiveDate.localeCompare(a.effectiveDate),
    );
  }, [movementsQuery.data, personnelByCitizenId, retirementsQuery.data]);

  const filteredChanges = personnelChanges.filter((change) => {
    const q = searchQuery.trim();
    const matchesSearch =
      !q || change.personName.includes(q) || change.personDepartment.includes(q);
    const matchesType = typeFilter === 'all' || change.changeType === typeFilter;
    const matchesStatus = statusFilter === 'all' || change.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const pendingCount = personnelChanges.filter((c) => c.status === 'pending').length;
  const retirementCount = personnelChanges.filter((c) => c.changeType === 'retirement').length;
  const resignCount = personnelChanges.filter((c) => c.changeType === 'resign').length;
  const transferCount = personnelChanges.filter((c) => c.changeType === 'transfer').length;

  const retirementForecast = useMemo(() => {
    const grouped = new Map<number, string[]>();
    personnelChanges
      .filter((c) => c.changeType === 'retirement')
      .forEach((c) => {
        const year = new Date(c.effectiveDate).getFullYear() + 543;
        if (!grouped.has(year)) grouped.set(year, []);
        grouped.get(year)!.push(c.personName);
      });
    return Array.from(grouped.entries())
      .map(([year, names]) => ({ year, count: names.length, names: names.slice(0, 12) }))
      .sort((a, b) => a.year - b.year);
  }, [personnelChanges]);

  // ... (Handlers remain same: handleAddChange, handleEditChange, handleDeleteChange)
  const handleAddChange = async (newChange: Partial<PersonnelChange>) => {
    if (!newChange.personId || !newChange.effectiveDate || !newChange.changeType) return;

    try {
      if (newChange.changeType === 'retirement') {
        await createRetirement.mutateAsync({
          citizen_id: newChange.personId,
          retire_date: newChange.effectiveDate,
          note: newChange.note,
        });
      } else {
        const movementType = newChange.changeType === 'transfer' ? 'TRANSFER_OUT' : 'RESIGN';
        const remark =
          newChange.changeType === 'transfer'
            ? newChange.transferTo || newChange.note
            : newChange.reason || newChange.note;
        await createMovement.mutateAsync({
          citizen_id: newChange.personId,
          movement_type: movementType,
          effective_date: newChange.effectiveDate,
          remark: remark || undefined,
        });
      }
      setShowAddDialog(false);
      setSuccessMessage('เพิ่มรายการการเปลี่ยนแปลงสำเร็จ');
      setShowSuccessDialog(true);
    } catch {
      toast.error('ไม่สามารถเพิ่มรายการได้');
    }
  };

  const handleEditChange = async (updatedChange: PersonnelChange) => {
    try {
      if (updatedChange.sourceType === 'retirement') {
        await updateRetirement.mutateAsync({
          retirementId: updatedChange.sourceId,
          payload: {
            citizen_id: updatedChange.personId,
            retire_date: updatedChange.effectiveDate,
            note: updatedChange.note,
          },
        });
      } else {
        await updateMovement.mutateAsync({
          movementId: updatedChange.sourceId,
          payload: {
            citizen_id: updatedChange.personId,
            movement_type: updatedChange.changeType === 'transfer' ? 'TRANSFER_OUT' : 'RESIGN',
            effective_date: updatedChange.effectiveDate,
            remark:
              (updatedChange.changeType === 'transfer'
                ? updatedChange.transferTo
                : updatedChange.reason) ||
              updatedChange.note ||
              undefined,
          },
        });
      }
      setShowEditDialog(false);
      setSuccessMessage('แก้ไขรายการสำเร็จ');
      setShowSuccessDialog(true);
    } catch {
      toast.error('ไม่สามารถแก้ไขรายการได้');
    }
  };

  const handleDeleteChange = async () => {
    if (!selectedChange) return;

    try {
      if (selectedChange.sourceType === 'retirement') {
        await deleteRetirement.mutateAsync(selectedChange.sourceId);
      } else {
        await deleteMovement.mutateAsync(selectedChange.sourceId);
      }
      setShowDeleteAlert(false);
      setSelectedChange(null);
      setSuccessMessage('ลบรายการสำเร็จ');
      setShowSuccessDialog(true);
    } catch {
      toast.error('ไม่สามารถลบรายการได้');
    }
  };

  const isLoading = retirementsQuery.isLoading || movementsQuery.isLoading;
  const isError = retirementsQuery.isError || movementsQuery.isError;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            การเปลี่ยนแปลงบุคลากร
          </h1>
          <p className="text-muted-foreground mt-1">
            ติดตามและจัดการการเกษียณอายุ ลาออก และย้ายของบุคลากร
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" />
          เพิ่มรายการใหม่
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="รอวันที่มีผล"
          value={pendingCount}
          icon={Clock}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
        />
        <StatCard
          title="เกษียณอายุ"
          value={retirementCount}
          icon={CalendarClock}
          colorClass="text-purple-600"
          bgClass="bg-purple-50"
        />
        <StatCard
          title="ลาออก"
          value={resignCount}
          icon={UserX}
          colorClass="text-red-600"
          bgClass="bg-red-50"
        />
        <StatCard
          title="ย้าย"
          value={transferCount}
          icon={ArrowRightLeft}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
        />
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="all" className="gap-2">
              <History className="h-4 w-4" /> ทั้งหมด
            </TabsTrigger>
            <TabsTrigger value="retirement" className="gap-2">
              <CalendarClock className="h-4 w-4" /> เกษียณอายุ
            </TabsTrigger>
            <TabsTrigger value="forecast" className="gap-2">
              <Calendar className="h-4 w-4" /> คาดการณ์
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="py-4 px-6 border-b bg-muted/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" />
                  รายการเปลี่ยนแปลงล่าสุด
                </CardTitle>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="ค้นหาชื่อ, แผนก..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-background h-9"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[140px] bg-background h-9">
                      <SelectValue placeholder="ประเภท" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกประเภท</SelectItem>
                      <SelectItem value="retirement">เกษียณอายุ</SelectItem>
                      <SelectItem value="resign">ลาออก</SelectItem>
                      <SelectItem value="transfer">ย้าย</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[140px] bg-background h-9">
                      <SelectValue placeholder="สถานะ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกสถานะ</SelectItem>
                      <SelectItem value="pending">รอวันที่มีผล</SelectItem>
                      <SelectItem value="completed">มีผลแล้ว</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-12 text-center text-muted-foreground">กำลังโหลดข้อมูล...</div>
              ) : isError ? (
                <div className="py-12 text-center text-destructive">โหลดข้อมูลไม่สำเร็จ</div>
              ) : (
                <ChangesTable
                  changes={filteredChanges}
                  onViewDetail={(change) => {
                    setSelectedChange(change);
                    setShowDetailDialog(true);
                  }}
                  onEdit={(change) => {
                    setSelectedChange(change);
                    setShowEditDialog(true);
                  }}
                  onDelete={(change) => {
                    setSelectedChange(change);
                    setShowDeleteAlert(true);
                  }}
                  formatDateDisplay={formatDateDisplay}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retirement">
          <Card className="border-border shadow-sm">
            <CardHeader className="py-4 px-6 border-b bg-muted/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
                รายการเกษียณอายุราชการ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ChangesTable
                changes={personnelChanges.filter((c) => c.changeType === 'retirement')}
                onViewDetail={(change) => {
                  setSelectedChange(change);
                  setShowDetailDialog(true);
                }}
                onEdit={(change) => {
                  setSelectedChange(change);
                  setShowEditDialog(true);
                }}
                onDelete={(change) => {
                  setSelectedChange(change);
                  setShowDeleteAlert(true);
                }}
                formatDateDisplay={formatDateDisplay}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast">
          <Card className="border-border shadow-sm">
            <CardHeader className="py-4 px-6 border-b bg-muted/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                คาดการณ์การเกษียณอายุราชการ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {retirementForecast.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</div>
                )}
                {retirementForecast.map((item) => (
                  <div
                    key={item.year}
                    className="flex gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center p-3 bg-purple-500/10 rounded-lg min-w-[80px]">
                      <span className="text-sm text-purple-600 font-medium">ปีงบ</span>
                      <span className="text-2xl font-bold text-purple-700">{item.year}</span>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">30 กันยายน {item.year}</h4>
                        <Badge
                          variant="secondary"
                          className="bg-purple-100 text-purple-700 hover:bg-purple-200"
                        >
                          {item.count} คน
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {item.names.map((name, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="font-normal bg-background text-muted-foreground"
                          >
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs... */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>เพิ่มรายการการเปลี่ยนแปลง</DialogTitle>
            <DialogDescription>บันทึกรายการเกษียณ ลาออก หรือย้ายของบุคลากร</DialogDescription>
          </DialogHeader>
          <AddChangeForm
            onClose={() => setShowAddDialog(false)}
            onSave={handleAddChange}
            personnel={personnel}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>แก้ไขรายการ</DialogTitle>
            <DialogDescription>แก้ไขข้อมูลของ {selectedChange?.personName}</DialogDescription>
          </DialogHeader>
          {selectedChange && (
            <EditChangeForm
              change={selectedChange}
              onClose={() => setShowEditDialog(false)}
              onSave={handleEditChange}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>รายละเอียดการเปลี่ยนแปลง</DialogTitle>
          </DialogHeader>
          {selectedChange && (
            <ChangeDetailContent change={selectedChange} formatDateDisplay={formatDateDisplay} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> ยืนยันการลบรายการ
            </DialogTitle>
            <DialogDescription>
              คุณต้องการลบรายการของ{' '}
              <span className="font-semibold text-foreground">{selectedChange?.personName}</span>{' '}
              ใช่หรือไม่? <br />
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChange}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ลบรายการ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-card border-border sm:max-w-sm">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="p-3 rounded-full bg-emerald-500/10 mb-4">
              <CheckCircle className="h-10 w-10 text-emerald-500" />
            </div>
            <DialogTitle className="text-xl mb-2">สำเร็จ</DialogTitle>
            <p className="text-muted-foreground">{successMessage}</p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowSuccessDialog(false)} className="w-full sm:w-32">
              ตกลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChangesTable({
  changes,
  onViewDetail,
  onEdit,
  onDelete,
  formatDateDisplay,
}: {
  changes: PersonnelChange[];
  onViewDetail: (change: PersonnelChange) => void;
  onEdit: (change: PersonnelChange) => void;
  onDelete: (change: PersonnelChange) => void;
  formatDateDisplay: (date: string) => string;
}) {
  if (changes.length === 0)
    return <div className="text-center py-12 text-muted-foreground">ไม่พบรายการ</div>;

  return (
    <div className="relative overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-[250px] font-semibold">ชื่อ-นามสกุล / ตำแหน่ง</TableHead>
            <TableHead className="font-semibold text-center">ประเภท</TableHead>
            <TableHead className="font-semibold">วันที่มีผล</TableHead>
            <TableHead className="font-semibold text-center">สถานะ</TableHead>
            <TableHead className="text-right w-[120px] font-semibold">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {changes.map((change) => {
            const typeInfo = changeTypeConfig[change.changeType];
            const statusInfo = statusConfig[change.status];
            const TypeIcon = typeInfo.icon;
            const StatusIcon = statusInfo.icon;
            return (
              <TableRow
                key={change.id}
                className="group hover:bg-muted/30 border-border transition-colors"
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{change.personName}</span>
                    <span
                      className="text-xs text-muted-foreground truncate max-w-[200px]"
                      title={`${change.personPosition} - ${change.personDepartment}`}
                    >
                      {change.personPosition}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border ${typeInfo.color}`}
                  >
                    <TypeIcon className="h-3 w-3" />
                    {typeInfo.label}
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium tabular-nums">
                  {formatDateDisplay(change.effectiveDate)}
                </TableCell>
                <TableCell className="text-center">
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border ${statusInfo.color}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusInfo.label}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => onViewDetail(change)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => onEdit(change)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(change)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ... (ChangeDetailContent, AddChangeForm, EditChangeForm remain similar but with updated styling)
function ChangeDetailContent({
  change,
  formatDateDisplay,
}: {
  change: PersonnelChange;
  formatDateDisplay: (date: string) => string;
}) {
  const typeInfo = changeTypeConfig[change.changeType];
  const statusInfo = statusConfig[change.status];
  const TypeIcon = typeInfo.icon;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
          <User className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">{change.personName}</h3>
          <p className="text-sm text-muted-foreground">{change.personPosition}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{change.personDepartment}</p>
        </div>
      </div>

      <div className="grid gap-4 p-4 border border-border rounded-lg bg-card">
        <div className="flex justify-between items-center pb-3 border-b border-border">
          <span className="text-sm text-muted-foreground">ประเภท</span>
          <Badge variant="outline" className={`gap-1.5 ${typeInfo.color}`}>
            <TypeIcon className="h-3 w-3" />
            {typeInfo.label}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">สถานะ</span>
          <Badge variant="outline" className={`gap-1.5 ${statusInfo.color}`}>
            {statusInfo.label}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">วันที่มีผล</span>
          <span className="font-medium">{formatDateDisplay(change.effectiveDate)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">วันที่บันทึก</span>
          <span className="font-medium">{formatDateDisplay(change.notifiedAt)}</span>
        </div>
      </div>

      {(change.reason || change.transferTo || change.note) && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4" /> รายละเอียดเพิ่มเติม
          </h4>
          <div className="p-3 bg-secondary/30 rounded-md text-sm space-y-2">
            {change.reason && (
              <div>
                <span className="text-muted-foreground block text-xs mb-1">เหตุผล:</span>
                <p>{change.reason}</p>
              </div>
            )}
            {change.transferTo && (
              <div>
                <span className="text-muted-foreground block text-xs mb-1">ย้ายไปที่:</span>
                <p className="font-medium text-blue-600">{change.transferTo}</p>
              </div>
            )}
            {change.note && (
              <div className="pt-2 border-t border-border/50 mt-2">
                <span className="text-muted-foreground block text-xs mb-1">หมายเหตุ:</span>
                <p className="text-muted-foreground">{change.note}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddChangeForm({
  onClose,
  onSave,
  personnel,
}: {
  onClose: () => void;
  onSave: (change: Partial<PersonnelChange>) => void;
  personnel: {
    id: string;
    name: string;
    position: string;
    department: string;
    profession: string;
  }[];
}) {
  const [selectedPerson, setSelectedPerson] = useState('');
  const [changeType, setChangeType] = useState<ChangeType>('retirement');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reason, setReason] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [note, setNote] = useState('');

  const person = personnel.find((p) => p.id === selectedPerson);

  const handleSubmit = () => {
    if (!selectedPerson || !effectiveDate) return;
    onSave({
      personId: selectedPerson,
      personName: person?.name || '',
      personPosition: person?.position || '',
      personDepartment: person?.department || '',
      profession: person?.profession || '',
      changeType,
      effectiveDate,
      reason: reason || undefined,
      transferTo: transferTo || undefined,
      note: note || undefined,
    });
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>
          เลือกบุคลากร <span className="text-destructive">*</span>
        </Label>
        <PersonPicker
          persons={personnel.map((p) => ({
            id: p.id,
            name: p.name,
            position: p.position,
            department: p.department,
            profession: p.profession,
          }))}
          value={selectedPerson}
          onChange={setSelectedPerson}
          placeholder="ค้นหาชื่อหรือตำแหน่ง..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            ประเภท <span className="text-destructive">*</span>
          </Label>
          <Select value={changeType} onValueChange={(value) => setChangeType(value as ChangeType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="retirement">เกษียณอายุราชการ</SelectItem>
              <SelectItem value="resign">ลาออก</SelectItem>
              <SelectItem value="transfer">ย้ายออก</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>
            วันที่มีผล <span className="text-destructive">*</span>
          </Label>
          <Input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>
      </div>

      {changeType === 'resign' && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <Label>เหตุผลการลาออก</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ระบุเหตุผล (ถ้ามี)"
          />
        </div>
      )}

      {changeType === 'transfer' && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <Label>ย้ายไปที่</Label>
          <Input
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            placeholder="ระบุหน่วยงาน/ตำแหน่งปลายทาง"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>หมายเหตุ</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ระบุหมายเหตุเพิ่มเติม..."
          className="resize-none"
          rows={3}
        />
      </div>

      <DialogFooter className="pt-4">
        <Button variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button onClick={handleSubmit} disabled={!selectedPerson || !effectiveDate}>
          บันทึกข้อมูล
        </Button>
      </DialogFooter>
    </div>
  );
}

function EditChangeForm({
  change,
  onClose,
  onSave,
}: {
  change: PersonnelChange;
  onClose: () => void;
  onSave: (change: PersonnelChange) => void;
}) {
  const [changeType, setChangeType] = useState<ChangeType>(change.changeType);
  const [effectiveDate, setEffectiveDate] = useState(() => toDateInputValue(change.effectiveDate));
  const [reason, setReason] = useState(change.reason || '');
  const [transferTo, setTransferTo] = useState(change.transferTo || '');
  const [note, setNote] = useState(change.note || '');

  const handleSubmit = () => {
    onSave({
      ...change,
      changeType,
      effectiveDate,
      reason: reason || undefined,
      transferTo: transferTo || undefined,
      note: note || undefined,
    });
  };

  return (
    <div className="space-y-4 py-2">
      <div className="p-3 rounded-lg bg-secondary/50 border border-border flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center text-muted-foreground border border-border">
          <User className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium text-sm">{change.personName}</p>
          <p className="text-xs text-muted-foreground">{change.personPosition}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>ประเภท</Label>
          <Select value={changeType} onValueChange={(value) => setChangeType(value as ChangeType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {change.sourceType === 'retirement' ? (
                <SelectItem value="retirement">เกษียณอายุราชการ</SelectItem>
              ) : (
                <>
                  <SelectItem value="resign">ลาออก</SelectItem>
                  <SelectItem value="transfer">ย้ายออก</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>วันที่มีผล</Label>
          <Input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>
      </div>

      {changeType === 'resign' && (
        <div className="space-y-2">
          <Label>เหตุผลการลาออก</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}

      {changeType === 'transfer' && (
        <div className="space-y-2">
          <Label>ย้ายไปที่</Label>
          <Input value={transferTo} onChange={(e) => setTransferTo(e.target.value)} />
        </div>
      )}

      <div className="space-y-2">
        <Label>หมายเหตุ</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>

      <DialogFooter className="pt-4">
        <Button variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button onClick={handleSubmit}>บันทึกการแก้ไข</Button>
      </DialogFooter>
    </div>
  );
}
