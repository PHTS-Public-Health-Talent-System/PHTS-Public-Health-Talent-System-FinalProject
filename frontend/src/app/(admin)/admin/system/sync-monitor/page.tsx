'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  SyncMonitorIssuesTab,
  SyncMonitorRecordsTab,
  SyncMonitorSidebar,
  SyncGovernanceCards,
} from '@/features/system';
import {
  useDataIssues,
  useInfiniteSyncBatches,
  useSyncReconciliation,
  useSyncRecords,
  useSyncSchedule,
} from '@/features/system/sync';
import type { SyncBatchRecord } from '@/features/system/shared';
import { ArrowLeft, Wrench, Database, AlertTriangle } from 'lucide-react';
import { formatThaiDateTime } from '@/shared/utils/thai-locale';
import {
  buildLeaveIssueSummary,
  formatIssueDetailText,
  leaveIssueLabelMaps,
  toIssueCodeLabel,
} from '@/features/system/sync-monitor';

// --- Constants (คงเดิม) ---
const EMPTY_LIST: never[] = [];
const { LEAVE_REASON_CODE_LABELS } = leaveIssueLabelMaps;

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

const toStageStatusLabel = (status: string): string => STAGE_STATUS_LABELS[status] ?? status;
const toSeverityLabel = (severity: string): string => SEVERITY_LABELS[severity] ?? severity;

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
  const syncBatchesQuery = useInfiniteSyncBatches(12);
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

  const syncBatches = useMemo(
    () => syncBatchesQuery.data?.pages.flatMap((page) => page.rows) ?? EMPTY_LIST,
    [syncBatchesQuery.data],
  );
  const dataIssuesResponse = dataIssuesQuery.data;
  const dataIssues = dataIssuesResponse?.rows ?? EMPTY_LIST;
  const dataIssuesForSummary = dataIssuesSummaryQuery.data?.rows ?? EMPTY_LIST;
  const recordsResponse = recordsQuery.data;
  const syncedRecords = recordsResponse?.rows ?? EMPTY_LIST;
  const recordTables = recordsResponse?.table_options ?? ['users'];
  const recordTableCounts = recordsResponse?.table_counts ?? {};

  const latestBatchId = Number(syncBatches[0]?.batch_id ?? 0) || undefined;

  const leaveIssueSummary = useMemo(
    () => buildLeaveIssueSummary(dataIssuesForSummary),
    [dataIssuesForSummary],
  );

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
    issueCodeFilter ? { label: 'รหัสปัญหา', value: toIssueCodeLabel(issueCodeFilter) } : null,
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

  const handleLoadMoreBatches = useCallback(() => {
    if (!syncBatchesQuery.hasNextPage || syncBatchesQuery.isFetchingNextPage) return;
    void syncBatchesQuery.fetchNextPage();
  }, [syncBatchesQuery]);

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
        <div className="lg:col-span-4">
          <SyncMonitorSidebar
            latestBatchId={latestBatchId}
            schedule={syncScheduleQuery.data}
            batches={syncBatches as SyncBatchRecord[]}
            batchesLoading={syncBatchesQuery.isLoading}
            batchesFetching={syncBatchesQuery.isFetching}
            batchesFetchingNextPage={syncBatchesQuery.isFetchingNextPage}
            hasMoreBatches={Boolean(syncBatchesQuery.hasNextPage)}
            onLoadMoreBatches={handleLoadMoreBatches}
            onRefreshBatches={() => syncBatchesQuery.refetch()}
            leaveIssueSummary={leaveIssueSummary}
            formatDateTime={formatDateTime}
            toStageBadgeClass={toStageBadgeClass}
            toStageStatusLabel={toStageStatusLabel}
            leaveReasonCodeLabels={LEAVE_REASON_CODE_LABELS}
          />
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

              <SyncMonitorIssuesTab
                isLoading={dataIssuesQuery.isLoading}
                total={Number(dataIssuesResponse?.total ?? 0)}
                rows={dataIssues}
                showAdvancedFilters={showAdvancedIssueFilters}
                onToggleAdvancedFilters={() => setShowAdvancedIssueFilters((value) => !value)}
                onExportCsv={handleExportIssuesCsv}
                activeFilters={activeIssueFilters}
                onClearActiveFilter={(filter) => {
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
                severitySummary={severitySummary}
                issueSeverityInput={issueSeverityInput}
                issueCodeInput={issueCodeInput}
                issueTargetTableInput={issueTargetTableInput}
                issueSeverityOptions={['LOW', 'MEDIUM', 'HIGH']}
                issueCodeOptions={dataIssueOptions.issueCodes}
                issueTargetTableOptions={dataIssueOptions.targetTables}
                setIssueSeverityInput={setIssueSeverityInput}
                setIssueCodeInput={setIssueCodeInput}
                setIssueTargetTableInput={setIssueTargetTableInput}
                onApplyFilters={handleApplyIssueFilter}
                onClearFilters={handleClearIssueFilter}
                pageSize={issuesPageSize}
                onPageSizeChange={(value) => {
                  setIssuesPageSize(value);
                  setIssuesPage(1);
                }}
                page={issuesPage}
                totalPages={issuesTotalPages}
                onPrev={() => setIssuesPage((p) => Math.max(1, p - 1))}
                onNext={() => setIssuesPage((p) => Math.min(issuesTotalPages, p + 1))}
                toIssueCodeLabel={toIssueCodeLabel}
                toSeverityLabel={toSeverityLabel}
                toSeverityBadgeClass={toSeverityBadgeClass}
                formatIssueDetailText={formatIssueDetailText}
              />

              <SyncMonitorRecordsTab
                isLoading={recordsQuery.isLoading}
                total={Number(recordsResponse?.total ?? 0)}
                rows={syncedRecords}
                targetTable={recordsResponse?.target_table}
                targetTableFilter={recordsTargetTableFilter}
                showAdvancedFilters={showAdvancedRecordFilters}
                onToggleAdvancedFilters={() => setShowAdvancedRecordFilters((value) => !value)}
                activeFilters={activeRecordFilters}
                onClearActiveFilter={(filter) => {
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
                batchIdInput={recordsBatchIdInput}
                targetTableInput={recordsTargetTableInput}
                searchInput={recordsSearchInput}
                tableOptions={recordTables}
                tableCounts={recordTableCounts}
                batchOptions={syncBatches as Array<{ batch_id: number }>}
                setBatchIdInput={setRecordsBatchIdInput}
                setTargetTableInput={setRecordsTargetTableInput}
                setSearchInput={setRecordsSearchInput}
                onApplyFilters={handleApplyRecordsFilter}
                onClearFilters={handleClearRecordsFilter}
                pageSize={recordsPageSize}
                onPageSizeChange={(value) => {
                  setRecordsPageSize(value);
                  setRecordsPage(1);
                }}
                page={recordsPage}
                totalPages={recordsTotalPages}
                onPrev={() => setRecordsPage((p) => Math.max(1, p - 1))}
                onNext={() => setRecordsPage((p) => Math.min(recordsTotalPages, p + 1))}
              />
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
