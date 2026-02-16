'use client';
export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Flag,
  Sparkles,
  RefreshCcw,
  AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { YearPicker } from '@/components/month-year-picker';
import {
  useAddHoliday,
  useDeleteHoliday,
  useHolidays,
  useUpdateHoliday,
} from '@/features/master-data/hooks';
import type { HolidayApiRow, HolidayType } from '@/features/master-data/api';

interface Holiday {
  id: string;
  date: string;
  name: string;
  type: HolidayType;
  year: number;
  sourceDate: string;
}

const holidayTypeLabels: Record<Holiday['type'], string> = {
  national: 'วันหยุดราชการ',
  special: 'วันหยุดพิเศษ',
  substitution: 'วันหยุดชดเชย',
};

const holidayTypeStyles: Record<
  Holiday['type'],
  { bg: string; text: string; border: string; icon: LucideIcon }
> = {
  national: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', icon: Flag },
  special: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
    border: 'border-amber-500/20',
    icon: Sparkles,
  },
  substitution: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600',
    border: 'border-emerald-500/20',
    icon: RefreshCcw,
  },
};

const thaiMonths = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

function getCurrentThaiYear(now: Date = new Date()): number {
  return now.getFullYear() + 543;
}

function formatThaiDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const yearNum = parseInt(year);
  const thaiYear = yearNum > 2400 ? yearNum : yearNum + 543;
  return `${parseInt(day)} ${thaiMonths[parseInt(month) - 1]} ${thaiYear}`;
}

function normalizeDateOnly(value: string): string {
  if (!value) return '';
  if (value.includes('T')) return value.slice(0, 10);
  if (value.includes(' ')) return value.slice(0, 10);
  return value;
}

export default function HolidaysPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState(() => String(getCurrentThaiYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [newHoliday, setNewHoliday] = useState({
    date: '',
    name: '',
    type: 'national' as Holiday['type'],
  });

  const selectedYearNum = parseInt(selectedYear);
  const { data: holidaysData } = useHolidays();
  const addMutation = useAddHoliday();
  const updateMutation = useUpdateHoliday();
  const deleteMutation = useDeleteHoliday();

  const holidays = useMemo<Holiday[]>(() => {
    if (!Array.isArray(holidaysData)) return [];
    return (holidaysData as HolidayApiRow[]).map((row) => {
      const date = normalizeDateOnly(row.holiday_date ?? '');
      const yearNum = date ? parseInt(date.split('-')[0]) : selectedYearNum;
      const thaiYear = yearNum > 2400 ? yearNum : yearNum + 543;
      const name = row.holiday_name ?? '-';
      const type: Holiday['type'] = row.holiday_type
        ? row.holiday_type
        : name.includes('ชดเชย')
          ? 'substitution'
          : name.includes('พิเศษ')
            ? 'special'
            : 'national';
      return {
        id: date || `${name}-${thaiYear}`,
        date,
        name,
        type,
        year: thaiYear,
        sourceDate: date,
      };
    });
  }, [holidaysData, selectedYearNum]);

  const yearHolidays = useMemo(() => {
    return holidays.filter((holiday) => holiday.year.toString() === selectedYear);
  }, [holidays, selectedYear]);

  const filteredHolidays = holidays.filter((holiday) => {
    const matchesSearch = holiday.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = holiday.year.toString() === selectedYear;
    const matchesMonth =
      selectedMonth === 'all' || holiday.date.split('-')[1] === selectedMonth.padStart(2, '0');
    return matchesSearch && matchesYear && matchesMonth;
  });

  const sortedFilteredHolidays = useMemo(() => {
    return [...filteredHolidays].sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredHolidays]);

  const handleAddHoliday = async () => {
    setDialogError(null);
    if (!newHoliday.date || !newHoliday.name.trim()) {
      setDialogError('กรุณากรอกวันที่และชื่อวันหยุดให้ครบ');
      toast.error('กรุณากรอกวันที่และชื่อวันหยุดให้ครบ');
      return;
    }
    try {
      const [yyRaw] = newHoliday.date.split('-');
      const yy = Number.parseInt(yyRaw);
      await addMutation.mutateAsync({
        date: newHoliday.date,
        name: newHoliday.name.trim(),
        type: newHoliday.type,
      });
      if (Number.isFinite(yy) && yy > 0) {
        const thaiYear = yy > 2400 ? yy : yy + 543;
        setSelectedYear(String(thaiYear));
      }
      setSelectedMonth('all');
      setSearchQuery('');
      await queryClient.invalidateQueries({ queryKey: ['holidays'] });
      await queryClient.refetchQueries({ queryKey: ['holidays'] });
      toast.success('เพิ่มวันหยุดเรียบร้อย');
      setNewHoliday({ date: '', name: '', type: 'national' });
      setIsAddDialogOpen(false);
    } catch {
      setDialogError('ไม่สามารถเพิ่มวันหยุดได้');
      toast.error('ไม่สามารถเพิ่มวันหยุดได้');
    }
  };

  const handleEditHoliday = async () => {
    if (!selectedHoliday) return;
    setDialogError(null);
    if (!selectedHoliday.date || !selectedHoliday.name.trim()) {
      setDialogError('กรุณากรอกวันที่และชื่อวันหยุดให้ครบ');
      toast.error('กรุณากรอกวันที่และชื่อวันหยุดให้ครบ');
      return;
    }
    try {
      const [yyRaw] = selectedHoliday.date.split('-');
      const yy = Number.parseInt(yyRaw);
      await updateMutation.mutateAsync({
        originalDate: selectedHoliday.sourceDate,
        payload: {
          date: selectedHoliday.date,
          name: selectedHoliday.name.trim(),
          type: selectedHoliday.type,
        },
      });
      if (Number.isFinite(yy) && yy > 0) {
        const thaiYear = yy > 2400 ? yy : yy + 543;
        setSelectedYear(String(thaiYear));
      }
      setSelectedMonth('all');
      setSearchQuery('');
      await queryClient.invalidateQueries({ queryKey: ['holidays'] });
      await queryClient.refetchQueries({ queryKey: ['holidays'] });
      toast.success('แก้ไขวันหยุดเรียบร้อย');
      setIsEditDialogOpen(false);
      setSelectedHoliday(null);
    } catch {
      setDialogError('ไม่สามารถแก้ไขวันหยุดได้');
      toast.error('ไม่สามารถแก้ไขวันหยุดได้');
    }
  };

  const handleDeleteHoliday = async () => {
    if (!selectedHoliday) return;
    setDialogError(null);
    try {
      await deleteMutation.mutateAsync(selectedHoliday.sourceDate);
      await queryClient.invalidateQueries({ queryKey: ['holidays'] });
      await queryClient.refetchQueries({ queryKey: ['holidays'] });
      toast.success('ลบวันหยุดเรียบร้อย');
      setIsDeleteDialogOpen(false);
      setSelectedHoliday(null);
    } catch {
      setDialogError('ไม่สามารถลบวันหยุดได้');
      toast.error('ไม่สามารถลบวันหยุดได้');
    }
  };

  const stats = {
    total: yearHolidays.length,
    national: yearHolidays.filter((h) => h.type === 'national').length,
    special: yearHolidays.filter((h) => h.type === 'special').length,
    substitution: yearHolidays.filter((h) => h.type === 'substitution').length,
  };

  const isLoading = holidaysData === undefined;
  const isMutating = addMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">จัดการวันหยุด</h1>
          <p className="text-muted-foreground mt-1">
            กำหนดวันหยุดราชการและวันหยุดพิเศษประจำปี {selectedYear}
          </p>
        </div>
        <Button
          onClick={() => {
            setDialogError(null);
            setIsAddDialogOpen(true);
          }}
          className="shadow-sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          เพิ่มวันหยุด
        </Button>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="วันหยุดทั้งหมด"
          value={stats.total}
          icon={Calendar}
          colorClass="bg-secondary text-foreground"
        />
        <StatCard
          title="วันหยุดราชการ"
          value={stats.national}
          icon={Flag}
          colorClass="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="วันหยุดพิเศษ"
          value={stats.special}
          icon={Sparkles}
          colorClass="bg-amber-50 text-amber-600"
        />
        <StatCard
          title="วันหยุดชดเชย"
          value={stats.substitution}
          icon={RefreshCcw}
          colorClass="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* Toolbar & Filters */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
            {/* Left: Search */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อวันหยุด..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            {/* Center: Year Navigator */}
            <div className="flex items-center justify-center gap-1 bg-secondary/30 p-1 rounded-lg">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedYear((parseInt(selectedYear) - 1).toString())}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-2">
                <YearPicker
                  value={parseInt(selectedYear)}
                  onChange={(year) => setSelectedYear(year.toString())}
                  minYear={2550}
                  maxYear={2600}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedYear((parseInt(selectedYear) + 1).toString())}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Right: Month Filter */}
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full md:w-48 bg-background">
                <SelectValue placeholder="เดือน" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">แสดงทุกเดือน</SelectItem>
                {thaiMonths.map((month, index) => (
                  <SelectItem key={month} value={(index + 1).toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border shadow-sm overflow-hidden">
        <div className="relative overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="w-[180px] font-semibold text-foreground">วันที่</TableHead>
                <TableHead className="min-w-[200px] font-semibold text-foreground">
                  ชื่อวันหยุด
                </TableHead>
                <TableHead className="font-semibold text-foreground">ประเภท</TableHead>
                <TableHead className="text-right w-[100px] font-semibold text-foreground">
                  จัดการ
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    กำลังโหลดข้อมูล...
                  </TableCell>
                </TableRow>
              ) : sortedFilteredHolidays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    ไม่พบข้อมูลวันหยุดในเงื่อนไขที่เลือก
                  </TableCell>
                </TableRow>
              ) : (
                sortedFilteredHolidays.map((holiday) => {
                  const style = holidayTypeStyles[holiday.type];
                  return (
                    <TableRow
                      key={holiday.id}
                      className="group hover:bg-muted/30 transition-colors border-border"
                    >
                      <TableCell className="font-medium tabular-nums">
                        {formatThaiDate(holiday.date)}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{holiday.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`font-normal border ${style.bg} ${style.text} ${style.border}`}
                        >
                          {holidayTypeLabels[holiday.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => {
                              setDialogError(null);
                              setSelectedHoliday(holiday);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setDialogError(null);
                              setSelectedHoliday(holiday);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <div className="px-4 py-3 border-t bg-muted/5 text-xs text-muted-foreground flex justify-end">
          ทั้งหมด {sortedFilteredHolidays.length} รายการ
        </div>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>เพิ่มวันหยุดใหม่</DialogTitle>
            <DialogDescription>กรอกรายละเอียดวันหยุดเพื่อบันทึกลงในระบบ</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {dialogError && (
              <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{dialogError}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="date">วันที่</Label>
              <Input
                id="date"
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">ชื่อวันหยุด</Label>
              <Input
                id="name"
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                placeholder="เช่น วันขึ้นปีใหม่"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">ประเภท</Label>
              <Select
                value={newHoliday.type}
                onValueChange={(value: Holiday['type']) =>
                  setNewHoliday({ ...newHoliday, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="national">วันหยุดราชการ</SelectItem>
                  <SelectItem value="special">วันหยุดพิเศษ</SelectItem>
                  <SelectItem value="substitution">วันหยุดชดเชย</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleAddHoliday} disabled={isMutating}>
              บันทึกข้อมูล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>แก้ไขข้อมูลวันหยุด</DialogTitle>
            <DialogDescription>แก้ไขรายละเอียดของวันหยุดที่เลือก</DialogDescription>
          </DialogHeader>
          {selectedHoliday && (
            <div className="grid gap-4 py-4">
              {dialogError && (
                <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{dialogError}</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-2">
                <Label htmlFor="edit-date">วันที่</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={selectedHoliday.date}
                  onChange={(e) => setSelectedHoliday({ ...selectedHoliday, date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-name">ชื่อวันหยุด</Label>
                <Input
                  id="edit-name"
                  value={selectedHoliday.name}
                  onChange={(e) => setSelectedHoliday({ ...selectedHoliday, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-type">ประเภท</Label>
                <Select
                  value={selectedHoliday.type}
                  onValueChange={(value: Holiday['type']) =>
                    setSelectedHoliday({ ...selectedHoliday, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="national">วันหยุดราชการ</SelectItem>
                    <SelectItem value="special">วันหยุดพิเศษ</SelectItem>
                    <SelectItem value="substitution">วันหยุดชดเชย</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleEditHoliday} disabled={isMutating}>
              บันทึกการแก้ไข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              ยืนยันการลบ
            </DialogTitle>
            <DialogDescription>
              คุณต้องการลบวันหยุด{' '}
              <span className="font-semibold text-foreground">
                &quot;{selectedHoliday?.name}&quot;
              </span>{' '}
              ใช่หรือไม่?
              <br />
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            {dialogError && (
              <Alert variant="destructive" className="w-full border-destructive/40 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{dialogError}</AlertDescription>
              </Alert>
            )}
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleDeleteHoliday} disabled={isMutating}>
              ยืนยันลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  colorClass,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  colorClass: string;
}) {
  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="text-2xl font-bold mt-1">
            {value} <span className="text-xs font-normal text-muted-foreground">วัน</span>
          </div>
        </div>
        <div className={`p-3 rounded-full ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
