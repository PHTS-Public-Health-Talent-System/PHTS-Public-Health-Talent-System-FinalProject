'use client';
export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Search,
  Info,
  CircleDollarSign,
  Users,
  Briefcase,
  Activity,
  Layers,
  AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  useCreateMasterRate,
  useDeleteMasterRate,
  useMasterRatesConfig,
  useRateHierarchy,
  useUpdateMasterRate,
} from '@/features/master-data/hooks';
import { normalizeMasterRates } from '@/features/master-data/utils';
import { useQueryClient } from '@tanstack/react-query';
import { resolveProfessionLabel } from '@/shared/constants/profession';
import {
  formatThaiDate as formatThaiDateValue,
  formatThaiNumber,
} from '@/shared/utils/thai-locale';

interface AllowanceRate {
  id: number;
  professionCode: string;
  groupNo: number;
  itemNo?: string | null;
  subItemNo?: string | null;
  code: string;
  name: string;
  amount: number;
  description: string;
  requirements: string;
  isActive: boolean;
  effectiveDate: string;
  eligibleCount: number;
}

interface ProfessionGroup {
  id: string;
  code: string;
  name: string;
  allowedRates: string[];
  description: string;
  isActive: boolean;
}

function formatCurrency(amount: number): string {
  return formatThaiNumber(amount);
}

function formatThaiDate(dateStr: string): string {
  return formatThaiDateValue(dateStr);
}

const RATE_PROFESSION_CODES = [
  'DOCTOR',
  'DENTIST',
  'PHARMACIST',
  'NURSE',
  'MED_TECH',
  'RAD_TECH',
  'PHYSIO',
  'SPEECH_THERAPIST',
  'SPECIAL_EDU',
  'OCC_THERAPY',
  'CLIN_PSY',
  'CARDIO_TECH',
  'ALLIED',
] as const;

// Helper Component for Stats
function StatCard({
  title,
  value,
  unit,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  title: string;
  value: string | number;
  unit: string;
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
            {value} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
          </div>
        </div>
        <div className={`p-3 rounded-full ${bgClass} ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function RatesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddRateDialogOpen, setIsAddRateDialogOpen] = useState(false);
  const [isEditRateDialogOpen, setIsEditRateDialogOpen] = useState(false);
  const [isDeleteRateDialogOpen, setIsDeleteRateDialogOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState<AllowanceRate | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [newRate, setNewRate] = useState({
    professionCode: '',
    groupNo: '',
    itemNo: '',
    subItemNo: '',
    amount: 0,
    conditionDesc: '',
    detailedDesc: '',
    isActive: true,
  });

  const { data: ratesData } = useMasterRatesConfig();
  const { data: hierarchyData } = useRateHierarchy();
  const createRate = useCreateMasterRate();
  const updateRate = useUpdateMasterRate();
  const deleteRate = useDeleteMasterRate();
  const queryClient = useQueryClient();

  const rates = useMemo<AllowanceRate[]>(() => {
    if (!Array.isArray(ratesData)) return [];
    return normalizeMasterRates(ratesData as Array<Record<string, unknown>>);
  }, [ratesData]);

  const professions = useMemo<ProfessionGroup[]>(() => {
    if (!Array.isArray(hierarchyData)) return [];
    return hierarchyData.map((prof) => {
      const baseLabel = resolveProfessionLabel(prof.id, prof.name);
      const displayName = prof.name?.startsWith('กลุ่ม')
        ? prof.name
        : /[ก-๙]/.test(String(prof.name ?? ''))
          ? String(prof.name)
          : `กลุ่ม${baseLabel}`;

      const amounts = new Set<string>();
      prof.groups.forEach((group) => {
        amounts.add(formatCurrency(group.rate));
      });
      return {
        id: prof.id,
        code: prof.id,
        name: displayName,
        allowedRates: Array.from(amounts),
        description: `รวม ${prof.groups.length} กลุ่ม`,
        isActive: true,
      };
    });
  }, [hierarchyData]);

  const filteredRates = rates.filter(
    (rate) =>
      rate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rate.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredProfessions = professions.filter(
    (prof) =>
      prof.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prof.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleAddRate = async () => {
    setDialogError(null);
    if (!newRate.professionCode || !newRate.groupNo || newRate.amount <= 0) {
      setDialogError('กรุณากรอกข้อมูลอัตราให้ครบถ้วน');
      toast.error('กรุณากรอกข้อมูลอัตราให้ครบถ้วน');
      return;
    }
    try {
      await createRate.mutateAsync({
        profession_code: newRate.professionCode,
        group_no: Number(newRate.groupNo),
        item_no: newRate.itemNo || null,
        sub_item_no: newRate.subItemNo || null,
        amount: newRate.amount,
        condition_desc: newRate.conditionDesc,
        detailed_desc: newRate.detailedDesc,
        is_active: newRate.isActive,
      });
      await queryClient.invalidateQueries({ queryKey: ['master-rates-config'] });
      await queryClient.invalidateQueries({ queryKey: ['rate-hierarchy'] });
      toast.success('เพิ่มอัตราเงินเรียบร้อย');
      setNewRate({
        professionCode: '',
        groupNo: '',
        itemNo: '',
        subItemNo: '',
        amount: 0,
        conditionDesc: '',
        detailedDesc: '',
        isActive: true,
      });
      setIsAddRateDialogOpen(false);
    } catch {
      setDialogError('ไม่สามารถเพิ่มอัตราเงินได้');
      toast.error('ไม่สามารถเพิ่มอัตราเงินได้');
    }
  };

  const handleEditRate = async () => {
    if (!selectedRate) return;
    setDialogError(null);
    if (!selectedRate.professionCode || !selectedRate.groupNo || selectedRate.amount <= 0) {
      setDialogError('กรุณากรอกข้อมูลอัตราให้ครบถ้วน');
      toast.error('กรุณากรอกข้อมูลอัตราให้ครบถ้วน');
      return;
    }
    try {
      await updateRate.mutateAsync({
        rateId: selectedRate.id,
        payload: {
          profession_code: selectedRate.professionCode,
          group_no: Number(selectedRate.groupNo),
          item_no: selectedRate.itemNo || null,
          sub_item_no: selectedRate.subItemNo || null,
          amount: selectedRate.amount,
          condition_desc: selectedRate.description,
          detailed_desc: selectedRate.requirements,
          is_active: selectedRate.isActive,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['master-rates-config'] });
      await queryClient.invalidateQueries({ queryKey: ['rate-hierarchy'] });
      toast.success('อัปเดตอัตราเงินเรียบร้อย');
      setIsEditRateDialogOpen(false);
      setSelectedRate(null);
    } catch {
      setDialogError('ไม่สามารถอัปเดตอัตราเงินได้');
      toast.error('ไม่สามารถอัปเดตอัตราเงินได้');
    }
  };

  const handleDeleteRate = async () => {
    if (!selectedRate) return;
    setDialogError(null);
    try {
      await deleteRate.mutateAsync(selectedRate.id);
      await queryClient.invalidateQueries({ queryKey: ['master-rates-config'] });
      await queryClient.invalidateQueries({ queryKey: ['rate-hierarchy'] });
      toast.success('ลบอัตราเงินเรียบร้อย');
    } catch {
      setDialogError('ไม่สามารถลบอัตราเงินได้');
      toast.error('ไม่สามารถลบอัตราเงินได้');
    } finally {
      setIsDeleteRateDialogOpen(false);
      setSelectedRate(null);
    }
  };

  const totalEligible = rates.reduce((sum, rate) => sum + rate.eligibleCount, 0);
  const totalMonthlyAmount = rates.reduce((sum, rate) => sum + rate.amount * rate.eligibleCount, 0);
  const isMutating = createRate.isPending || updateRate.isPending || deleteRate.isPending;

  return (
    <TooltipProvider>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            จัดการอัตราเงิน พ.ต.ส.
          </h1>
          <p className="text-muted-foreground">
            กำหนดอัตราเงินเพิ่มและกลุ่มวิชาชีพที่มีสิทธิ์ได้รับค่าตอบแทน
          </p>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="อัตราเงินทั้งหมด"
            value={rates.length}
            unit="รายการ"
            icon={FileText}
            colorClass="text-blue-600"
            bgClass="bg-blue-50"
          />
          <StatCard
            title="กลุ่มวิชาชีพ"
            value={professions.length}
            unit="กลุ่ม"
            icon={Briefcase}
            colorClass="text-purple-600"
            bgClass="bg-purple-50"
          />
          <StatCard
            title="ผู้มีสิทธิ์ทั้งหมด"
            value={totalEligible}
            unit="คน"
            icon={Users}
            colorClass="text-emerald-600"
            bgClass="bg-emerald-50"
          />
          <StatCard
            title="ยอดเบิกจ่าย/เดือน"
            value={formatCurrency(totalMonthlyAmount)}
            unit="บาท"
            icon={CircleDollarSign}
            colorClass="text-amber-600"
            bgClass="bg-amber-50"
          />
        </div>

        {/* Main Content */}
        <Tabs defaultValue="rates" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="rates" className="gap-2">
                <Activity className="h-4 w-4" /> อัตราเงิน พ.ต.ส.
              </TabsTrigger>
              <TabsTrigger value="professions" className="gap-2">
                <Layers className="h-4 w-4" /> กลุ่มวิชาชีพ
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Rates Tab */}
          <TabsContent value="rates" className="space-y-4">
            <Card className="border-border shadow-sm">
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่ออัตรา, รหัส..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-background"
                  />
                </div>
                <Button
                  onClick={() => {
                    setDialogError(null);
                    setIsAddRateDialogOpen(true);
                  }}
                  className="w-full md:w-auto shadow-sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  เพิ่มอัตราเงิน
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm overflow-hidden">
              <div className="relative overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="w-[100px] text-muted-foreground font-semibold">
                        รหัส
                      </TableHead>
                      <TableHead className="text-muted-foreground font-semibold min-w-[200px]">
                        ชื่ออัตรา
                      </TableHead>
                      <TableHead className="text-muted-foreground font-semibold text-right">
                        จำนวนเงิน
                      </TableHead>
                      <TableHead className="text-muted-foreground font-semibold text-center">
                        ผู้มีสิทธิ์
                      </TableHead>
                      <TableHead className="text-muted-foreground font-semibold">
                        วันที่มีผล
                      </TableHead>
                      <TableHead className="text-muted-foreground font-semibold text-center">
                        สถานะ
                      </TableHead>
                      <TableHead className="text-muted-foreground font-semibold text-right w-[100px]">
                        จัดการ
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          ไม่พบข้อมูลอัตราเงิน
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRates.map((rate) => (
                        <TableRow
                          key={rate.id}
                          className="group border-border hover:bg-muted/30 transition-colors"
                        >
                          <TableCell className="font-mono text-sm font-medium text-foreground">
                            {rate.code}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-foreground font-medium">{rate.name}</span>
                              {(rate.description || rate.requirements) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground/70 cursor-help hover:text-foreground transition-colors" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs p-3">
                                    <p className="font-semibold mb-1 text-sm">{rate.description}</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                      {rate.requirements}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary tabular-nums">
                            {formatCurrency(rate.amount)}
                          </TableCell>
                          <TableCell className="text-center text-foreground">
                            <Badge variant="secondary" className="font-normal">
                              {rate.eligibleCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatThaiDate(rate.effectiveDate)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                rate.isActive
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                  : 'bg-secondary text-muted-foreground border-border'
                              }
                            >
                              {rate.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => {
                                  setDialogError(null);
                                  setSelectedRate(rate);
                                  setIsEditRateDialogOpen(true);
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
                                  setSelectedRate(rate);
                                  setIsDeleteRateDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* Professions Tab */}
          <TabsContent value="professions" className="space-y-4">
            <Card className="border-border shadow-sm">
              <CardContent className="p-4">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหากลุ่มวิชาชีพ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-background"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProfessions.map((profession) => (
                <Card
                  key={profession.id}
                  className="bg-card border-border hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Briefcase className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base font-semibold text-foreground">
                          {profession.name}
                        </CardTitle>
                      </div>
                      <Badge variant="secondary" className="font-normal text-xs">
                        {profession.code}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5em]">
                      {profession.description || 'ไม่มีคำอธิบาย'}
                    </p>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                        อัตราเงินที่ได้รับ
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {profession.allowedRates.map((rateCode) => (
                          <Badge
                            key={rateCode}
                            variant="outline"
                            className="bg-background font-mono font-normal"
                          >
                            {rateCode}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Rate Dialog */}
        <Dialog open={isAddRateDialogOpen} onOpenChange={setIsAddRateDialogOpen}>
          <DialogContent className="bg-card border-border sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-foreground">เพิ่มอัตราเงิน</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                กรอกข้อมูลอัตราเงิน พ.ต.ส. ที่ต้องการเพิ่ม
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {dialogError && (
                <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{dialogError}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="professionCode">รหัสวิชาชีพ</Label>
                  <Select
                    value={newRate.professionCode}
                    onValueChange={(value) => setNewRate({ ...newRate, professionCode: value })}
                  >
                    <SelectTrigger id="professionCode">
                      <SelectValue placeholder="เลือกวิชาชีพ" />
                    </SelectTrigger>
                    <SelectContent>
                      {RATE_PROFESSION_CODES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code} - {resolveProfessionLabel(code, code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="groupNo">กลุ่ม (เลขกลุ่ม)</Label>
                  <Input
                    id="groupNo"
                    type="number"
                    value={newRate.groupNo}
                    onChange={(e) => setNewRate({ ...newRate, groupNo: e.target.value })}
                    placeholder="เช่น 2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="itemNo">ข้อ (เลขข้อ)</Label>
                  <Input
                    id="itemNo"
                    value={newRate.itemNo}
                    onChange={(e) => setNewRate({ ...newRate, itemNo: e.target.value })}
                    placeholder="เช่น 2.1"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="subItemNo">ข้อย่อย</Label>
                  <Input
                    id="subItemNo"
                    value={newRate.subItemNo}
                    onChange={(e) => setNewRate({ ...newRate, subItemNo: e.target.value })}
                    placeholder="เช่น 2.1.1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="amount">จำนวนเงิน (บาท)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={newRate.amount || ''}
                    onChange={(e) =>
                      setNewRate({ ...newRate, amount: parseInt(e.target.value) || 0 })
                    }
                    placeholder="2500"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="isActive">สถานะ</Label>
                  <Select
                    value={newRate.isActive ? '1' : '0'}
                    onValueChange={(value) => setNewRate({ ...newRate, isActive: value === '1' })}
                  >
                    <SelectTrigger id="isActive">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">ใช้งาน</SelectItem>
                      <SelectItem value="0">ปิดใช้งาน</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="conditionDesc">รายละเอียดเงื่อนไข</Label>
                <Textarea
                  id="conditionDesc"
                  value={newRate.conditionDesc}
                  onChange={(e) => setNewRate({ ...newRate, conditionDesc: e.target.value })}
                  placeholder="อธิบายเงื่อนไข/คุณสมบัติของอัตรานี้"
                  className="resize-none"
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="detailedDesc">รายละเอียดเพิ่มเติม</Label>
                <Textarea
                  id="detailedDesc"
                  value={newRate.detailedDesc}
                  onChange={(e) => setNewRate({ ...newRate, detailedDesc: e.target.value })}
                  placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                  className="resize-none"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddRateDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleAddRate} disabled={isMutating}>
                บันทึก
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Rate Dialog */}
        <Dialog open={isEditRateDialogOpen} onOpenChange={setIsEditRateDialogOpen}>
          <DialogContent className="bg-card border-border sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-foreground">แก้ไขอัตราเงิน</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                แก้ไขข้อมูลอัตราเงิน พ.ต.ส.
              </DialogDescription>
            </DialogHeader>
            {selectedRate && (
              <div className="grid gap-4 py-4">
                {dialogError && (
                  <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{dialogError}</AlertDescription>
                  </Alert>
                )}
                {/* Same form structure as Add Dialog, but with selectedRate values */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-profession">วิชาชีพ</Label>
                    <Select
                      value={selectedRate.professionCode}
                      onValueChange={(value) =>
                        setSelectedRate({ ...selectedRate, professionCode: value })
                      }
                    >
                      <SelectTrigger id="edit-profession">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RATE_PROFESSION_CODES.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code} - {resolveProfessionLabel(code, code)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-group">กลุ่ม</Label>
                    <Input
                      id="edit-group"
                      type="number"
                      value={selectedRate.groupNo}
                      onChange={(e) =>
                        setSelectedRate({
                          ...selectedRate,
                          groupNo: Number.parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-itemNo">ข้อ (เลขข้อ)</Label>
                    <Input
                      id="edit-itemNo"
                      value={selectedRate.itemNo ?? ''}
                      onChange={(e) => setSelectedRate({ ...selectedRate, itemNo: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-subItemNo">ข้อย่อย</Label>
                    <Input
                      id="edit-subItemNo"
                      value={selectedRate.subItemNo ?? ''}
                      onChange={(e) =>
                        setSelectedRate({ ...selectedRate, subItemNo: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-amount">จำนวนเงิน</Label>
                    <Input
                      id="edit-amount"
                      type="number"
                      value={selectedRate.amount}
                      onChange={(e) =>
                        setSelectedRate({ ...selectedRate, amount: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-isActive">สถานะ</Label>
                    <Select
                      value={selectedRate.isActive ? '1' : '0'}
                      onValueChange={(value) =>
                        setSelectedRate({ ...selectedRate, isActive: value === '1' })
                      }
                    >
                      <SelectTrigger id="edit-isActive">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">ใช้งาน</SelectItem>
                        <SelectItem value="0">ปิดใช้งาน</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-description">รายละเอียดเงื่อนไข</Label>
                  <Textarea
                    id="edit-description"
                    value={selectedRate.description}
                    onChange={(e) =>
                      setSelectedRate({ ...selectedRate, description: e.target.value })
                    }
                    className="resize-none"
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-detailed">รายละเอียดเพิ่มเติม</Label>
                  <Textarea
                    id="edit-detailed"
                    value={selectedRate.requirements}
                    onChange={(e) =>
                      setSelectedRate({ ...selectedRate, requirements: e.target.value })
                    }
                    className="resize-none"
                    rows={2}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditRateDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleEditRate} disabled={isMutating}>
                บันทึก
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteRateDialogOpen} onOpenChange={setIsDeleteRateDialogOpen}>
          <DialogContent className="bg-card border-border sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-foreground">ยืนยันการลบ</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                คุณต้องการลบอัตราเงิน &quot;{selectedRate?.name}&quot; หรือไม่?
                <br />
                การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              {dialogError && (
                <Alert variant="destructive" className="w-full border-destructive/40 bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{dialogError}</AlertDescription>
                </Alert>
              )}
              <Button variant="outline" onClick={() => setIsDeleteRateDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button variant="destructive" onClick={handleDeleteRate} disabled={isMutating}>
                ยืนยันลบ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
