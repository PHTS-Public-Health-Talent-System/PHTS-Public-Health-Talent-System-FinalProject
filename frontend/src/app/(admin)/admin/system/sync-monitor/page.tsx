'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PaginationControls,
  SyncGovernanceCards,
  useDataIssues,
  useSyncRecords,
  useSyncBatches,
  useSyncReconciliation,
  useSyncSchedule,
} from '@/features/system';
import type { SyncBatchRecord } from '@/features/system';
import {
  ArrowLeft,
  AlertCircle,
  BarChart3,
  Download,
  RefreshCw,
  Wrench,
  XCircle,
  Database,
  AlertTriangle,
  FileJson,
  Filter,
  Activity,
} from 'lucide-react';
import { formatThaiDateTime, formatThaiNumber } from '@/shared/utils/thai-locale';
import { cn } from '@/lib/utils';

// --- Constants (คงเดิม) ---
const EMPTY_LIST: never[] = [];
const LEAVE_RECLASS_ISSUE_CODE = 'LEAVE_TYPE_RECLASSIFIED';

const LEAVE_REASON_CODE_LABELS: Record<string, string> = {
  MATERNITY_PERSONAL_PATTERN: 'ลาคลอดถูกจัดเป็นลากิจ (บริบทข้อความ)',
  MATERNITY_SICK_PATTERN: 'ลาคลอดถูกจัดเป็นลาป่วย (บริบทข้อความ)',
  MATERNITY_WIFE_HELP_PATTERN: 'ลาคลอดถูกจัดเป็นลาช่วยภริยาเลี้ยงดูบุตร',
  WIFE_HELP_PATTERN: 'ตรวจพบบริบทช่วยภริยาคลอด/เลี้ยงดูบุตร',
  SICK_PATTERN: 'ตรวจพบบริบทลาป่วยจากข้อความ',
  SICK_FAMILY_CARE_PATTERN: 'เป็นบริบทดูแลญาติป่วย จัดเป็นลากิจ',
  GENERIC_RULE_RECLASSIFIED: 'จัดหมวดหมู่ใหม่ตามกติกามาตรฐาน',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
  vacation: 'ลาพักผ่อน',
  wife_help: 'ลาช่วยภริยาเลี้ยงดูบุตร',
  maternity: 'ลาคลอด',
  ordain: 'ลาบวช',
  education: 'ลาไปศึกษา/ประชุม',
};

const STAGE_STATUS_LABELS: Record<string, string> = {
  SUCCESS: 'สำเร็จ',
  FAILED: 'ล้มเหลว',
  RUNNING: 'กำลังทำงาน',
  SKIPPED: 'ข้าม',
  PENDING: 'รอดำเนินการ',
};

const SEVERITY_LABELS: Record<string, string> = {
  HIGH: 'วิกฤต',
  MEDIUM: 'เตือน',
  LOW: 'แจ้งทราบ',
};

const ActiveFilterChip = ({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear: () => void;
}) => (
  <button
    type="button"
    onClick={onClear}
    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
  >
    <span className="font-medium text-foreground">{label}:</span> {value}
    <XCircle className="h-3.5 w-3.5 ml-0.5" />
  </button>
);

// --- Helpers (คงเดิม) ---
const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatThaiDateTime(date);
};

const toStageBadgeClass = (status: string): string => {
  if (status === 'SUCCESS') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'FAILED') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'RUNNING') return 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse';
  if (status === 'SKIPPED') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

const toSeverityBadgeClass = (severity: string): string => {
  if (severity === 'HIGH') return 'bg-red-50 text-red-700 border-red-200 font-semibold';
  if (severity === 'MEDIUM') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (severity === 'LOW') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const toCsv = (headers: string[], rows: unknown[][]): string => {
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n');
};

const parseIssueDetail = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {}
  return null;
};

const toStageStatusLabel = (status: string): string => STAGE_STATUS_LABELS[status] ?? status;
const toSeverityLabel = (severity: string): string => SEVERITY_LABELS[severity] ?? severity;
const toLeaveTypeLabel = (raw: unknown): string => {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  return LEAVE_TYPE_LABELS[key] || key || '-';
};

const formatIssueDetailText = (issueCode: string, raw: string | null): string => {
  if (!raw) return '-';
  const parsed = parseIssueDetail(raw);
  if (!parsed) return raw;

  if (issueCode === LEAVE_RECLASS_ISSUE_CODE) {
    return [
      `บัตรประชาชน: ${parsed.citizen_id ?? '-'}`,
      `ปรับประเภท: ${toLeaveTypeLabel(parsed.original_type)} -> ${toLeaveTypeLabel(parsed.normalized_type)}`,
      `เหตุผล: ${LEAVE_REASON_CODE_LABELS[String(parsed.reason_code)] ?? parsed.reason_code}`,
      parsed.remark ? `หมายเหตุจากต้นทาง: ${String(parsed.remark).trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0) return '-';
  return entries
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${String(value ?? '-')}`)
    .join('\n');
};

function exportCsv(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// --- Main Component ---
export default function SyncGovernancePage() {
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsPageSize, setRecordsPageSize] = useState(10);
  const [recordsBatchIdInput, setRecordsBatchIdInput] = useState('latest');
  const [recordsTargetTableInput, setRecordsTargetTableInput] = useState('auto');
  const [recordsSearchInput, setRecordsSearchInput] = useState('');
  const [recordsBatchIdFilter, setRecordsBatchIdFilter] = useState<number | undefined>(undefined);
  const [recordsTargetTableFilter, setRecordsTargetTableFilter] = useState<string | undefined>(
    undefined,
  );
  const [recordsSearchFilter, setRecordsSearchFilter] = useState<string | undefined>(undefined);
  const [showAdvancedRecordFilters, setShowAdvancedRecordFilters] = useState(false);

  const [issuesPage, setIssuesPage] = useState(1);
  const [issuesPageSize, setIssuesPageSize] = useState(10);
  const [issueBatchIdInput, setIssueBatchIdInput] = useState('all');
  const [issueCodeInput, setIssueCodeInput] = useState('all');
  const [issueTargetTableInput, setIssueTargetTableInput] = useState('all');
  const [issueSeverityInput, setIssueSeverityInput] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'all'>(
    'all',
  );
  const [issueBatchIdFilter, setIssueBatchIdFilter] = useState<number | undefined>(undefined);
  const [issueCodeFilter, setIssueCodeFilter] = useState<string | undefined>(undefined);
  const [issueTargetTableFilter, setIssueTargetTableFilter] = useState<string | undefined>(
    undefined,
  );
  const [issueSeverityFilter, setIssueSeverityFilter] = useState<
    'LOW' | 'MEDIUM' | 'HIGH' | undefined
  >(undefined);
  const [showAdvancedIssueFilters, setShowAdvancedIssueFilters] = useState(false);

  const reconciliationQuery = useSyncReconciliation();
  const syncBatchesQuery = useSyncBatches(8);
  const syncScheduleQuery = useSyncSchedule();

  const dataIssuesQuery = useDataIssues({
    page: issuesPage,
    limit: issuesPageSize,
    batch_id: issueBatchIdFilter,
    target_table: issueTargetTableFilter,
    issue_code: issueCodeFilter,
    severity: issueSeverityFilter,
  });
  const dataIssuesSummaryQuery = useDataIssues({ page: 1, limit: 200 });
  const recordsQuery = useSyncRecords({
    page: recordsPage,
    limit: recordsPageSize,
    batch_id: recordsBatchIdFilter,
    target_table: recordsTargetTableFilter,
    search: recordsSearchFilter,
  });

  const syncBatches = syncBatchesQuery.data ?? EMPTY_LIST;
  const dataIssuesResponse = dataIssuesQuery.data;
  const dataIssues = dataIssuesResponse?.rows ?? EMPTY_LIST;
  const dataIssuesForSummary = dataIssuesSummaryQuery.data?.rows ?? EMPTY_LIST;
  const recordsResponse = recordsQuery.data;
  const syncedRecords = recordsResponse?.rows ?? EMPTY_LIST;
  const recordTables = recordsResponse?.table_options ?? ['users'];
  const recordTableCounts = recordsResponse?.table_counts ?? {};

  const latestBatchId = Number(syncBatches[0]?.batch_id ?? 0) || undefined;

  const leaveReclassificationSummary = useMemo(() => {
    const reasonCount = new Map<string, number>();
    let total = 0;
    for (const issue of dataIssuesForSummary) {
      if (issue.issue_code !== LEAVE_RECLASS_ISSUE_CODE) continue;
      total += 1;
      const parsed = parseIssueDetail(issue.issue_detail);
      const reason = String(parsed?.reason_code ?? 'UNKNOWN');
      reasonCount.set(reason, (reasonCount.get(reason) ?? 0) + 1);
    }
    const reasons = [...reasonCount.entries()]
      .map(([reasonCode, count]) => ({ reasonCode, count }))
      .sort((a, b) => b.count - a.count);
    return { total, reasons };
  }, [dataIssuesForSummary]);

  const dataIssueOptions = useMemo(() => {
    return {
      issueCodes: dataIssuesResponse?.issue_code_options ?? [],
      targetTables: dataIssuesResponse?.target_table_options ?? [],
    };
  }, [dataIssuesResponse]);

  const severitySummary = dataIssuesResponse?.severity_counts ?? { HIGH: 0, MEDIUM: 0, LOW: 0 };

  const issuesTotalPages = Math.max(
    1,
    Math.ceil(Number(dataIssuesResponse?.total ?? 0) / issuesPageSize),
  );
  const recordsTotalPages = Math.max(
    1,
    Math.ceil(Number(recordsResponse?.total ?? 0) / recordsPageSize),
  );

  const activeIssueFilters = [
    issueBatchIdFilter ? { label: 'รอบซิงก์', value: `#${issueBatchIdFilter}` } : null,
    issueCodeFilter ? { label: 'รหัสปัญหา', value: issueCodeFilter } : null,
    issueTargetTableFilter ? { label: 'ตาราง', value: issueTargetTableFilter } : null,
    issueSeverityFilter
      ? { label: 'ความรุนแรง', value: toSeverityLabel(issueSeverityFilter) }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const activeRecordFilters = [
    recordsBatchIdFilter ? { label: 'รอบซิงก์', value: `#${recordsBatchIdFilter}` } : null,
    recordsTargetTableFilter ? { label: 'ตาราง', value: recordsTargetTableFilter } : null,
    recordsSearchFilter ? { label: 'ค้นหา', value: recordsSearchFilter } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const handleApplyRecordsFilter = () => {
    const resolvedBatchId =
      recordsBatchIdInput === 'latest'
        ? undefined
        : Number(recordsBatchIdInput);
    setRecordsBatchIdFilter(
      typeof resolvedBatchId === 'number' && Number.isFinite(resolvedBatchId) && resolvedBatchId > 0
        ? resolvedBatchId
        : undefined,
    );
    setRecordsTargetTableFilter(
      recordsTargetTableInput === 'auto' ? undefined : recordsTargetTableInput,
    );
    setRecordsSearchFilter(
      recordsSearchInput.trim().length > 0 ? recordsSearchInput.trim() : undefined,
    );
    setRecordsPage(1);
    setShowAdvancedRecordFilters(false);
  };

  const handleClearRecordsFilter = () => {
    setRecordsBatchIdInput('latest');
    setRecordsTargetTableInput('auto');
    setRecordsSearchInput('');
    setRecordsBatchIdFilter(undefined);
    setRecordsTargetTableFilter(undefined);
    setRecordsSearchFilter(undefined);
    setRecordsPage(1);
  };

  const handleApplyIssueFilter = () => {
    setIssueBatchIdFilter(issueBatchIdInput === 'all' ? undefined : Number(issueBatchIdInput));
    setIssueCodeFilter(issueCodeInput === 'all' ? undefined : issueCodeInput);
    setIssueTargetTableFilter(issueTargetTableInput === 'all' ? undefined : issueTargetTableInput);
    setIssueSeverityFilter(issueSeverityInput === 'all' ? undefined : issueSeverityInput);
    setIssuesPage(1);
    setShowAdvancedIssueFilters(false);
  };

  const handleClearIssueFilter = () => {
    setIssueBatchIdInput('all');
    setIssueCodeInput('all');
    setIssueTargetTableInput('all');
    setIssueSeverityInput('all');
    setIssueBatchIdFilter(undefined);
    setIssueCodeFilter(undefined);
    setIssueTargetTableFilter(undefined);
    setIssueSeverityFilter(undefined);
    setIssuesPage(1);
  };

  const handleExportIssuesCsv = () => {
    const csv = toCsv(
      ['Issue ID', 'Batch ID', 'Table', 'Key', 'Code', 'Severity', 'Detail', 'Timestamp'],
      dataIssues.map((r) => [
        r.issue_id,
        r.batch_id,
        r.target_table,
        r.source_key,
        r.issue_code,
        r.severity,
        r.issue_detail,
        r.created_at,
      ]),
    );
    exportCsv(`sync-data-issues-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 bg-background min-h-screen max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <Wrench className="h-6 w-6 text-primary" /> ศูนย์ติดตามการซิงก์ข้อมูล
          </h1>
          <p className="text-muted-foreground mt-1">
            มุมมองรายวันสำหรับติดตามสถานะการซิงก์ และจัดการข้อมูลที่ผิดรูป (Data Issues)
          </p>
        </div>
        <Button variant="outline" asChild className="gap-2 bg-background shadow-sm">
          <Link href="/admin/system">
            <ArrowLeft className="h-4 w-4" /> กลับหน้าตั้งค่าระบบ
          </Link>
        </Button>
      </div>

      <SyncGovernanceCards
        reconciliation={reconciliationQuery.data}
        isFetching={reconciliationQuery.isFetching}
        onRefresh={() => reconciliationQuery.refetch()}
      />

      {/* Main Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* --- Left Column: Context Overviews --- */}
        <div className="lg:col-span-4 space-y-6">
          {/* Sync Schedule & Status Context */}
          <Card className="border-border shadow-sm bg-muted/10 border-dashed">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-full text-primary">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">สถานะการทำงาน</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ระบบดึงข้อมูลจาก HRMS ล่าสุด
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                    รอบล่าสุด
                  </p>
                  <p className="text-sm font-mono text-foreground">
                    {latestBatchId ? `Batch #${latestBatchId}` : 'ไม่มีข้อมูล'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                    ทำงานอัตโนมัติ
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {syncScheduleQuery.data
                      ? syncScheduleQuery.data.mode === 'INTERVAL'
                        ? `ทุก ${syncScheduleQuery.data.interval_minutes} นาที`
                        : `${String(syncScheduleQuery.data.hour).padStart(2, '0')}:${String(syncScheduleQuery.data.minute).padStart(2, '0')}`
                      : '-'}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs bg-background"
                asChild
              >
                <Link href="/admin/system">ปรับตั้งค่าเวลาซิงก์</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" /> ประวัติรอบการซิงก์
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => syncBatchesQuery.refetch()}
                  disabled={syncBatchesQuery.isFetching}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {syncBatchesQuery.isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : syncBatches.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-8">
                  ยังไม่มีประวัติการซิงก์
                </p>
              ) : (
                <div className="space-y-3">
                  {syncBatches.map((batch: SyncBatchRecord) => (
                    <div
                      key={batch.batch_id}
                      className="border rounded-lg p-3 bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">#{batch.batch_id}</span>
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 uppercase">
                            {batch.sync_type}
                          </Badge>
                        </div>
                        <Badge
                          className={`text-[10px] h-5 px-1.5 ${toStageBadgeClass(batch.overall_status)}`}
                        >
                          {toStageStatusLabel(batch.overall_status)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>{formatDateTime(batch.started_at)}</span>
                        {batch.warnings_count && batch.warnings_count > 0 ? (
                          <span className="flex items-center gap-1 text-amber-600 font-medium">
                            <AlertCircle className="h-3 w-3" /> {batch.warnings_count} เตือน
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-[11px] mb-2">
                        <div className="rounded border bg-background px-2 py-1 text-center">
                          <span className="text-muted-foreground block mb-0.5">ทั้งหมด</span>
                          <span className="font-semibold text-foreground">
                            {batch.total_records}
                          </span>
                        </div>
                        <div className="rounded border bg-background px-2 py-1 text-center">
                          <span className="text-muted-foreground block mb-0.5">เปลี่ยน</span>
                          <span className="font-semibold text-emerald-600">
                            {batch.changed_records}
                          </span>
                        </div>
                        <div className="rounded border bg-background px-2 py-1 text-center">
                          <span className="text-muted-foreground block mb-0.5">ผิดพลาด</span>
                          <span className="font-semibold text-red-600">{batch.error_records}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" /> สรุปจัดหมวดหมู่การลา
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between bg-muted/20 p-3 rounded-lg border mb-4">
                <span className="text-sm font-medium text-muted-foreground">แปลงทั้งหมด</span>
                <span className="text-2xl font-bold text-foreground">
                  {leaveReclassificationSummary.total}
                </span>
              </div>
              {leaveReclassificationSummary.reasons.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-4">ไม่พบข้อมูล</p>
              ) : (
                <div className="space-y-1">
                  {leaveReclassificationSummary.reasons.map((item) => (
                    <div
                      key={item.reasonCode}
                      className="flex items-center justify-between text-sm py-1.5 border-b last:border-0 border-border/50"
                    >
                      <span className="text-muted-foreground truncate pr-2 text-xs">
                        {LEAVE_REASON_CODE_LABELS[item.reasonCode] ?? item.reasonCode}
                      </span>
                      <span className="font-medium bg-secondary px-2 py-0.5 rounded text-xs">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* --- Right Column: Deep Dive Data Tabs --- */}
        <div className="lg:col-span-8">
          <Card className="border-border shadow-sm overflow-hidden min-h-[600px] flex flex-col">
            <Tabs defaultValue="issues" className="flex-1 flex flex-col">
              <div className="bg-muted/10 border-b px-4 py-2">
                <TabsList className="grid w-full sm:w-[450px] grid-cols-2 bg-transparent p-0">
                  <TabsTrigger
                    value="issues"
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" /> ปัญหาข้อมูล
                  </TabsTrigger>
                  <TabsTrigger
                    value="records"
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Database className="h-4 w-4 mr-2" /> ข้อมูลที่ Sync เข้ามา
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* TAB 1: DATA ISSUES */}
              <TabsContent
                value="issues"
                className="m-0 flex-1 flex flex-col focus-visible:outline-none"
              >
                <div className="p-4 border-b bg-muted/5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">Data Issues</h3>
                      <Badge variant="secondary" className="font-normal text-xs">
                        {formatThaiNumber(Number(dataIssuesResponse?.total ?? 0))} รายการ
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAdvancedIssueFilters(!showAdvancedIssueFilters)}
                        className={cn('h-8 text-xs', showAdvancedIssueFilters && 'bg-muted')}
                      >
                        <Filter className="h-3.5 w-3.5 mr-1.5" /> ตัวกรอง
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportIssuesCsv}
                        disabled={dataIssues.length === 0}
                        className="h-8 text-xs"
                      >
                        <Download className="h-3.5 w-3.5 sm:mr-1.5" />{' '}
                        <span className="hidden sm:inline">Export CSV</span>
                      </Button>
                    </div>
                  </div>

                  {/* Smart Filters (Collapsible) */}
                  {showAdvancedIssueFilters && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 animate-in slide-in-from-top-2">
                      <Select
                        value={issueSeverityInput}
                        onValueChange={(v: 'LOW' | 'MEDIUM' | 'HIGH' | 'all') =>
                          setIssueSeverityInput(v)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="ความรุนแรง" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">ทุกระดับ</SelectItem>
                          <SelectItem value="HIGH">สูง</SelectItem>
                          <SelectItem value="MEDIUM">กลาง</SelectItem>
                          <SelectItem value="LOW">ต่ำ</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={issueCodeInput} onValueChange={setIssueCodeInput}>
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="รหัสปัญหา" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">ทุกรหัส</SelectItem>
                          {dataIssueOptions.issueCodes.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={issueTargetTableInput}
                        onValueChange={setIssueTargetTableInput}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="ตาราง" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">ทุกตาราง</SelectItem>
                          {dataIssueOptions.targetTables.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-8 flex-1 text-xs"
                          onClick={handleApplyIssueFilter}
                        >
                          ค้นหา
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={handleClearIssueFilter}
                          title="ล้างค่า"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Active Filters Display */}
                  {activeIssueFilters.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {activeIssueFilters.map((filter) => (
                        <ActiveFilterChip
                          key={`${filter.label}-${filter.value}`}
                          label={filter.label}
                          value={filter.value}
                          onClear={() => {
                            if (filter.label === 'รอบซิงก์') {
                              setIssueBatchIdFilter(undefined);
                              setIssueBatchIdInput('all');
                            }
                            if (filter.label === 'รหัสปัญหา') {
                              setIssueCodeFilter(undefined);
                              setIssueCodeInput('all');
                            }
                            if (filter.label === 'ตาราง') {
                              setIssueTargetTableFilter(undefined);
                              setIssueTargetTableInput('all');
                            }
                            if (filter.label === 'ความรุนแรง') {
                              setIssueSeverityFilter(undefined);
                              setIssueSeverityInput('all');
                            }
                            setIssuesPage(1);
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Inline Severity Summary */}
                  <div className="flex bg-background border rounded-lg p-1 shadow-sm w-fit overflow-hidden">
                    <div className="px-3 py-1 flex gap-2 items-center border-r">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="text-xs text-muted-foreground font-medium">High</span>
                      <span className="font-bold text-red-600 text-sm ml-1">
                        {severitySummary.HIGH}
                      </span>
                    </div>
                    <div className="px-3 py-1 flex gap-2 items-center border-r">
                      <div className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-xs text-muted-foreground font-medium">Med</span>
                      <span className="font-bold text-amber-600 text-sm ml-1">
                        {severitySummary.MEDIUM}
                      </span>
                    </div>
                    <div className="px-3 py-1 flex gap-2 items-center">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-xs text-muted-foreground font-medium">Low</span>
                      <span className="font-bold text-blue-600 text-sm ml-1">
                        {severitySummary.LOW}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto">
                  {dataIssuesQuery.isLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : dataIssues.length === 0 ? (
                    <div className="text-center py-16 flex flex-col items-center">
                      <AlertCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        ไม่พบรายการปัญหาตามเงื่อนไขที่ค้นหา
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {dataIssues.map((issue) => (
                        <div
                          key={issue.issue_id}
                          className="border rounded-lg p-4 bg-card relative overflow-hidden shadow-sm hover:border-border/80 transition-colors"
                        >
                          <div
                            className={cn(
                              'absolute left-0 top-0 bottom-0 w-1',
                              issue.severity === 'HIGH'
                                ? 'bg-red-500'
                                : issue.severity === 'MEDIUM'
                                  ? 'bg-amber-500'
                                  : 'bg-blue-500',
                            )}
                          />
                          <div className="pl-2">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                                  {issue.issue_code}
                                  <Badge
                                    className={cn(
                                      'text-[10px] h-5 px-1.5 font-medium',
                                      toSeverityBadgeClass(issue.severity),
                                    )}
                                  >
                                    {toSeverityLabel(issue.severity)}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Table:{' '}
                                  <span className="font-mono text-foreground">
                                    {issue.target_table}
                                  </span>{' '}
                                  | Key:{' '}
                                  <span className="font-mono text-foreground">
                                    {issue.source_key}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="bg-muted/30 rounded p-3 text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words border border-border/50 leading-relaxed">
                              {formatIssueDetailText(issue.issue_code, issue.issue_detail)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagination Footer */}
                <div className="border-t bg-muted/10 p-4 flex items-center justify-between mt-auto">
                  <Select
                    value={String(issuesPageSize)}
                    onValueChange={(v) => {
                      setIssuesPageSize(Number(v));
                      setIssuesPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[100px] text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / หน้า</SelectItem>
                      <SelectItem value="20">20 / หน้า</SelectItem>
                      <SelectItem value="50">50 / หน้า</SelectItem>
                      <SelectItem value="100">100 / หน้า</SelectItem>
                      <SelectItem value="200">200 / หน้า</SelectItem>
                    </SelectContent>
                  </Select>
                  <PaginationControls
                    page={issuesPage}
                    totalPages={issuesTotalPages}
                    onPrev={() => setIssuesPage((p) => Math.max(1, p - 1))}
                    onNext={() => setIssuesPage((p) => Math.min(issuesTotalPages, p + 1))}
                  />
                </div>
              </TabsContent>

              {/* TAB 2: SYNCED RECORDS */}
              <TabsContent
                value="records"
                className="m-0 flex-1 flex flex-col focus-visible:outline-none"
              >
                <div className="p-4 border-b bg-muted/5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">ข้อมูลที่ซิงก์</h3>
                      <Badge variant="secondary" className="font-normal text-xs">
                        {formatThaiNumber(Number(recordsResponse?.total ?? 0))} รายการ
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAdvancedRecordFilters(!showAdvancedRecordFilters)}
                      className={cn(
                        'h-8 text-xs self-end sm:self-auto',
                        showAdvancedRecordFilters && 'bg-muted',
                      )}
                    >
                      <Filter className="h-3.5 w-3.5 mr-1.5" /> ตัวกรอง
                    </Button>
                  </div>

                  {/* Records Smart Filter */}
                  {showAdvancedRecordFilters && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 animate-in slide-in-from-top-2">
                      <Select value={recordsBatchIdInput} onValueChange={setRecordsBatchIdInput}>
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="รอบซิงก์" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="latest">ล่าสุด</SelectItem>
                          {syncBatches.map((b) => (
                            <SelectItem key={b.batch_id} value={String(b.batch_id)}>
                              #{b.batch_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={recordsTargetTableInput}
                        onValueChange={setRecordsTargetTableInput}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="ตาราง" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">อัตโนมัติ</SelectItem>
                          {recordTables.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t} ({Number(recordTableCounts[t] ?? 0)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="ค้นหา ID / Key..."
                        className="h-8 text-xs bg-background"
                        value={recordsSearchInput}
                        onChange={(e) => setRecordsSearchInput(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-8 flex-1 text-xs"
                          onClick={handleApplyRecordsFilter}
                        >
                          ค้นหา
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={handleClearRecordsFilter}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {activeRecordFilters.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {activeRecordFilters.map((filter) => (
                        <ActiveFilterChip
                          key={`${filter.label}-${filter.value}`}
                          label={filter.label}
                          value={filter.value}
                          onClear={() => {
                            if (filter.label === 'รอบซิงก์') {
                              setRecordsBatchIdFilter(undefined);
                              setRecordsBatchIdInput('latest');
                            }
                            if (filter.label === 'ตาราง') {
                              setRecordsTargetTableFilter(undefined);
                              setRecordsTargetTableInput('auto');
                            }
                            if (filter.label === 'ค้นหา') {
                              setRecordsSearchFilter(undefined);
                              setRecordsSearchInput('');
                            }
                            setRecordsPage(1);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 flex-1 overflow-y-auto">
                  {recordsQuery.isLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-32 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : syncedRecords.length === 0 ? (
                    <div className="text-center py-16 flex flex-col items-center">
                      <FileJson className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        ไม่พบข้อมูลที่ถูก sync ตามเงื่อนไขที่ค้นหา
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {syncedRecords.map((record, index) => {
                        const entries = Object.entries(record);
                        const titleValue = String(
                          record.citizen_id ??
                            record.id ??
                            record.ref_id ??
                            record.license_id ??
                            record.movement_id ??
                            record.signature_id ??
                            `row-${index}`,
                        );
                        return (
                          <div
                            key={`${titleValue}-${index}`}
                            className="border rounded-lg bg-card overflow-hidden shadow-sm"
                          >
                            <div className="bg-muted/30 px-4 py-2 border-b flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Database className="h-3.5 w-3.5 text-muted-foreground" />
                                <p className="text-sm font-semibold text-foreground">
                                  {titleValue}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono bg-background"
                              >
                                {recordsResponse?.target_table ?? recordsTargetTableFilter ?? '-'}
                              </Badge>
                            </div>
                            <div className="p-4">
                              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3 text-xs">
                                {entries.map(([key, value]) => (
                                  <div
                                    key={key}
                                    className="flex flex-col border-b border-muted/50 pb-1.5 last:border-0 sm:last:border-b-0"
                                  >
                                    <dt className="text-muted-foreground mb-0.5">{key}</dt>
                                    <dd className="font-mono text-foreground break-words">
                                      {String(value ?? '-')}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t bg-muted/10 p-4 flex items-center justify-between mt-auto">
                  <Select
                    value={String(recordsPageSize)}
                    onValueChange={(v) => {
                      setRecordsPageSize(Number(v));
                      setRecordsPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[80px] text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / หน้า</SelectItem>
                      <SelectItem value="20">20 / หน้า</SelectItem>
                      <SelectItem value="50">50 / หน้า</SelectItem>
                    </SelectContent>
                  </Select>
                  <PaginationControls
                    page={recordsPage}
                    totalPages={recordsTotalPages}
                    onPrev={() => setRecordsPage((p) => Math.max(1, p - 1))}
                    onNext={() => setRecordsPage((p) => Math.min(recordsTotalPages, p + 1))}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
