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
import {
  Search,
  Filter,
  FileSpreadsheet,
  ExternalLink,
  ArrowLeft,
  Download,
  X,
  AlertCircle,
  Loader2,
  FileWarning,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { exportEligibilityCsv } from '@/features/request/api';
import { useEligibilityPaged, useEligibilitySummary } from '@/features/request/hooks';
import { ELIGIBILITY_EXPIRING_DAYS } from '@/features/request/constants';
import { getRateGroupBadgeClass, mapEligibility, resolveProfessionLabel } from '../../utils';
import { Skeleton } from '@/components/ui/skeleton'; // อย่าลืม import Skeleton
import {
  formatThaiDate as formatThaiDateValue,
  formatThaiDateTime,
  formatThaiNumber,
} from '@/shared/utils/thai-locale';

type LicenseStatusFilter = 'all' | 'active' | 'expiring' | 'expired';

const coerceLicenseStatus = (value: string | null): LicenseStatusFilter => {
  if (value === 'active' || value === 'expiring' || value === 'expired' || value === 'all')
    return value;
  return 'all';
};

const formatThaiDate = (value?: string | null) => {
  return formatThaiDateValue(value);
};

const buildAlerts = (row: {
  expiry_date?: string | null;
  effective_date?: string | null;
  original_status?: string | null;
}) => {
  const alerts: { title: string; detail?: string; severity: 'error' | 'warning' }[] = [];
  const now = new Date();

  if (row.expiry_date) {
    const expiry = new Date(row.expiry_date);
    if (!Number.isNaN(expiry.getTime())) {
      const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        alerts.push({
          title: 'ใบอนุญาตหมดอายุ',
          detail: `หมดอายุเมื่อ ${formatThaiDate(row.expiry_date)}`,
          severity: 'error',
        });
      } else if (diffDays <= ELIGIBILITY_EXPIRING_DAYS) {
        alerts.push({
          title: 'ใบอนุญาตใกล้หมดอายุ',
          detail: `หมดอายุวันที่ ${formatThaiDate(row.expiry_date)} (เหลือ ${diffDays} วัน)`,
          severity: 'warning',
        });
      }
    }
  }

  const status = (row.original_status ?? '').trim();
  if (status) {
    if (/(ลา|ลาออก|เกษีย|ศึกษาต่อ|พ้นสภาพ|ไม่ปฏิบัติ|พักงาน)/.test(status)) {
      alerts.push({ title: 'สถานะบุคลากรต้องตรวจสอบ', detail: status, severity: 'warning' });
    }
  }

  return alerts;
};

// --- Component: Table Skeleton ---
const TableSkeleton = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell>
          <Skeleton className="h-4 w-8" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-12" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-24" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-24" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-20" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-32" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-6 w-8 rounded-full" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-8" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-20" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-6 w-16" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-8 w-8" />
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
  const [licenseStatusFilter, setLicenseStatusFilter] = useState<LicenseStatusFilter>(
    (searchParams.get('license_status') as LicenseStatusFilter) ?? 'all',
  );

  const page = Number(searchParams.get('page') ?? '1') || 1;
  const limit = Number(searchParams.get('limit') ?? '20') || 20;

  const { data: summary } = useEligibilitySummary(true);
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
      search: searchQuery.trim() ? searchQuery.trim() : undefined,
      rate_group: rateGroupFilter,
      department: departmentFilter.trim() ? departmentFilter.trim() : undefined,
      sub_department: subDepartmentFilter.trim() ? subDepartmentFilter.trim() : undefined,
      license_status: licenseStatusFilter,
    };
  }, [
    page,
    limit,
    normalizedCode,
    searchQuery,
    rateGroupFilter,
    departmentFilter,
    subDepartmentFilter,
    licenseStatusFilter,
  ]);

  const {
    data: eligibilityPaged,
    isLoading,
    isFetching,
  } = useEligibilityPaged(eligibilityQueryParams);

  const tableRows = useMemo(() => {
    const items = eligibilityPaged?.items ?? [];
    return items.map((row) => {
      const alerts = buildAlerts(row);
      return {
        raw: row,
        person: mapEligibility(row),
        alerts,
      };
    });
  }, [eligibilityPaged?.items]);

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

  const updateQuery = (next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v || v === '' || v === 'all') sp.delete(k);
      else sp.set(k, v);
    });
    router.push(
      `/pts-officer/allowance-list/profession/${normalizedCode === 'ALL' ? 'all' : normalizedCode}?${sp.toString()}`,
    );
  };

  // Handle Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setRateGroupFilter('all');
    setDepartmentFilter('');
    setSubDepartmentFilter('');
    setLicenseStatusFilter('all');
    router.push(
      `/pts-officer/allowance-list/profession/${normalizedCode === 'ALL' ? 'all' : normalizedCode}?page=1&limit=${limit}`,
    );
  };

  useEffect(() => {
    setSearchQuery(searchParams.get('q') ?? '');
    setRateGroupFilter(searchParams.get('rate_group') ?? 'all');
    setDepartmentFilter(searchParams.get('department') ?? '');
    setSubDepartmentFilter(searchParams.get('sub_department') ?? '');
    setLicenseStatusFilter(coerceLicenseStatus(searchParams.get('license_status')));
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => {
      updateQuery({ q: searchQuery.trim() || undefined, page: '1' });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleExport = async () => {
    try {
      const blob = await exportEligibilityCsv({
        active_only: '1',
        profession_code: normalizedCode,
        search: searchQuery.trim() ? searchQuery.trim() : undefined,
        rate_group: rateGroupFilter,
        department: departmentFilter.trim() ? departmentFilter.trim() : undefined,
        sub_department: subDepartmentFilter.trim() ? subDepartmentFilter.trim() : undefined,
        license_status: licenseStatusFilter,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eligibility_${normalizedCode}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('ไม่สามารถ export ได้');
    }
  };

  // เช็คว่ามีการ Filter อยู่หรือไม่ เพื่อแสดงปุ่ม Reset
  const hasActiveFilters =
    searchQuery ||
    rateGroupFilter !== 'all' ||
    departmentFilter ||
    subDepartmentFilter ||
    licenseStatusFilter !== 'all';

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
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
        <Button variant="outline" onClick={() => void handleExport()} className="shrink-0">
          <Download className="mr-2 h-4 w-4" />
          ส่งออก CSV
        </Button>
      </div>

      {/* Filters Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-12">
              <div className="md:col-span-3">
                <Select
                  value={normalizedCode === 'ALL' ? 'all' : normalizedCode}
                  onValueChange={(value) =>
                    router.push(
                      `/pts-officer/allowance-list/profession/${value}?page=1&limit=${limit}`,
                    )
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

              <div className="relative md:col-span-6">
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

              <div className="md:col-span-3 flex justify-end">
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    onClick={handleResetFilters}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="mr-2 h-4 w-4" /> ล้างตัวกรอง
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
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
                placeholder="กรองหน่วยงาน (หน่วยงานย่อย)"
                value={subDepartmentFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  setSubDepartmentFilter(v);
                  updateQuery({ sub_department: v.trim() || undefined, page: '1' });
                }}
              />
              <Select
                value={licenseStatusFilter}
                onValueChange={(value) => {
                  const next = coerceLicenseStatus(value);
                  setLicenseStatusFilter(next);
                  updateQuery({ license_status: next, page: '1' });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="สถานะใบอนุญาต" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">สถานะใบอนุญาต: ทั้งหมด</SelectItem>
                  <SelectItem value="active">ใช้งานได้</SelectItem>
                  <SelectItem value="expiring">ใกล้หมดอายุ ({ELIGIBILITY_EXPIRING_DAYS} วัน)</SelectItem>
                  <SelectItem value="expired">หมดอายุ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Section */}
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
              {' '}
              {/* ทำให้ Table Scroll ได้ถ้าข้อมูลยาว */}
              <Table>
                <TableHeader className="bg-secondary/30 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="font-semibold w-[50px] text-center">#</TableHead>
                    <TableHead className="font-semibold w-[80px]">คำนำหน้า</TableHead>
                    <TableHead className="font-semibold">ชื่อ-สกุล</TableHead>
                    <TableHead className="font-semibold">วิชาชีพ</TableHead>
                    <TableHead className="font-semibold">ตำแหน่ง</TableHead>
                    <TableHead className="font-semibold text-center">กลุ่ม</TableHead>
                    <TableHead className="font-semibold text-center">ข้อ</TableHead>
                    <TableHead className="font-semibold text-right">อัตรา (บาท)</TableHead>
                    <TableHead className="font-semibold text-center w-[80px]">เตือน</TableHead>
                    <TableHead className="font-semibold text-center w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableSkeleton />
                  ) : tableRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10}>
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                          <FileWarning className="h-10 w-10 mb-2 opacity-20" />
                          <p>ไม่พบรายการที่ค้นหา</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableRows.map((row, index) => (
                      <TableRow
                        key={row.person.id}
                        className="group hover:bg-secondary/20 transition-colors"
                      >
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {(page - 1) * limit + index + 1}
                        </TableCell>
                        <TableCell>{row.person.prefix}</TableCell>
                        <TableCell className="font-medium">
                          {/* Clickable Name for better UX */}
                          <Link
                            href={`/pts-officer/allowance-list/${row.person.id}?profession=${normalizedCode}${searchParams.toString() ? `&${searchParams.toString()}` : ''}`}
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
                        <TableCell className="text-right font-mono font-medium text-foreground/80">
                          {formatThaiNumber(row.person.baseRate)}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.alerts.length === 0 ? (
                            <Badge variant="outline" className="text-muted-foreground border-border/60">
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
                                  {row.alerts.some((a) => a.severity === 'error') ? (
                                    <Badge className="bg-rose-500 hover:bg-rose-600 border-none animate-pulse">
                                      !
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-amber-500 hover:bg-amber-600 border-none">
                                      {row.alerts.length}
                                    </Badge>
                                  )}
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-warning" />
                                    สิ่งที่ต้องตรวจสอบ
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            asChild
                          >
                            <Link
                              href={`/pts-officer/allowance-list/${row.person.id}?profession=${normalizedCode}${searchParams.toString() ? `&${searchParams.toString()}` : ''}`}
                            >
                              <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
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
              <Select
                value={String(limit)}
                onValueChange={(value) => updateQuery({ limit: value, page: '1' })}
              >
                <SelectTrigger className="h-9 w-[110px] bg-background border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 / หน้า</SelectItem>
                  <SelectItem value="50">50 / หน้า</SelectItem>
                  <SelectItem value="100">100 / หน้า</SelectItem>
                </SelectContent>
              </Select>
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
    </div>
  );
}
