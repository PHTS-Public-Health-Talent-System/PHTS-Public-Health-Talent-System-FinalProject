'use client';
export const dynamic = 'force-dynamic';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Filter,
  FileSpreadsheet,
  ArrowLeft,
  X,
  AlertCircle,
  Loader2,
  FileWarning,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  useDeactivateEligibility,
  useEligibilityPaged,
  useEligibilitySummary,
  useReactivateEligibility,
  useSetPrimaryEligibility,
} from '@/features/request';
import { getRateGroupBadgeClass, mapEligibility, resolveProfessionLabel } from '../../utils';
import { Skeleton } from '@/components/ui/skeleton';
import { formatThaiDate, formatThaiDateTime, formatThaiNumber } from '@/shared/utils/thai-locale';
import { buildAllowanceAlerts } from '../../alerts';
import { cn } from '@/lib/utils'; // ตรวจสอบให้แน่ใจว่ามีฟังก์ชัน cn สำหรับรวมคลาส
import { TableRowMoreActionsTrigger } from '@/components/common/table-row-actions';
import { toast } from 'sonner';

type AlertFilter = 'all' | 'any' | 'error' | 'no-license' | 'duplicate' | 'upcoming-change';
const PAGE_SIZE = 50;
type EligibilityActionType = 'set_primary' | 'deactivate' | 'reactivate';

type EligibilityLifecycleStatus = 'active' | 'expired' | 'inactive';

const getEligibilityLifecycleStatus = (
  row: { is_active?: boolean | number | null; expiry_date?: string | null },
  now = new Date(),
): EligibilityLifecycleStatus => {
  if (row.is_active === false || row.is_active === 0) return 'inactive';
  const expiry = row.expiry_date ? new Date(row.expiry_date) : null;
  if (expiry && !Number.isNaN(expiry.getTime()) && expiry.getTime() < now.getTime()) {
    return 'expired';
  }
  return 'active';
};

const lifecycleStatusMeta: Record<EligibilityLifecycleStatus, { label: string; className: string }> =
  {
    active: {
      label: 'ใช้งาน',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    expired: {
      label: 'หมดอายุ',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    inactive: {
      label: 'ไม่ใช้งาน',
      className: 'bg-slate-100 text-slate-700 border-slate-200',
    },
  };

const coerceAlertFilter = (value: string | null): AlertFilter => {
  if (
    value === 'all' ||
    value === 'any' ||
    value === 'error' ||
    value === 'no-license' ||
    value === 'duplicate' ||
    value === 'upcoming-change'
  ) {
    return value;
  }
  return 'all';
};

const TableSkeleton = ({ showSubItemColumn = false }: { showSubItemColumn?: boolean }) => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell className="text-center">
          <Skeleton className="h-4 w-8 mx-auto" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-12" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-32" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-20" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-24" />
        </TableCell>
        <TableCell className="text-center">
          <Skeleton className="h-6 w-8 rounded-full mx-auto" />
        </TableCell>
        <TableCell className="text-center">
          <Skeleton className="h-4 w-8 mx-auto" />
        </TableCell>
        {showSubItemColumn && (
          <TableCell className="text-center">
            <Skeleton className="h-4 w-8 mx-auto" />
          </TableCell>
        )}
        <TableCell className="text-right">
          <Skeleton className="h-4 w-16 ml-auto" />
        </TableCell>
        <TableCell className="text-center">
          <Skeleton className="h-6 w-16 rounded-full mx-auto" />
        </TableCell>
        <TableCell className="text-center">
          <Skeleton className="h-6 w-8 mx-auto" />
        </TableCell>
        <TableCell className="text-center">
          <Skeleton className="h-8 w-8 mx-auto" />
        </TableCell>
      </TableRow>
    ))}
  </>
);

export default function AllowanceListByProfessionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const normalizedCode = code === 'all' ? 'ALL' : code.toUpperCase();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [rateGroupFilter, setRateGroupFilter] = useState<string>(
    searchParams.get('rate_group') ?? 'all',
  );
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get('department') ?? '');
  const [subDepartmentFilter, setSubDepartmentFilter] = useState(
    searchParams.get('sub_department') ?? '',
  );
  const [alertFilter, setAlertFilter] = useState<AlertFilter>(
    coerceAlertFilter(searchParams.get('alert_filter')),
  );
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>(
    searchParams.get('tab') === 'inactive' ? 'inactive' : 'active',
  );

  const page = Number(searchParams.get('page') ?? '1') || 1;
  const limit = PAGE_SIZE;
  const urlSearchQuery = searchParams.get('q') ?? '';

  const { data: summary } = useEligibilitySummary({
    active_only: '1',
    profession_code: normalizedCode,
    search: urlSearchQuery.trim() ? urlSearchQuery.trim() : undefined,
    rate_group: rateGroupFilter,
    department: departmentFilter.trim() ? departmentFilter.trim() : undefined,
    sub_department: subDepartmentFilter.trim() ? subDepartmentFilter.trim() : undefined,
    alert_filter: alertFilter,
  });

  const professionSummaries = useMemo(() => {
    const rows = summary?.by_profession ?? [];
    return rows
      .map((row) => ({
        code: row.profession_code,
        label: resolveProfessionLabel(row.profession_code, row.profession_code),
        count: row.people_count,
        amount: row.total_rate_amount,
      }))
      .sort((a, b) => b.count - a.count);
  }, [summary?.by_profession]);

  const selectedProfessionLabel = useMemo(() => {
    if (normalizedCode === 'ALL') return 'ทุกวิชาชีพ';
    return (
      professionSummaries.find((item) => item.code === normalizedCode)?.label ?? normalizedCode
    );
  }, [normalizedCode, professionSummaries]);

  const eligibilityQueryParams = useMemo(() => {
    return {
      active_only: '1' as const,
      page,
      limit,
      profession_code: normalizedCode,
      search: urlSearchQuery.trim() ? urlSearchQuery.trim() : undefined,
      rate_group: rateGroupFilter,
      department: departmentFilter.trim() ? departmentFilter.trim() : undefined,
      sub_department: subDepartmentFilter.trim() ? subDepartmentFilter.trim() : undefined,
      alert_filter: alertFilter,
    };
  }, [
    page,
    limit,
    normalizedCode,
    urlSearchQuery,
    rateGroupFilter,
    departmentFilter,
    subDepartmentFilter,
    alertFilter,
  ]);

  const {
    data: eligibilityPaged,
    isLoading,
    isFetching,
  } = useEligibilityPaged(eligibilityQueryParams);

  const inactiveQueryParams = useMemo(
    () => ({
      ...eligibilityQueryParams,
      active_only: '2' as const,
      page: 1,
      limit: 100,
    }),
    [eligibilityQueryParams],
  );
  const { data: inactivePaged } = useEligibilityPaged(inactiveQueryParams);
  const setPrimaryEligibility = useSetPrimaryEligibility();
  const deactivateEligibility = useDeactivateEligibility();
  const reactivateEligibility = useReactivateEligibility();
  const [pendingAction, setPendingAction] = useState<{
    type: EligibilityActionType;
    eligibilityId: number;
    fullName: string;
  } | null>(null);

  const tableRows = useMemo(() => {
    const items = eligibilityPaged?.items ?? [];
    return items.map((row) => {
      const alerts = buildAllowanceAlerts(row);
      const lifecycleStatus = getEligibilityLifecycleStatus(row);
      const duplicateCount = Number(row.active_eligibility_count ?? 0);
      const hasDuplicateActive = Number.isFinite(duplicateCount) && duplicateCount > 1;
      return {
        raw: row,
        person: mapEligibility(row),
        alerts,
        lifecycleStatus,
        duplicateCount,
        hasDuplicateActive,
      };
    });
  }, [eligibilityPaged?.items]);

  const alertSummary = useMemo(() => {
    const professionSummary =
      summary?.by_profession.find((item) => item.profession_code === normalizedCode) ?? null;
    const overall = summary?.alert_summary;

    return {
      any: professionSummary?.people_with_alerts ?? overall?.people_with_alerts ?? 0,
      error: professionSummary?.critical_people ?? overall?.critical_people ?? 0,
      noLicense: professionSummary?.no_license_people ?? overall?.no_license_people ?? 0,
      duplicate: professionSummary?.duplicate_people ?? overall?.duplicate_people ?? 0,
      upcomingChange:
        professionSummary?.upcoming_change_people ?? overall?.upcoming_change_people ?? 0,
    };
  }, [normalizedCode, summary]);

  const inactiveRows = useMemo(() => {
    const items = inactivePaged?.items ?? [];
    return items
      .map((row) => ({
        raw: row,
        person: mapEligibility(row),
        deactivatedDate: row.expiry_date ?? null,
        requestNo: row.request_no ?? null,
      }))
      .sort((a, b) => String(b.deactivatedDate ?? '').localeCompare(String(a.deactivatedDate ?? '')));
  }, [inactivePaged?.items]);
  const inactiveTotalCount = inactivePaged?.meta.total ?? inactiveRows.length;

  const rateGroupOptions = useMemo(() => {
    return Array.from(new Set(tableRows.map((row) => row.person.rateGroup)))
      .filter((value) => value && value !== '-')
      .sort((a, b) => Number(a) - Number(b));
  }, [tableRows]);

  const totalCount = eligibilityPaged?.meta.total ?? 0;
  const totalAmount = eligibilityPaged?.meta.total_rate_amount ?? 0;
  const updatedAt = eligibilityPaged?.meta.updated_at
    ? formatThaiDateTime(eligibilityPaged.meta.updated_at)
    : null;
  const showSubItemColumn = Boolean(eligibilityPaged?.meta.has_sub_item_no);

  const updateQuery = (
    next: Record<string, string | undefined>,
    options?: { replace?: boolean },
  ) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v || v === 'all') sp.delete(k);
      else sp.set(k, v);
    });
    const basePath = `/pts-officer/allowance-list/profession/${normalizedCode === 'ALL' ? 'all' : normalizedCode}`;
    const nextQuery = sp.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;
    const href = nextQuery ? `${basePath}?${nextQuery}` : basePath;
    if (options?.replace) {
      router.replace(href, { scroll: false });
      return;
    }
    router.push(href);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setRateGroupFilter('all');
    setDepartmentFilter('');
    setSubDepartmentFilter('');
    setAlertFilter('all');
    router.push(
      `/pts-officer/allowance-list/profession/${normalizedCode === 'ALL' ? 'all' : normalizedCode}?page=1`,
    );
  };

  // Helper function สำหรับการคลิกที่ Badge
  const toggleAlertFilter = (value: AlertFilter) => {
    const nextValue = alertFilter === value ? 'all' : value;
    setAlertFilter(nextValue);
    updateQuery({ alert_filter: nextValue, page: '1' });
  };

  useEffect(() => {
    setSearchQuery(searchParams.get('q') ?? '');
    setRateGroupFilter(searchParams.get('rate_group') ?? 'all');
    setDepartmentFilter(searchParams.get('department') ?? '');
    setSubDepartmentFilter(searchParams.get('sub_department') ?? '');
    setAlertFilter(coerceAlertFilter(searchParams.get('alert_filter')));
    setActiveTab(searchParams.get('tab') === 'inactive' ? 'inactive' : 'active');
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => {
      updateQuery({ q: searchQuery.trim() || undefined, page: '1' }, { replace: true });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const hasActiveFilters =
    searchQuery ||
    rateGroupFilter !== 'all' ||
    departmentFilter ||
    subDepartmentFilter ||
    alertFilter !== 'all';

  const handleTabChange = (nextTab: string) => {
    const normalized = nextTab === 'inactive' ? 'inactive' : 'active';
    setActiveTab(normalized);
    const params = new URLSearchParams(searchParams.toString());
    if (normalized === 'active') params.delete('tab');
    else params.set('tab', 'inactive');
    router.replace(
      `/pts-officer/allowance-list/profession/${normalizedCode === 'ALL' ? 'all' : normalizedCode}${params.toString() ? `?${params.toString()}` : ''}`,
      { scroll: false },
    );
  };

  const isActionPending =
    setPrimaryEligibility.isPending || deactivateEligibility.isPending || reactivateEligibility.isPending;

  const actionDialogMeta = useMemo(() => {
    if (!pendingAction) return null;
    if (pendingAction.type === 'set_primary') {
      return {
        title: 'ยืนยันตั้งเป็นสิทธิ์ใช้งานหลัก',
        description: `ระบบจะตั้งสิทธิ์ของ ${pendingAction.fullName} เป็นสิทธิ์ใช้งานหลัก และปิดสิทธิ์ที่ซ้ำกันในวิชาชีพเดียวกัน`,
        confirmText: 'ตั้งเป็นสิทธิ์หลัก',
        variant: 'default' as const,
      };
    }
    if (pendingAction.type === 'deactivate') {
      return {
        title: 'ยืนยันปิดสิทธิ์',
        description: `คุณต้องการปิดสิทธิ์ของ ${pendingAction.fullName} ใช่หรือไม่`,
        confirmText: 'ปิดสิทธิ์',
        variant: 'destructive' as const,
      };
    }
    return {
      title: 'ยืนยันเปิดสิทธิ์กลับ',
      description: `ระบบจะเปิดสิทธิ์ของ ${pendingAction.fullName} และตั้งให้เป็นสิทธิ์หลัก`,
      confirmText: 'เปิดสิทธิ์กลับ',
      variant: 'default' as const,
    };
  }, [pendingAction]);

  const handleConfirmEligibilityAction = async () => {
    if (!pendingAction) return;
    try {
      if (pendingAction.type === 'set_primary') {
        await setPrimaryEligibility.mutateAsync({ eligibilityId: pendingAction.eligibilityId });
        toast.success('ตั้งเป็นสิทธิ์ใช้งานหลักเรียบร้อย');
      } else if (pendingAction.type === 'deactivate') {
        await deactivateEligibility.mutateAsync({ eligibilityId: pendingAction.eligibilityId });
        toast.success('ปิดสิทธิ์เรียบร้อย');
      } else {
        await reactivateEligibility.mutateAsync({ eligibilityId: pendingAction.eligibilityId });
        toast.success('เปิดสิทธิ์กลับเรียบร้อย');
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ');
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/pts-officer/allowance-list"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            กลับหน้าเลือกวิชาชีพ
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              รายชื่อผู้มีสิทธิ์: {selectedProfessionLabel}
            </h1>
            <Badge variant="secondary" className="text-xs font-normal">
              {formatThaiNumber(totalCount)} รายการ
            </Badge>
          </div>
          {updatedAt && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3" /> อัปเดตล่าสุด {updatedAt}
            </p>
          )}
        </div>
      </div>

      <Card className="border-border/80 bg-background/95 shadow-sm">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-12">
              <div className="md:col-span-4 lg:col-span-3">
                <Select
                  value={normalizedCode === 'ALL' ? 'all' : normalizedCode}
                  onValueChange={(value) =>
                    router.push(`/pts-officer/allowance-list/profession/${value}?page=1`)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกวิชาชีพ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกวิชาชีพ</SelectItem>
                    {professionSummaries.map((profession) => (
                      <SelectItem key={profession.code} value={profession.code}>
                        {profession.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative md:col-span-8 lg:col-span-9">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ-สกุล..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background"
                />
                {isFetching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-3 lg:grid-cols-4">
              <Select
                value={rateGroupFilter}
                onValueChange={(value) => {
                  setRateGroupFilter(value);
                  updateQuery({ rate_group: value, page: '1' });
                }}
              >
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="กลุ่มอัตรา" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกกลุ่ม</SelectItem>
                  {rateGroupOptions.map((group) => (
                    <SelectItem key={group} value={group}>
                      กลุ่มที่ {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="กรองกลุ่มงาน (แผนก)"
                value={departmentFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  setDepartmentFilter(v);
                  updateQuery({ department: v.trim() || undefined, page: '1' });
                }}
              />
              <Input
                placeholder="กรองหน่วยงานย่อย"
                value={subDepartmentFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  setSubDepartmentFilter(v);
                  updateQuery({ sub_department: v.trim() || undefined, page: '1' });
                }}
              />
              <Select
                value={alertFilter}
                onValueChange={(value) => {
                  const next = coerceAlertFilter(value);
                  setAlertFilter(next);
                  updateQuery({ alert_filter: next, page: '1' });
                }}
              >
                <SelectTrigger>
                  <AlertCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="ตัวกรองการเตือน" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">การเตือน: ทั้งหมด</SelectItem>
                  <SelectItem value="any">มีรายการเตือน</SelectItem>
                  <SelectItem value="error">เฉพาะต้องตรวจด่วน</SelectItem>
                  <SelectItem value="no-license">ไม่มีใบอนุญาต</SelectItem>
                  <SelectItem value="duplicate">พบสิทธิซ้ำ</SelectItem>
                  <SelectItem value="upcoming-change">สถานะใกล้เปลี่ยน</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              {/* เปลี่ยน Badges ให้เป็น Interactive (คลิกได้) เพื่อกรองข้อมูลทันที */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  onClick={() => toggleAlertFilter('any')}
                  className={cn(
                    'cursor-pointer transition-colors',
                    alertFilter === 'any'
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-secondary/50',
                  )}
                >
                  ติดเตือน {formatThaiNumber(alertSummary.any)} ราย
                </Badge>
                <Badge
                  variant="outline"
                  onClick={() => toggleAlertFilter('error')}
                  className={cn(
                    'cursor-pointer transition-colors',
                    alertFilter === 'error'
                      ? 'bg-rose-100 border-rose-300 text-rose-800'
                      : 'border-rose-200 text-rose-700 hover:bg-rose-50',
                  )}
                >
                  ต้องตรวจด่วน {formatThaiNumber(alertSummary.error)}
                </Badge>
                <Badge
                  variant="outline"
                  onClick={() => toggleAlertFilter('no-license')}
                  className={cn(
                    'cursor-pointer transition-colors',
                    alertFilter === 'no-license'
                      ? 'bg-slate-100 border-slate-300 text-slate-800'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                  )}
                >
                  ไม่มีใบอนุญาต {formatThaiNumber(alertSummary.noLicense)}
                </Badge>
                <Badge
                  variant="outline"
                  onClick={() => toggleAlertFilter('duplicate')}
                  className={cn(
                    'cursor-pointer transition-colors',
                    alertFilter === 'duplicate'
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'border-amber-200 text-amber-700 hover:bg-amber-50',
                  )}
                >
                  สิทธิซ้ำ {formatThaiNumber(alertSummary.duplicate)}
                </Badge>
                <Badge
                  variant="outline"
                  onClick={() => toggleAlertFilter('upcoming-change')}
                  className={cn(
                    'cursor-pointer transition-colors',
                    alertFilter === 'upcoming-change'
                      ? 'bg-blue-100 border-blue-300 text-blue-800'
                      : 'border-blue-200 text-blue-700 hover:bg-blue-50',
                  )}
                >
                  สถานะใกล้เปลี่ยน {formatThaiNumber(alertSummary.upcomingChange)}
                </Badge>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  onClick={handleResetFilters}
                  className="text-muted-foreground hover:text-foreground h-8 px-3"
                >
                  <X className="mr-2 h-4 w-4" /> ล้างตัวกรอง
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="active" className="gap-2 data-[state=active]:shadow-sm">
              กำลังใช้งาน
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {formatThaiNumber(totalCount)}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="inactive" className="gap-2 data-[state=active]:shadow-sm">
              ปิดใช้งานแล้ว
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {formatThaiNumber(inactiveTotalCount)}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

      {activeTab === 'active' ? (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            รายชื่อผู้มีสิทธิ์
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t border-border overflow-hidden">
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader className="bg-secondary/30 sticky top-0 z-10 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-secondary/30">
                    <TableRow>
                      <TableHead className="font-semibold w-[50px] text-center">#</TableHead>
                      <TableHead className="font-semibold w-[80px]">คำนำหน้า</TableHead>
                    <TableHead className="font-semibold">ชื่อ-สกุล</TableHead>
                    <TableHead className="font-semibold">วิชาชีพ</TableHead>
                    <TableHead className="font-semibold">ตำแหน่ง</TableHead>
                      <TableHead className="font-semibold text-center">กลุ่ม</TableHead>
                      <TableHead className="font-semibold text-center">ข้อ</TableHead>
                      {showSubItemColumn && (
                        <TableHead className="font-semibold text-center">ข้อย่อย</TableHead>
                      )}
                      <TableHead className="font-semibold text-right">อัตรา (บาท)</TableHead>
                      <TableHead className="font-semibold text-center w-[110px]">สถานะสิทธิ์</TableHead>
                      <TableHead className="font-semibold text-center w-[80px]">เตือน</TableHead>
                    <TableHead className="font-semibold text-center w-[110px]">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableSkeleton showSubItemColumn={showSubItemColumn} />
                  ) : tableRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={showSubItemColumn ? 12 : 11}>
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                          <FileWarning className="h-10 w-10 mb-2 opacity-20" />
                          <p>ไม่พบรายชื่อที่ตรงกับตัวกรองนี้</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableRows.map((row, index) => {
                      const detailHref = `/pts-officer/allowance-list/${row.person.id}?profession=${normalizedCode}${searchParams.toString() ? `&${searchParams.toString()}` : ''}`;
                      return (
                        <TableRow
                          key={row.person.id}
                          className="group hover:bg-secondary/20 transition-colors"
                        >
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {(page - 1) * limit + index + 1}
                          </TableCell>
                          <TableCell>{row.person.prefix}</TableCell>
                          <TableCell className="font-medium">
                            <Link
                              href={detailHref}
                              className="hover:underline hover:text-primary flex items-center gap-2"
                            >
                              {row.person.firstName} {row.person.lastName}
                            </Link>
                          </TableCell>
                        <TableCell>
                          <span className="text-xs bg-secondary px-2 py-1 rounded-full text-secondary-foreground whitespace-nowrap">
                            {row.person.professionLabel}
                          </span>
                        </TableCell>
                        <TableCell
                          className="text-sm text-muted-foreground max-w-[150px] truncate"
                          title={row.person.position}
                        >
                          {row.person.position}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold ${getRateGroupBadgeClass(row.person.rateGroup)}`}
                          >
                            {row.person.rateGroup}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm">{row.person.rateItem}</TableCell>
                        {showSubItemColumn && (
                          <TableCell className="text-center text-sm">
                            {row.raw.sub_item_no !== null &&
                            row.raw.sub_item_no !== undefined &&
                            String(row.raw.sub_item_no).trim()
                              ? String(row.raw.sub_item_no).trim()
                              : '-'}
                          </TableCell>
                        )}
                        <TableCell className="text-right font-mono font-medium text-foreground/80">
                          {formatThaiNumber(row.person.baseRate)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={lifecycleStatusMeta[row.lifecycleStatus].className}
                          >
                            {lifecycleStatusMeta[row.lifecycleStatus].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {row.alerts.length === 0 ? (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground border-border/60"
                            >
                              0
                            </Badge>
                          ) : (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 hover:bg-transparent"
                                >
                                  {/* ปรับสีให้ Soft ลงเพื่อ Design Consistency เมื่อเทียบกับด้านใน Dialog */}
                                  {row.alerts.some((a) => a.severity === 'error') ? (
                                    <Badge className="bg-rose-100 hover:bg-rose-200 text-rose-700 border-none">
                                      !
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-amber-100 hover:bg-amber-200 text-amber-700 border-none">
                                      {row.alerts.length}
                                    </Badge>
                                  )}
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-warning" />
                                    รายการเตือน
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="py-2 space-y-3">
                                  {row.alerts.map((a, idx) => (
                                    <div
                                      key={idx}
                                      className={`rounded border p-3 ${a.severity === 'error' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}
                                    >
                                      <p
                                        className={`text-sm font-semibold ${a.severity === 'error' ? 'text-rose-700' : 'text-amber-700'}`}
                                      >
                                        {a.title}
                                      </p>
                                      {a.detail && (
                                        <p
                                          className={`mt-1 text-xs ${a.severity === 'error' ? 'text-rose-600' : 'text-amber-600'}`}
                                        >
                                          {a.detail}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                          <TableCell className="text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <TableRowMoreActionsTrigger label="จัดการสิทธิ์" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel className="text-xs text-muted-foreground">
                                  จัดการสิทธิ์
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link href={detailHref}>ดูรายละเอียดสิทธิ์</Link>
                                </DropdownMenuItem>
                                {row.raw.request_id ? (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/pts-officer/requests/${row.raw.request_id}`}>
                                      ดูคำขอต้นทาง
                                    </Link>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem disabled>ดูคำขอต้นทาง</DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={isActionPending}
                                  onSelect={() =>
                                    setPendingAction({
                                      type: 'set_primary',
                                      eligibilityId: row.raw.eligibility_id,
                                      fullName: `${row.person.firstName} ${row.person.lastName}`.trim(),
                                    })
                                  }
                                >
                                  ตั้งเป็นสิทธิ์ใช้งานหลัก
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={row.lifecycleStatus !== 'active' || isActionPending}
                                  onSelect={() =>
                                    setPendingAction({
                                      type: 'deactivate',
                                      eligibilityId: row.raw.eligibility_id,
                                      fullName: `${row.person.firstName} ${row.person.lastName}`.trim(),
                                    })
                                  }
                                >
                                  ปิดสิทธิ์
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={row.lifecycleStatus === 'active' || isActionPending}
                                  onSelect={() =>
                                    setPendingAction({
                                      type: 'reactivate',
                                      eligibilityId: row.raw.eligibility_id,
                                      fullName: `${row.person.firstName} ${row.person.lastName}`.trim(),
                                    })
                                  }
                                >
                                  เปิดสิทธิ์กลับ
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <a href={detailHref} target="_blank" rel="noreferrer">
                                    เปิดในแท็บใหม่
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}${detailHref}`)}
                                >
                                  คัดลอกลิงก์
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-border bg-secondary/10">
            <div className="text-xs text-muted-foreground">
              หน้า {page} จาก {Math.max(1, Math.ceil(totalCount / limit))} (
              {formatThaiNumber(totalCount)} รายการ)
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateQuery({ page: String(Math.max(1, page - 1)) })}
              >
                ก่อนหน้า
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(totalCount / limit)}
                onClick={() => updateQuery({ page: String(page + 1) })}
              >
                ถัดไป
              </Button>
              <span className="text-xs text-muted-foreground">หน้า ละ {limit} รายการ</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">รวม:</span>
              <span className="text-primary font-bold text-lg">
                {formatThaiNumber(totalAmount)}
              </span>
              <span className="text-muted-foreground text-xs">บาท</span>
            </div>
          </div>
        </CardContent>
      </Card>
      ) : (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            รายชื่อผู้ถูกปิดใช้งานแล้ว
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t border-border overflow-hidden">
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader className="bg-secondary/30 sticky top-0 z-10 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-secondary/30">
                  <TableRow>
                    <TableHead className="font-semibold w-[60px] text-center">#</TableHead>
                    <TableHead className="font-semibold">ชื่อ-สกุล</TableHead>
                    <TableHead className="font-semibold">วิชาชีพ</TableHead>
                    <TableHead className="font-semibold text-center">กลุ่ม/ข้อ</TableHead>
                    <TableHead className="font-semibold text-right">อัตรา (บาท)</TableHead>
                    <TableHead className="font-semibold">วันที่เริ่มมีสิทธิ</TableHead>
                    <TableHead className="font-semibold">วันที่ปิดใช้งาน</TableHead>
                    <TableHead className="font-semibold">คำขอต้นทาง</TableHead>
                    <TableHead className="font-semibold text-center w-[110px]">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactiveRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                          <FileWarning className="h-10 w-10 mb-2 opacity-20" />
                          <p>ไม่พบผู้ถูกปิดใช้งานตามตัวกรองนี้</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    inactiveRows.map((row, index) => {
                      const detailHref = `/pts-officer/allowance-list/${row.person.id}?profession=${normalizedCode}${searchParams.toString() ? `&${searchParams.toString()}` : ''}`;
                      return (
                        <TableRow key={`inactive-${row.person.id}-${index}`}>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            <Link href={detailHref} className="hover:underline hover:text-primary">
                              {row.person.firstName} {row.person.lastName}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs bg-secondary px-2 py-1 rounded-full text-secondary-foreground whitespace-nowrap">
                              {row.person.professionLabel}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {row.person.rateGroup} / {row.person.rateItem}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatThaiNumber(row.person.baseRate)}
                          </TableCell>
                          <TableCell>{formatThaiDate(row.raw.effective_date ?? null)}</TableCell>
                          <TableCell>{formatThaiDate(row.deactivatedDate)}</TableCell>
                          <TableCell>
                            {row.raw.request_id ? (
                              <Link
                                href={`/pts-officer/requests/${row.raw.request_id}`}
                                className="text-primary hover:underline"
                              >
                                {row.requestNo ?? row.raw.request_id}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <TableRowMoreActionsTrigger label="จัดการสิทธิ์ที่ปิดใช้งานแล้ว" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  disabled={isActionPending}
                                  onSelect={() =>
                                    setPendingAction({
                                      type: 'reactivate',
                                      eligibilityId: row.raw.eligibility_id,
                                      fullName: `${row.person.firstName} ${row.person.lastName}`.trim(),
                                    })
                                  }
                                >
                                  เปิดสิทธิ์กลับ
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link href={detailHref}>ดูรายละเอียดสิทธิ์</Link>
                                </DropdownMenuItem>
                                {row.raw.request_id ? (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/pts-officer/requests/${row.raw.request_id}`}>
                                      ดูคำขอต้นทาง
                                    </Link>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem disabled>ดูคำขอต้นทาง</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
      )}
      </Tabs>

      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actionDialogMeta?.title ?? 'ยืนยันการดำเนินการ'}</AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialogMeta?.description ?? 'กรุณายืนยันการดำเนินการ'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionPending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              disabled={isActionPending}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmEligibilityAction();
              }}
              className={
                actionDialogMeta?.variant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
            >
              {actionDialogMeta?.confirmText ?? 'ยืนยัน'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
