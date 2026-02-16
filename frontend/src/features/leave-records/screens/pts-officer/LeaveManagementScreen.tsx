'use client';

import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Edit,
  Eye,
  CalendarDays,
  GraduationCap,
  UserCheck,
  CheckCircle,
  FileText,
  List,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAddLeaveRecordDocuments,
  useCreateLeaveRecord,
  useDeleteLeaveRecordDocument,
  useLeaveRecordDocuments,
  useLeavePersonnel,
  useLeaveRecords,
  useLeaveRecordStats,
  useUpsertLeaveRecordExtension,
  useDeleteLeaveRecordExtension,
} from '@/features/leave-records/hooks';
import type { LeaveRecordApiRow } from '@/features/leave-records/api';
import { AttachmentPreviewDialog } from '@/components/common/attachment-preview-dialog';
import { buildSearchParam } from '@/features/leave-records/search';
import { leaveTypes } from '@/features/leave-records/components/leaveTypes';
import type { LeaveRecord, LeaveRecordDocument } from '@/features/leave-records/components/leaveRecords.types';
import { LeaveTable } from '@/features/leave-records/components/LeaveTable';
import { LeaveDetailContent } from '@/features/leave-records/components/LeaveDetailContent';
import {
  AddLeaveForm,
  EditLeaveForm,
  RecordReportForm,
} from '@/features/leave-records/components/LeaveForms';

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
            {value} <span className="text-xs font-normal text-muted-foreground">รายการ</span>
          </div>
        </div>
        <div className={`p-3 rounded-full ${bgClass} ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function calcDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 0;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const months = [
    'ม.ค.',
    'ก.พ.',
    'มี.ค.',
    'เม.ย.',
    'พ.ค.',
    'มิ.ย.',
    'ก.ค.',
    'ส.ค.',
    'ก.ย.',
    'ต.ค.',
    'พ.ย.',
    'ธ.ค.',
  ];
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const day = parseInt(parts[2]);
  const month = months[parseInt(parts[1]) - 1];
  const year = parseInt(parts[0]);
  if (Number.isNaN(year)) return dateStr;
  return `${day} ${month} ${year + 543}`;
}

export function LeaveManagementScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fiscalYearFilter, setFiscalYearFilter] = useState<number | 'all'>('all');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const [sortBy, setSortBy] = useState<'start_date' | 'name'>('start_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedLeave, setSelectedLeave] = useState<LeaveRecord | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');

  const fiscalYearOptions = useMemo(() => {
    const now = new Date();
    const currentFiscalYear =
      now.getMonth() >= 9 ? now.getFullYear() + 544 : now.getFullYear() + 543;
    const years = [];
    for (let y = currentFiscalYear - 5; y <= currentFiscalYear + 1; y += 1) {
      years.push(y);
    }
    return years;
  }, []);

  const offset = page * pageSize;
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearch = useMemo(
    () => buildSearchParam(deferredSearchQuery),
    [deferredSearchQuery],
  );

  const listParams = useMemo(
    () => ({
      leave_type: typeFilter === 'all' ? undefined : typeFilter,
      fiscal_year: fiscalYearFilter === 'all' ? undefined : fiscalYearFilter,
      search: normalizedSearch,
      limit: pageSize,
      offset,
      sort_by: sortBy,
      sort_dir: sortDir,
    }),
    [normalizedSearch, offset, pageSize, fiscalYearFilter, sortBy, sortDir, typeFilter],
  );

  const tabListParams = useMemo(
    () => ({
      leave_type: activeTab === 'study' ? 'education' : undefined,
      pending_report: activeTab === 'pending-report' ? true : undefined,
      fiscal_year: fiscalYearFilter === 'all' ? undefined : fiscalYearFilter,
      search: normalizedSearch,
      limit: 500,
      offset: 0,
      sort_by: sortBy,
      sort_dir: sortDir,
    }),
    [normalizedSearch, fiscalYearFilter, sortBy, sortDir, activeTab],
  );

  const {
    data: leaveRecordsData,
    refetch: refetchLeaveRecords,
    isLoading: leaveRecordsLoading,
    isError: leaveRecordsError,
  } = useLeaveRecords(listParams);

  const {
    data: leaveRecordsTabData,
    refetch: refetchLeaveRecordsTab,
    isLoading: leaveRecordsTabLoading,
    isError: leaveRecordsTabError,
  } = useLeaveRecords(tabListParams, { enabled: activeTab !== 'all' });

  const { data: leavePersonnelData } = useLeavePersonnel(
    { limit: 3000 },
    { enabled: showAddDialog },
  );

  const { data: statsData } = useLeaveRecordStats();

  const upsertExtension = useUpsertLeaveRecordExtension();
  const createLeaveRecord = useCreateLeaveRecord();
  const deleteExtension = useDeleteLeaveRecordExtension();
  const addDocuments = useAddLeaveRecordDocuments();
  const deleteDocument = useDeleteLeaveRecordDocument();

  const { data: documentsData, refetch: refetchDocuments } = useLeaveRecordDocuments(
    selectedLeave?.id ?? null,
  );

  const leaveRecordItems = useMemo(() => leaveRecordsData?.items ?? [], [leaveRecordsData]);

  const leaveRecordTabItems = useMemo(
    () => leaveRecordsTabData?.items ?? [],
    [leaveRecordsTabData],
  );

  const totalRecords = leaveRecordsData?.total ?? leaveRecordItems.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const showingFrom = totalRecords === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + pageSize, totalRecords);
  const canPrevPage = page > 0;
  const canNextPage = offset + pageSize < totalRecords;

  const personnel = useMemo(() => {
    if (!Array.isArray(leavePersonnelData)) return [];
    const map = new Map<string, { id: string; name: string; position: string; department: string }>();
    leavePersonnelData.forEach((row) => {
      const citizenId = String(row.citizen_id ?? '');
      if (!citizenId || map.has(citizenId)) return;
      const name =
        `${row.title ?? ''}${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || citizenId;
      map.set(citizenId, {
        id: citizenId,
        name,
        position: row.position_name ?? '-',
        department: row.department ?? '-',
      });
    });
    return Array.from(map.values());
  }, [leavePersonnelData]);

  const personMap = useMemo(() => {
    const map = new Map<string, { name: string; position: string; department: string }>();
    personnel.forEach((person) => map.set(person.id, person));
    return map;
  }, [personnel]);

  const mapLeaveRows = useCallback(
    (rows: LeaveRecordApiRow[]): LeaveRecord[] => {
      return rows.map((row) => {
        const citizenId = String(row.citizen_id ?? '');
        const person = personMap.get(citizenId);
        const rawType = String(row.leave_type ?? '').toLowerCase();
        const type = leaveTypes.some((t) => t.value === rawType) ? rawType : 'personal';
        const typeLabel = leaveTypes.find((t) => t.value === type)?.label ?? 'อื่นๆ';
        const userStart = row.start_date ?? '';
        const userEnd = row.end_date ?? '';
        const userDays = calcDays(userStart, userEnd);
        const documentDays = row.document_duration_days
          ? Number(row.document_duration_days)
          : calcDays(row.document_start_date ?? '', row.document_end_date ?? '');
        const reportStatus = row.return_report_status === 'DONE' ? 'reported' : 'pending';
        const fallbackName = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();

        return {
          id: Number(row.id),
          source: 'hrms' as const,
          personId: citizenId,
          personName: person?.name ?? (fallbackName || citizenId),
          personPosition: person?.position ?? row.position_name ?? '-',
          personDepartment: person?.department ?? row.department ?? '-',
          type,
          typeName: typeLabel,
          userStartDate: userStart,
          userEndDate: userEnd,
          documentStartDate: row.document_start_date ?? '',
          documentEndDate: row.document_end_date ?? '',
          days: userDays,
          requireReport: Boolean(row.require_return_report ?? false),
          reportDate: row.return_date ?? undefined,
          reportStatus: reportStatus,
          studyInfo: row.study_institution
            ? {
                institution: row.study_institution ?? '-',
                program: row.study_program ?? '-',
                field: row.study_major ?? '-',
                startDate: row.study_start_date ?? '',
              }
            : undefined,
          note: row.note ?? row.remark ?? undefined,
          createdAt: String(row.start_date ?? ''),
          documentDays,
        };
      });
    },
    [personMap],
  );

  const leaveRecords = useMemo<LeaveRecord[]>(() => {
    if (!Array.isArray(leaveRecordItems)) return [];
    return mapLeaveRows(leaveRecordItems as LeaveRecordApiRow[]);
  }, [leaveRecordItems, mapLeaveRows]);

  const leaveRecordsForTabs = useMemo<LeaveRecord[]>(() => {
    if (!Array.isArray(leaveRecordTabItems)) return [];
    return mapLeaveRows(leaveRecordTabItems as LeaveRecordApiRow[]);
  }, [leaveRecordTabItems, mapLeaveRows]);

  const pendingRecordsSource =
    activeTab === 'pending-report' || activeTab === 'study' ? leaveRecordsForTabs : leaveRecords;
  const pendingLoading =
    activeTab === 'pending-report' || activeTab === 'study'
      ? leaveRecordsTabLoading
      : leaveRecordsLoading;
  const pendingError =
    activeTab === 'pending-report' || activeTab === 'study' ? leaveRecordsTabError : leaveRecordsError;
  const pendingRetry =
    activeTab === 'pending-report' || activeTab === 'study' ? refetchLeaveRecordsTab : refetchLeaveRecords;

  const pendingReportCount =
    statsData?.pending_report ??
    leaveRecords.filter((r) => r.requireReport && r.reportStatus === 'pending').length;
  const studyLeaveCount = statsData?.study ?? leaveRecords.filter((r) => r.type === 'education').length;

  const getLeaveTypeColor = (type: string) => {
    const leaveType = leaveTypes.find((t) => t.value === type);
    return leaveType?.color || 'bg-secondary text-muted-foreground border-border';
  };

  const handleAddLeave = async (
    newLeave: Partial<LeaveRecord> & { leaveRecordId?: number; files?: File[] },
  ) => {
    if (!newLeave.userStartDate || !newLeave.userEndDate) return;
    try {
      const leaveRecordId =
        newLeave.leaveRecordId ??
        (
          await createLeaveRecord.mutateAsync({
            citizen_id: newLeave.personId ?? '',
            leave_type: newLeave.type ?? '',
            start_date: newLeave.userStartDate,
            end_date: newLeave.userEndDate,
            duration_days: newLeave.days,
            remark: newLeave.note,
          })
        ).id;

      await upsertExtension.mutateAsync({
        leave_record_id: leaveRecordId,
        document_start_date: newLeave.documentStartDate,
        document_end_date: newLeave.documentEndDate,
        require_return_report: newLeave.requireReport ?? false,
        pay_exception: false,
        note: newLeave.note,
        study_institution: newLeave.studyInfo?.institution,
        study_program: newLeave.studyInfo?.program,
        study_major: newLeave.studyInfo?.field,
        study_start_date: newLeave.studyInfo?.startDate || undefined,
      });

      if (newLeave.files && newLeave.files.length > 0) {
        await addDocuments.mutateAsync({ leaveRecordId, files: newLeave.files });
      }

      await refetchLeaveRecords();
      setShowAddDialog(false);
      setSuccessMessage('บันทึกข้อมูลวันลาสำเร็จ');
      setShowSuccessDialog(true);
    } catch {
      toast.error('ไม่สามารถบันทึกข้อมูลวันลาได้');
    }
  };

  const handleEditLeave = async (updatedLeave: LeaveRecord & { files?: File[] }) => {
    try {
      await upsertExtension.mutateAsync({
        leave_record_id: updatedLeave.id,
        document_start_date: updatedLeave.documentStartDate,
        document_end_date: updatedLeave.documentEndDate,
        require_return_report: updatedLeave.requireReport ?? false,
        pay_exception: false,
        note: updatedLeave.note,
        study_institution: updatedLeave.studyInfo?.institution,
        study_program: updatedLeave.studyInfo?.program,
        study_major: updatedLeave.studyInfo?.field,
        study_start_date: updatedLeave.studyInfo?.startDate || undefined,
      });

      if (updatedLeave.files && updatedLeave.files.length > 0) {
        await addDocuments.mutateAsync({ leaveRecordId: updatedLeave.id, files: updatedLeave.files });
      }

      await refetchLeaveRecords();
      setShowEditDialog(false);
      setSuccessMessage('แก้ไขรายการวันลาสำเร็จ');
      setShowSuccessDialog(true);
    } catch {
      toast.error('ไม่สามารถแก้ไขรายการวันลาได้');
    }
  };

  const handleDeleteLeave = async () => {
    if (!selectedLeave) return;
    try {
      await deleteExtension.mutateAsync(selectedLeave.id);
      await refetchLeaveRecords();
      setShowDeleteAlert(false);
      setSelectedLeave(null);
      setSuccessMessage('ลบรายการวันลาสำเร็จ');
      setShowSuccessDialog(true);
    } catch {
      toast.error('ไม่สามารถลบรายการวันลาได้');
    }
  };

  const handleRecordReport = async (reportDate: string, note: string) => {
    if (!selectedLeave) return;
    try {
      await upsertExtension.mutateAsync({
        leave_record_id: selectedLeave.id,
        require_return_report: true,
        return_report_status: 'DONE',
        return_date: reportDate,
        return_remark: note || undefined,
      });
      await refetchLeaveRecords();
      setShowReportDialog(false);
      setSelectedLeave(null);
      toast.success('บันทึกรายงานตัวสำเร็จ');
    } catch {
      toast.error('ไม่สามารถบันทึกรายงานตัวได้');
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">จัดการวันลา</h1>
          <p className="text-muted-foreground mt-1">ดูและจัดการวันลาของบุคลากรทั้งหมด</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" />
          เพิ่มรายการวันลา
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="รายการทั้งหมด"
          value={statsData?.total ?? totalRecords}
          icon={CalendarDays}
          colorClass="text-primary"
          bgClass="bg-primary/10"
        />
        <StatCard
          title="ลาศึกษาต่อ/อบรม"
          value={studyLeaveCount}
          icon={GraduationCap}
          colorClass="text-purple-600"
          bgClass="bg-purple-50"
        />
        <StatCard
          title="รอรายงานตัว"
          value={pendingReportCount}
          icon={UserCheck}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="all" className="gap-2">
              <List className="h-4 w-4" /> รายการทั้งหมด
            </TabsTrigger>
            <TabsTrigger value="pending-report" className="gap-2">
              <UserCheck className="h-4 w-4" /> รอรายงานตัว
              {pendingReportCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 px-1.5 py-0.5 h-5 text-[10px] bg-blue-500/10 text-blue-600"
                >
                  {pendingReportCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="study" className="gap-2">
              <GraduationCap className="h-4 w-4" /> ลาศึกษาต่อ/อบรม
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all">
          <Card className="border-border shadow-sm">
            <CardHeader className="py-4 px-6 border-b bg-muted/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  รายการวันลาทั้งหมด
                </CardTitle>

                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="ค้นหาชื่อ, แผนก..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(0);
                      }}
                      className="bg-background pl-9 h-9"
                    />
                  </div>
                  <Select
                    value={typeFilter}
                    onValueChange={(value) => {
                      setTypeFilter(value);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[140px] bg-background h-9">
                      <SelectValue placeholder="ประเภท" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกประเภท</SelectItem>
                      {leaveTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(fiscalYearFilter)}
                    onValueChange={(value) => {
                      setFiscalYearFilter(value === 'all' ? 'all' : Number(value));
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[120px] bg-background h-9">
                      <SelectValue placeholder="ปีงบ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกปีงบ</SelectItem>
                      {fiscalYearOptions.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={`${sortBy}:${sortDir}`}
                    onValueChange={(value) => {
                      const [nextSortBy, nextSortDir] = value.split(':') as [
                        'start_date' | 'name',
                        'asc' | 'desc',
                      ];
                      setSortBy(nextSortBy);
                      setSortDir(nextSortDir);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[160px] bg-background h-9">
                      <SelectValue placeholder="เรียงลำดับ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="start_date:desc">วันที่ลา (ใหม่สุด)</SelectItem>
                      <SelectItem value="start_date:asc">วันที่ลา (เก่าสุด)</SelectItem>
                      <SelectItem value="name:asc">ชื่อ (ก-ฮ)</SelectItem>
                      <SelectItem value="name:desc">ชื่อ (ฮ-ก)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <LeaveTable
                records={leaveRecords}
                onViewDetail={(record) => {
                  setSelectedLeave(record);
                  setShowDetailDialog(true);
                }}
                onEdit={(record) => {
                  setSelectedLeave(record);
                  setShowEditDialog(true);
                }}
                onDelete={(record) => {
                  setSelectedLeave(record);
                  setShowDeleteAlert(true);
                }}
                onRecordReport={(record) => {
                  setSelectedLeave(record);
                  setShowReportDialog(true);
                }}
                getLeaveTypeColor={getLeaveTypeColor}
                formatDateDisplay={formatDateDisplay}
                isLoading={leaveRecordsLoading}
                isError={leaveRecordsError}
                onRetry={() => refetchLeaveRecords()}
              />
              <div className="flex items-center justify-between border-t bg-muted/5 px-4 py-3 text-xs text-muted-foreground">
                <span>
                  แสดง {showingFrom}-{showingTo} จาก {totalRecords} รายการ
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canPrevPage}
                    onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                  >
                    ก่อนหน้า
                  </Button>
                  <span>
                    หน้า {Math.min(page + 1, totalPages)} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canNextPage}
                    onClick={() => setPage((prev) => prev + 1)}
                  >
                    ถัดไป
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending-report">
          <Card className="border-border shadow-sm">
            <CardHeader className="py-4 px-6 border-b bg-muted/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-muted-foreground" />
                รายการรอรายงานตัว
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <LeaveTable
                records={
                  activeTab === 'pending-report'
                    ? pendingRecordsSource
                    : pendingRecordsSource.filter((r) => r.requireReport && r.reportStatus === 'pending')
                }
                onViewDetail={(record) => {
                  setSelectedLeave(record);
                  setShowDetailDialog(true);
                }}
                onEdit={(record) => {
                  setSelectedLeave(record);
                  setShowEditDialog(true);
                }}
                onDelete={(record) => {
                  setSelectedLeave(record);
                  setShowDeleteAlert(true);
                }}
                onRecordReport={(record) => {
                  setSelectedLeave(record);
                  setShowReportDialog(true);
                }}
                getLeaveTypeColor={getLeaveTypeColor}
                formatDateDisplay={formatDateDisplay}
                showReportButton
                isLoading={pendingLoading}
                isError={pendingError}
                onRetry={pendingRetry}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="study">
          <Card className="border-border shadow-sm">
            <CardHeader className="py-4 px-6 border-b bg-muted/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-muted-foreground" />
                รายการลาศึกษาต่อ/อบรม
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {pendingRecordsSource
                  .filter((r) => r.type === 'education')
                  .map((record) => (
                    <div
                      key={record.id}
                      className="p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-purple-500/10">
                            <GraduationCap className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{record.personName}</p>
                            <p className="text-sm text-muted-foreground">{record.personPosition}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {record.requireReport && record.reportStatus === 'pending' && (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-600 border-amber-200"
                            >
                              รอรายงานตัว
                            </Badge>
                          )}
                          {record.requireReport && record.reportStatus === 'reported' && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 border-emerald-200"
                            >
                              รายงานตัวแล้ว
                            </Badge>
                          )}
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => {
                                setSelectedLeave(record);
                                setShowDetailDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setSelectedLeave(record);
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      {record.studyInfo && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-secondary/20 p-3 rounded-md">
                          <div>
                            <p className="text-muted-foreground text-xs">สถานศึกษา</p>
                            <p className="font-medium">{record.studyInfo.institution}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">หลักสูตร</p>
                            <p className="font-medium">{record.studyInfo.program}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">สาขาวิชา</p>
                            <p className="font-medium">{record.studyInfo.field}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">เริ่มศึกษา</p>
                            <p className="font-medium">{formatDateDisplay(record.studyInfo.startDate)}</p>
                          </div>
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">วันที่ลา (User)</p>
                          <p className="font-medium">
                            {formatDateDisplay(record.userStartDate)} - {formatDateDisplay(record.userEndDate)}
                          </p>
                        </div>
                        {record.documentStartDate && (
                          <div>
                            <p className="text-muted-foreground text-xs">วันที่ลา (Doc)</p>
                            <p className="font-medium text-amber-600">
                              {formatDateDisplay(record.documentStartDate)} -{' '}
                              {formatDateDisplay(record.documentEndDate || '')}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground text-xs">จำนวนวัน</p>
                          <p className="font-medium">{record.days} วัน</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>เพิ่มรายการวันลา</DialogTitle>
            <DialogDescription>เพิ่มรายการวันลาตามเอกสารทางราชการ</DialogDescription>
          </DialogHeader>
          <AddLeaveForm
            onClose={() => setShowAddDialog(false)}
            onSave={handleAddLeave}
            personnel={personnel}
            onPreview={(url, name) => {
              setPreviewUrl(url);
              setPreviewName(name);
              setPreviewOpen(true);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขรายการวันลา</DialogTitle>
            <DialogDescription>แก้ไขข้อมูลวันลาของ {selectedLeave?.personName}</DialogDescription>
          </DialogHeader>
          {selectedLeave && (
            <EditLeaveForm
              leave={selectedLeave}
              onClose={() => setShowEditDialog(false)}
              onSave={handleEditLeave}
              onPreview={(url, name) => {
                setPreviewUrl(url);
                setPreviewName(name);
                setPreviewOpen(true);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>รายละเอียดการลา</DialogTitle>
            <DialogDescription>ข้อมูลการลาของ {selectedLeave?.personName}</DialogDescription>
          </DialogHeader>
          {selectedLeave && (
            <LeaveDetailContent
              leave={selectedLeave}
              getLeaveTypeColor={getLeaveTypeColor}
              formatDateDisplay={formatDateDisplay}
              documents={Array.isArray(documentsData) ? (documentsData as LeaveRecordDocument[]) : []}
              onPreview={(url, name) => {
                setPreviewUrl(url);
                setPreviewName(name);
                setPreviewOpen(true);
              }}
              onDeleteDocument={async (documentId) => {
                if (!selectedLeave) return;
                await deleteDocument.mutateAsync({ documentId, leaveRecordId: selectedLeave.id });
                await refetchDocuments();
              }}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              ปิด
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowDetailDialog(false);
                setShowEditDialog(true);
              }}
            >
              <Edit className="mr-2 h-4 w-4" /> แก้ไข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>บันทึกการรายงานตัว</DialogTitle>
            <DialogDescription>{selectedLeave?.personName} กลับมารายงานตัวหลังจากลา</DialogDescription>
          </DialogHeader>
          <RecordReportForm onClose={() => setShowReportDialog(false)} onSave={handleRecordReport} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>
              คุณต้องการลบรายการวันลาของ {selectedLeave?.personName} หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLeave}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-4">
            <div className="p-3 rounded-full bg-emerald-500/10 mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <DialogTitle className="text-center mb-2">สำเร็จ</DialogTitle>
            <p className="text-muted-foreground text-center">{successMessage}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)} className="w-full">
              ตกลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AttachmentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        previewUrl={previewUrl}
        previewName={previewName}
      />
    </div>
  );
}
