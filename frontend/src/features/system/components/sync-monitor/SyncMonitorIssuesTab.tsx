import { AlertCircle, Download, Filter, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TabsContent } from '@/components/ui/tabs';
import { PaginationControls } from '@/features/system';
import type { DataIssueRecord } from '@/features/system/shared';
import { cn } from '@/lib/utils';
import { formatThaiNumber } from '@/shared/utils/thai-locale';

type ActiveFilter = {
  label: string;
  value: string;
};

type SyncMonitorIssuesTabProps = {
  isLoading: boolean;
  total: number;
  rows: DataIssueRecord[];
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  onExportCsv: () => void;
  activeFilters: ActiveFilter[];
  onClearActiveFilter: (filter: ActiveFilter) => void;
  severitySummary: { HIGH: number; MEDIUM: number; LOW: number };
  issueSeverityInput: 'LOW' | 'MEDIUM' | 'HIGH' | 'all';
  issueCodeInput: string;
  issueTargetTableInput: string;
  issueSeverityOptions: Array<'LOW' | 'MEDIUM' | 'HIGH'>;
  issueCodeOptions: string[];
  issueTargetTableOptions: string[];
  setIssueSeverityInput: (value: 'LOW' | 'MEDIUM' | 'HIGH' | 'all') => void;
  setIssueCodeInput: (value: string) => void;
  setIssueTargetTableInput: (value: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  toIssueCodeLabel: (value: string) => string;
  toSeverityLabel: (value: string) => string;
  toSeverityBadgeClass: (value: string) => string;
  formatIssueDetailText: (issueCode: string, issueDetail: string | null) => string;
};

function ActiveFilterChip({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <span className="font-medium text-foreground">{label}:</span> {value}
      <XCircle className="ml-0.5 h-3.5 w-3.5" />
    </button>
  );
}

export function SyncMonitorIssuesTab({
  isLoading,
  total,
  rows,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  onExportCsv,
  activeFilters,
  onClearActiveFilter,
  severitySummary,
  issueSeverityInput,
  issueCodeInput,
  issueTargetTableInput,
  issueCodeOptions,
  issueTargetTableOptions,
  setIssueSeverityInput,
  setIssueCodeInput,
  setIssueTargetTableInput,
  onApplyFilters,
  onClearFilters,
  pageSize,
  onPageSizeChange,
  page,
  totalPages,
  onPrev,
  onNext,
  toIssueCodeLabel,
  toSeverityLabel,
  toSeverityBadgeClass,
  formatIssueDetailText,
}: SyncMonitorIssuesTabProps) {
  return (
    <TabsContent value="issues" className="m-0 flex flex-1 flex-col focus-visible:outline-none">
      <div className="space-y-4 border-b bg-muted/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground">Data Issues</h3>
            <Badge variant="secondary" className="text-xs font-normal">
              {formatThaiNumber(total)} รายการ
            </Badge>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleAdvancedFilters}
              className={cn('h-8 text-xs', showAdvancedFilters && 'bg-muted')}
            >
              <Filter className="mr-1.5 h-3.5 w-3.5" /> ตัวกรอง
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCsv}
              disabled={rows.length === 0}
              className="h-8 text-xs"
            >
              <Download className="h-3.5 w-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>

        {showAdvancedFilters ? (
          <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4 animate-in slide-in-from-top-2">
            <Select
              value={issueSeverityInput}
              onValueChange={(value: 'LOW' | 'MEDIUM' | 'HIGH' | 'all') =>
                setIssueSeverityInput(value)
              }
            >
              <SelectTrigger className="h-8 bg-background text-xs">
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
              <SelectTrigger className="h-8 bg-background text-xs">
                <SelectValue placeholder="รหัสปัญหา" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกรหัส</SelectItem>
                {issueCodeOptions.map((code) => (
                  <SelectItem key={code} value={code}>
                    {toIssueCodeLabel(code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={issueTargetTableInput} onValueChange={setIssueTargetTableInput}>
              <SelectTrigger className="h-8 bg-background text-xs">
                <SelectValue placeholder="ตาราง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกตาราง</SelectItem>
                {issueTargetTableOptions.map((table) => (
                  <SelectItem key={table} value={table}>
                    {table}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" className="h-8 flex-1 text-xs" onClick={onApplyFilters}>
                ค้นหา
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={onClearFilters}
                title="ล้างค่า"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {activeFilters.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {activeFilters.map((filter) => (
              <ActiveFilterChip
                key={`${filter.label}-${filter.value}`}
                label={filter.label}
                value={filter.value}
                onClear={() => onClearActiveFilter(filter)}
              />
            ))}
          </div>
        ) : null}

        <div className="flex w-fit overflow-hidden rounded-lg border bg-background p-1 shadow-sm">
          <div className="flex items-center gap-2 border-r px-3 py-1">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-xs font-medium text-muted-foreground">High</span>
            <span className="ml-1 text-sm font-bold text-red-600">{severitySummary.HIGH}</span>
          </div>
          <div className="flex items-center gap-2 border-r px-3 py-1">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-xs font-medium text-muted-foreground">Med</span>
            <span className="ml-1 text-sm font-bold text-amber-600">{severitySummary.MEDIUM}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-xs font-medium text-muted-foreground">Low</span>
            <span className="ml-1 text-sm font-bold text-blue-600">{severitySummary.LOW}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">ไม่พบรายการปัญหาตามเงื่อนไขที่ค้นหา</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((issue) => (
              <div
                key={issue.issue_id}
                className="relative overflow-hidden rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-border/80"
              >
                <div
                  className={cn(
                    'absolute bottom-0 left-0 top-0 w-1',
                    issue.severity === 'HIGH'
                      ? 'bg-red-500'
                      : issue.severity === 'MEDIUM'
                        ? 'bg-amber-500'
                        : 'bg-blue-500',
                  )}
                />
                <div className="pl-2">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        {toIssueCodeLabel(issue.issue_code)}
                        <Badge
                          className={cn(
                            'h-5 px-1.5 text-[10px] font-medium',
                            toSeverityBadgeClass(issue.severity),
                          )}
                        >
                          {toSeverityLabel(issue.severity)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Table: <span className="font-mono text-foreground">{issue.target_table}</span> |
                        Key: <span className="font-mono text-foreground">{issue.source_key}</span>
                      </p>
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap rounded border border-border/50 bg-muted/30 p-3 font-mono text-xs leading-relaxed text-muted-foreground break-words">
                    {formatIssueDetailText(issue.issue_code, issue.issue_detail)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t bg-muted/10 p-4">
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="h-8 w-[100px] bg-background text-xs">
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
        <PaginationControls page={page} totalPages={totalPages} onPrev={onPrev} onNext={onNext} />
      </div>
    </TabsContent>
  );
}
